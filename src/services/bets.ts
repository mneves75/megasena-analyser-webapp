import "server-only";

import type { PrismaClient } from "@prisma/client";

import Ajv from "ajv/dist/2020";
import type { Logger } from "pino";

import { childLogger } from "@/lib/logger";
import { mulberry32 } from "@/lib/random";
import { calculateBudgetAllocation, PricingError } from "@/services/pricing";
import { BETTING_LIMITS } from "@/services/strategy-limits";
import {
  balancedStrategy,
  type StrategyContext,
  type StrategyResult,
  type StrategyName,
  type StrategyMetadata,
  uniformStrategy,
} from "@/services/strategies";
import { strategyPayloadSchema } from "@/data-contracts/strategy-payload-schema";

const STRATEGY_HANDLERS: Record<StrategyName, StrategyHandler> = {
  uniform: uniformStrategy,
  balanced: balancedStrategy,
};

const DEFAULT_STRATEGIES: StrategyRequest[] = [
  { name: "balanced", weight: 2 },
  { name: "uniform", weight: 1 },
];

const MAX_ATTEMPTS_PER_TICKET = 100;
const SCHEMA_VERSION = "1.0" as const;
const ajv = new Ajv({ allErrors: true, strict: false });
const validateStrategyPayload = ajv.compile<StrategyPayload>(
  strategyPayloadSchema,
);

export type StrategyRequest = {
  name: StrategyName;
  weight?: number;
  window?: number;
};

export type GenerateBatchRequest = {
  budgetCents: number;
  seed: string;
  strategies?: StrategyRequest[];
  k?: number;
  window?: number;
  timeoutMs?: number;
  client?: PrismaClient;
};

export type StrategyTicket = {
  strategy: StrategyName;
  dezenas: number[];
  metadata: StrategyMetadata;
  costCents: number;
  seed: string;
};

export type StrategyExecutionSummary = {
  name: StrategyName;
  weight: number;
  generated: number;
  attempts: number;
  failures: number;
};

export type QuadrantCoverageMetrics = {
  min: number;
  max: number;
  average: number;
};

export type BatchMetrics = {
  averageSum: number;
  averageScore: number;
  paritySpread: number;
  quadrantCoverage: QuadrantCoverageMetrics;
};

export type StrategyPayload = {
  version: typeof SCHEMA_VERSION;
  seed: string;
  requestedBudgetCents: number;
  ticketCostCents: number;
  totalCostCents: number;
  leftoverCents: number;
  ticketsGenerated: number;
  strategies: StrategyExecutionSummary[];
  metrics: BatchMetrics;
  config: {
    strategies: StrategyRequest[];
    k: number;
    window?: number;
    timeoutMs: number;
  };
  warnings: string[];
  ticket?: {
    strategy: StrategyName;
    metadata: StrategyMetadata;
    seed: string;
    costCents: number;
  };
};

export type BatchGenerationResult = {
  tickets: StrategyTicket[];
  ticketCostCents: number;
  totalCostCents: number;
  budgetCents: number;
  leftoverCents: number;
  payload: StrategyPayload;
  warnings: string[];
};

export type StrategyHandler = (
  context: StrategyContext,
) => Promise<StrategyResult>;

export type BatchGenerationErrorCode =
  | "GENERATION_TIMEOUT"
  | "NO_STRATEGY_AVAILABLE";

export class BatchGenerationError extends Error {
  readonly code: BatchGenerationErrorCode;
  readonly partial?: BatchGenerationResult;

  constructor(
    code: BatchGenerationErrorCode,
    message: string,
    partial?: BatchGenerationResult,
  ) {
    super(message);
    this.name = "BatchGenerationError";
    this.code = code;
    this.partial = partial;
  }
}

export async function generateBatch(
  request: GenerateBatchRequest,
): Promise<BatchGenerationResult> {
  assertSeed(request.seed);

  const logger = childLogger({ service: "bets", seed: request.seed });
  const startedAt = Date.now();

  const normalizedStrategies = normalizeStrategies(request.strategies);
  if (normalizedStrategies.length === 0) {
    throw new BatchGenerationError(
      "NO_STRATEGY_AVAILABLE",
      "Nenhuma estratégia válida informada",
    );
  }

  const { budgetCents, k = BETTING_LIMITS.defaultDezenaCount } = request;
  const timeoutMs = request.timeoutMs ?? 3_000;
  const deadline = startedAt + timeoutMs;

  logger.info(
    {
      budgetCents,
      k,
      strategies: normalizedStrategies.map((item) => item.name),
      timeoutMs,
      window: request.window,
    },
    "Iniciando geração de apostas",
  );

  const allocation = await calculateBudgetAllocation(budgetCents, {
    k,
    client: request.client,
  });
  const ticketCost = allocation.ticketCostCents;
  if (allocation.maxTickets <= 0) {
    throw new PricingError(
      "BUDGET_BELOW_MIN",
      "Orçamento insuficiente para gerar apostas",
    );
  }

  const tickets: StrategyTicket[] = [];
  const duplicates = new Set<string>();
  const prng = mulberry32(`${request.seed}:batch`);
  const strategySummaries = buildStrategySummaryMap(normalizedStrategies);
  const warnings = new Set<string>();

  const metricsAccumulator = createMetricsAccumulator();

  for (
    let ticketIndex = 0;
    ticketIndex < allocation.maxTickets;
    ticketIndex += 1
  ) {
    if (Date.now() > deadline) {
      logger.error(
        {
          ticketIndex,
          durationMs: Date.now() - startedAt,
          ticketsGenerated: tickets.length,
        },
        "Tempo limite excedido durante a geração",
      );
      throw new BatchGenerationError(
        "GENERATION_TIMEOUT",
        "Tempo limite atingido durante a geração de apostas",
        buildPartialResult({
          tickets,
          ticketCost,
          allocation,
          strategies: strategySummaries,
          warnings,
          metricsAccumulator,
          seed: request.seed,
          request,
          normalizedStrategies,
          logger,
        }),
      );
    }

    const strategyEntry = pickStrategy(normalizedStrategies, prng());
    const summary = strategySummaries.get(strategyEntry.name)!;

    let attempts = 0;
    let successful: StrategyTicket | null = null;
    while (attempts < MAX_ATTEMPTS_PER_TICKET && !successful) {
      summary.attempts += 1;
      const derivedSeed = `${request.seed}:${ticketIndex}:${strategyEntry.name}:${attempts}`;
      try {
        const result = await executeStrategy(strategyEntry, {
          seed: derivedSeed,
          k,
          window: strategyEntry.window ?? request.window,
          client: request.client,
        });

        const key = result.dezenas.join("-");
        if (duplicates.has(key)) {
          attempts += 1;
          continue;
        }

        duplicates.add(key);
        summary.generated += 1;
        successful = {
          strategy: strategyEntry.name,
          dezenas: result.dezenas,
          metadata: result.metadata,
          costCents: ticketCost,
          seed: derivedSeed,
        };
        metricsAccumulator.add(result.metadata);
      } catch {
        summary.failures += 1;
        if (strategyEntry.name !== "uniform") {
          warnings.add(
            `Falha ao gerar aposta com estratégia ${strategyEntry.name}, aplicando fallback uniforme`,
          );
          logger.warn(
            {
              strategy: strategyEntry.name,
              ticketIndex,
              attempts,
            },
            "Erro ao gerar aposta; tentando fallback uniforme",
          );
          const fallback = normalizedStrategies.find(
            (candidate) => candidate.name === "uniform",
          );
          if (fallback) {
            const fallbackSummary = strategySummaries.get(fallback.name)!;
            successful = await executeFallback(
              fallback,
              request,
              ticketIndex,
              attempts,
              k,
              ticketCost,
              duplicates,
              metricsAccumulator,
              fallbackSummary,
              logger,
            );
            break;
          }
        }
        attempts += 1;
      }
    }

    if (!successful) {
      const fallback = normalizedStrategies.find(
        (candidate) => candidate.name === "uniform",
      );
      if (fallback) {
        const fallbackSummary = strategySummaries.get(fallback.name)!;
        successful = await executeFallback(
          fallback,
          request,
          ticketIndex,
          MAX_ATTEMPTS_PER_TICKET,
          k,
          ticketCost,
          duplicates,
          metricsAccumulator,
          fallbackSummary,
          logger,
        );
      }
    }

    if (successful) {
      tickets.push(successful);
    } else {
      warnings.add(
        `Não foi possível gerar aposta única após ${MAX_ATTEMPTS_PER_TICKET} tentativas`,
      );
    }
  }

  const result = buildResult({
    tickets,
    ticketCost,
    allocation,
    strategies: strategySummaries,
    warnings,
    metricsAccumulator,
    seed: request.seed,
    request,
    normalizedStrategies,
    logger,
  });

  logger.info(
    {
      ticketsGenerated: result.tickets.length,
      totalCostCents: result.totalCostCents,
      leftoverCents: result.leftoverCents,
      warnings: result.warnings,
      durationMs: Date.now() - startedAt,
    },
    "Geração de apostas concluída",
  );

  return result;
}

async function executeFallback(
  fallback: StrategyRequest,
  request: GenerateBatchRequest,
  ticketIndex: number,
  attempt: number,
  k: number,
  ticketCost: number,
  duplicates: Set<string>,
  accumulator: MetricsAccumulator,
  summary: MutableStrategyExecutionSummary,
  logger: Logger,
): Promise<StrategyTicket | null> {
  const derivedSeed = `${request.seed}:${ticketIndex}:${fallback.name}:fallback:${attempt}`;
  try {
    summary.attempts += 1;
    const result = await executeStrategy(fallback, {
      seed: derivedSeed,
      k,
      window: fallback.window ?? request.window,
      client: request.client,
    });
    const key = result.dezenas.join("-");
    if (duplicates.has(key)) {
      logger.debug(
        {
          strategy: fallback.name,
          ticketIndex,
          derivedSeed,
        },
        "Ticket duplicado detectado no fallback",
      );
      return null;
    }
    duplicates.add(key);
    summary.generated += 1;
    accumulator.add(result.metadata);
    logger.debug(
      {
        strategy: fallback.name,
        ticketIndex,
        derivedSeed,
      },
      "Ticket gerado via fallback",
    );
    return {
      strategy: fallback.name,
      dezenas: result.dezenas,
      metadata: result.metadata,
      costCents: ticketCost,
      seed: derivedSeed,
    };
  } catch {
    summary.failures += 1;
    logger.warn(
      {
        strategy: fallback.name,
        ticketIndex,
        derivedSeed,
      },
      "Fallback uniforme falhou",
    );
    return null;
  }
}

async function executeStrategy(
  request: StrategyRequest,
  context: StrategyContext,
): Promise<StrategyResult> {
  const handler = STRATEGY_HANDLERS[request.name];
  if (!handler) {
    throw new Error(`Estratégia desconhecida: ${request.name}`);
  }
  return handler(context);
}

export function chooseStrategies(
  strategies?: StrategyRequest[],
): StrategyRequest[] {
  return normalizeStrategies(strategies);
}

export async function generateTicket(
  strategy: StrategyRequest,
  options: {
    seed: string;
    k?: number;
    window?: number;
    client?: PrismaClient;
  },
): Promise<StrategyTicket> {
  assertSeed(options.seed);
  const normalizedStrategy = normalizeStrategies([strategy])[0];
  if (!normalizedStrategy) {
    throw new Error("Estratégia inválida");
  }

  const k = options.k ?? BETTING_LIMITS.defaultDezenaCount;
  const result = await executeStrategy(normalizedStrategy, {
    seed: options.seed,
    k,
    window: normalizedStrategy.window ?? options.window,
    client: options.client,
  });

  return {
    strategy: normalizedStrategy.name,
    dezenas: result.dezenas,
    metadata: result.metadata,
    costCents: 0,
    seed: options.seed,
  };
}

function normalizeStrategies(
  strategies?: StrategyRequest[],
): StrategyRequest[] {
  const source =
    strategies && strategies.length > 0 ? strategies : DEFAULT_STRATEGIES;
  const normalized = source.map((item) => ({
    name: item.name,
    weight: item.weight ?? 1,
    window: item.window,
  }));

  const unique = new Map<StrategyName, StrategyRequest>();
  for (const entry of normalized) {
    const existing = unique.get(entry.name);
    if (existing) {
      existing.weight = (existing.weight ?? 0) + (entry.weight ?? 0);
      if (entry.window !== undefined) {
        existing.window = entry.window;
      }
    } else {
      unique.set(entry.name, entry);
    }
  }

  return Array.from(unique.values()).filter((entry) => (entry.weight ?? 0) > 0);
}

function pickStrategy(
  strategies: StrategyRequest[],
  roll: number,
): StrategyRequest {
  const totalWeight = strategies.reduce(
    (sum, entry) => sum + (entry.weight ?? 0),
    0,
  );
  let threshold = roll * totalWeight;
  for (const entry of strategies) {
    threshold -= entry.weight ?? 0;
    if (threshold <= 0) {
      return entry;
    }
  }
  return strategies[strategies.length - 1];
}

function assertSeed(seed: string) {
  if (!seed || seed.trim().length === 0) {
    throw new Error("Seed inválida");
  }
}

function buildStrategySummaryMap(strategies: StrategyRequest[]) {
  const map = new Map<StrategyName, MutableStrategyExecutionSummary>();
  strategies.forEach((entry) => {
    map.set(entry.name, {
      name: entry.name,
      weight: entry.weight ?? 1,
      generated: 0,
      attempts: 0,
      failures: 0,
    });
  });

  if (!map.has("uniform")) {
    map.set("uniform", {
      name: "uniform",
      weight: 0,
      generated: 0,
      attempts: 0,
      failures: 0,
    });
  }

  return map;
}

type MutableStrategyExecutionSummary = StrategyExecutionSummary;

type MetricsAccumulator = {
  add: (metadata: StrategyMetadata) => void;
  build: () => BatchMetrics;
};

function createMetricsAccumulator(): MetricsAccumulator {
  const entries: StrategyMetadata[] = [];
  return {
    add(metadata) {
      entries.push(metadata);
    },
    build(): BatchMetrics {
      if (entries.length === 0) {
        return {
          averageSum: 0,
          averageScore: 0,
          paritySpread: 0,
          quadrantCoverage: { min: 0, max: 0, average: 0 },
        };
      }

      const sums = entries.map((item) => item.sum);
      const scores = entries.map((item) => item.score ?? 0);
      const parityDiffs = entries.map((item) =>
        Math.abs(item.parity.even - item.parity.odd),
      );
      const coverageCounts = entries.map(
        (item) =>
          item.quadrants.filter((quadrant) => quadrant.count > 0).length,
      );

      const averageSum = average(sums);
      const averageScore = average(scores);
      const paritySpread = average(parityDiffs);
      const quadrantCoverage: QuadrantCoverageMetrics = {
        min: Math.min(...coverageCounts),
        max: Math.max(...coverageCounts),
        average: average(coverageCounts),
      };

      return {
        averageSum,
        averageScore,
        paritySpread,
        quadrantCoverage,
      };
    },
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

type BuildResultInput = {
  tickets: StrategyTicket[];
  ticketCost: number;
  allocation: Awaited<ReturnType<typeof calculateBudgetAllocation>>;
  strategies: Map<StrategyName, MutableStrategyExecutionSummary>;
  warnings: Set<string>;
  metricsAccumulator: MetricsAccumulator;
  seed: string;
  request: GenerateBatchRequest;
  normalizedStrategies: StrategyRequest[];
  logger: Logger;
};

function buildResult({
  tickets,
  ticketCost,
  allocation,
  strategies,
  warnings,
  metricsAccumulator,
  seed,
  request,
  normalizedStrategies,
  logger,
}: BuildResultInput): BatchGenerationResult {
  const metrics = metricsAccumulator.build();
  const totalCost = tickets.length * ticketCost;

  const payload: StrategyPayload = {
    version: SCHEMA_VERSION,
    seed,
    requestedBudgetCents: allocation.budgetCents,
    ticketCostCents: ticketCost,
    totalCostCents: totalCost,
    leftoverCents: allocation.leftoverCents,
    ticketsGenerated: tickets.length,
    strategies: Array.from(strategies.values()),
    metrics,
    config: {
      strategies: normalizedStrategies,
      k: request.k ?? BETTING_LIMITS.defaultDezenaCount,
      window: request.window,
      timeoutMs: request.timeoutMs ?? 3_000,
    },
    warnings: Array.from(warnings.values()),
  };

  assertStrategyPayloadSchema(payload, logger);

  return {
    tickets,
    ticketCostCents: ticketCost,
    totalCostCents: totalCost,
    budgetCents: allocation.budgetCents,
    leftoverCents: allocation.leftoverCents,
    payload,
    warnings: payload.warnings,
  };
}

function buildPartialResult(input: BuildResultInput): BatchGenerationResult {
  return buildResult(input);
}

function assertStrategyPayloadSchema(payload: StrategyPayload, logger: Logger) {
  if (validateStrategyPayload(payload)) {
    return;
  }

  const errors = validateStrategyPayload.errors ?? [];
  logger.error({ errors }, "Payload de estratégia inválido");
  throw new Error(
    `Strategy payload inválido: ${ajv.errorsText(errors, { separator: "; " })}`,
  );
}
