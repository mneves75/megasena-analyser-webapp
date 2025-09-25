import "server-only";

import type { PrismaClient } from "@prisma/client";

import Ajv from "ajv/dist/2020";
import type { Logger } from "pino";

import { childLogger } from "@/lib/logger";
import { reportMetric } from "@/lib/metrics";
import { mulberry32 } from "@/lib/random";
import {
  calculateBudgetAllocation,
  calculateTicketCost,
  PricingError,
} from "@/services/pricing";
import {
  getBettingLimits,
  type BettingLimits,
} from "@/services/strategy-limits";
import {
  balancedStrategy,
  coldSurgeStrategy,
  type StrategyContext,
  type StrategyResult,
  type StrategyName,
  type StrategyMetadata,
  hotStreakStrategy,
  uniformStrategy,
} from "@/services/strategies";
import { strategyPayloadSchema } from "@/data-contracts/strategy-payload-schema";

const STRATEGY_HANDLERS: Record<StrategyName, StrategyHandler> = {
  uniform: uniformStrategy,
  balanced: balancedStrategy,
  "hot-streak": hotStreakStrategy,
  "cold-surge": coldSurgeStrategy,
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
  kOverride?: number;
};

export type GenerateBatchRequest = {
  budgetCents: number;
  seed: string;
  strategies?: StrategyRequest[];
  k?: number;
  window?: number;
  timeoutMs?: number;
  client?: PrismaClient;
  spreadBudget?: boolean;
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

type TicketSlot = {
  index: number;
  k: number;
  costCents: number;
};

type TicketPlanning = {
  slots: TicketSlot[];
  plannedLeftover: number;
  baseTicketCost: number;
  plannedTickets: number;
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
  averageTicketCostCents: number;
  ticketCostBreakdown?: Array<{
    k: number;
    costCents: number;
    planned: number;
    emitted: number;
  }>;
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
    spreadBudget: boolean;
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
  averageTicketCostCents: number;
  ticketCostBreakdown?: StrategyPayload["ticketCostBreakdown"];
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

  const limits = await getBettingLimits({ client: request.client });

  const normalizedStrategies = normalizeStrategies(request.strategies);
  if (normalizedStrategies.length === 0) {
    throw new BatchGenerationError(
      "NO_STRATEGY_AVAILABLE",
      "Nenhuma estratégia válida informada",
    );
  }

  const { budgetCents } = request;
  const k = request.k ?? limits.defaultDezenaCount;
  const timeoutMs = request.timeoutMs ?? 3_000;
  const deadline = startedAt + timeoutMs;

  const ticketCostCache = new Map<number, number>();
  const resolveTicketCost = async (kValue: number) => {
    if (!ticketCostCache.has(kValue)) {
      const cost = await calculateTicketCost(kValue, {
        client: request.client,
        limits,
      });
      ticketCostCache.set(kValue, cost);
    }
    return ticketCostCache.get(kValue)!;
  };

  await assertStrategiesWithinBudget({
    strategies: normalizedStrategies,
    budgetCents,
    resolveTicketCost,
  });

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

  const planning = await planTicketSlots(request, limits, {
    k,
    client: request.client,
  });
  if (planning.plannedTickets <= 0) {
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

  const plannedSlots = planning.slots;
  const plannedSnapshot = plannedSlots.map((slot) => ({
    k: slot.k,
    costCents: slot.costCents,
  }));
  let minTicketCost = Number.POSITIVE_INFINITY;
  plannedSlots.forEach((slot) => {
    if (slot.costCents < minTicketCost) {
      minTicketCost = slot.costCents;
    }
  });
  if (!Number.isFinite(minTicketCost)) {
    minTicketCost = planning.baseTicketCost;
  }
  let budgetConsumed = 0;

  for (
    let ticketIndex = 0;
    ticketIndex < plannedSlots.length;
    ticketIndex += 1
  ) {
    const slot = plannedSlots[ticketIndex];
    const budgetRemaining = budgetCents - budgetConsumed;

    if (budgetRemaining < minTicketCost) {
      warnings.add(
        `Orçamento restante de ${budgetRemaining} centavos insuficiente para gerar novas apostas (mínimo necessário ${minTicketCost}).`,
      );
      break;
    }
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
          planning,
          plannedSnapshot,
          strategies: strategySummaries,
          warnings,
          metricsAccumulator,
          seed: request.seed,
          request,
          normalizedStrategies,
          logger,
          limits,
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
        const affordability = await resolveAffordableK({
          desiredK: strategyEntry.kOverride,
          fallbackK: slot.k ?? k,
          defaultK: k,
          budgetRemaining,
          resolveTicketCost,
          strategyName: strategyEntry.name,
          warnings,
        });

        if (!affordability) {
          warnings.add(
            `Orçamento restante de ${budgetRemaining} centavos não comporta nenhuma combinação válida; encerrando geração.`,
          );
          break;
        }

        const { k: desiredK, costCents: desiredCost } = affordability;

        const result = await executeStrategy(strategyEntry, {
          seed: derivedSeed,
          k: desiredK,
          window: strategyEntry.window ?? request.window,
          client: request.client,
          limits,
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
          costCents: desiredCost,
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
          const fallbackSummary = strategySummaries.get("uniform");
          if (fallbackSummary) {
            const fallback = normalizedStrategies.find(
              (candidate) => candidate.name === "uniform",
            ) ?? {
              name: "uniform" as const,
              weight: 0,
              window: request.window,
            };
            successful = await executeFallback(
              fallback,
              request,
              ticketIndex,
              attempts,
              slot.k ?? k,
              duplicates,
              metricsAccumulator,
              fallbackSummary,
              logger,
              limits,
              budgetRemaining,
              resolveTicketCost,
            );
            if (successful) {
              break;
            }
          }
        }
        attempts += 1;
      }
    }

    if (!successful) {
      const fallbackSummary = strategySummaries.get("uniform");
      if (fallbackSummary) {
        const fallback = normalizedStrategies.find(
          (candidate) => candidate.name === "uniform",
        ) ?? {
          name: "uniform" as const,
          weight: 0,
          window: request.window,
        };
        successful = await executeFallback(
          fallback,
          request,
          ticketIndex,
          MAX_ATTEMPTS_PER_TICKET,
          slot.k ?? k,
          duplicates,
          metricsAccumulator,
          fallbackSummary,
          logger,
          limits,
          budgetRemaining,
          resolveTicketCost,
        );
      }
    }

    if (successful) {
      slot.k = successful.metadata.k;
      slot.costCents = successful.costCents;
      budgetConsumed += successful.costCents;
      tickets.push(successful);
    } else {
      warnings.add(
        `Não foi possível gerar aposta única após ${MAX_ATTEMPTS_PER_TICKET} tentativas`,
      );
    }
  }

  const result = buildResult({
    tickets,
    planning,
    plannedSnapshot,
    strategies: strategySummaries,
    warnings,
    metricsAccumulator,
    seed: request.seed,
    request,
    normalizedStrategies,
    logger,
    limits,
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

type PlanTicketOptions = {
  k: number;
  client?: PrismaClient;
};

async function planTicketSlots(
  request: GenerateBatchRequest,
  limits: BettingLimits,
  options: PlanTicketOptions,
): Promise<TicketPlanning> {
  const allocation = await calculateBudgetAllocation(request.budgetCents, {
    k: options.k,
    client: options.client,
    limits,
  });

  if (!request.spreadBudget) {
    return {
      slots: Array.from({ length: allocation.maxTickets }, (_, index) => ({
        index,
        k: options.k,
        costCents: allocation.ticketCostCents,
      })),
      plannedLeftover: allocation.leftoverCents,
      baseTicketCost: allocation.ticketCostCents,
      plannedTickets: allocation.maxTickets,
    };
  }

  const candidateKs = new Set<number>([options.k]);
  if (options.k + 1 <= limits.maxDezenaCount) {
    candidateKs.add(options.k + 1);
  }
  if (options.k + 2 <= limits.maxDezenaCount) {
    candidateKs.add(options.k + 2);
  }
  if (options.k - 1 >= limits.minDezenaCount) {
    candidateKs.add(options.k - 1);
  }

  const candidateEntries = await Promise.all(
    Array.from(candidateKs)
      .sort((a, b) => a - b)
      .map(async (kValue) => ({
        k: kValue,
        costCents: await calculateTicketCost(kValue, {
          client: options.client,
          limits,
        }),
      })),
  );

  const sortedByCostDesc = [...candidateEntries].sort(
    (a, b) => b.costCents - a.costCents,
  );
  const cheapestCost = Math.min(
    ...candidateEntries.map((entry) => entry.costCents),
  );

  const slots: TicketSlot[] = [];
  let remaining = request.budgetCents;

  while (
    remaining >= cheapestCost &&
    slots.length < limits.maxTicketsPerBatch
  ) {
    let allocatedInCycle = false;
    for (const entry of sortedByCostDesc) {
      if (slots.length >= limits.maxTicketsPerBatch) {
        break;
      }
      if (remaining < entry.costCents) {
        continue;
      }
      slots.push({
        index: slots.length,
        k: entry.k,
        costCents: entry.costCents,
      });
      remaining -= entry.costCents;
      allocatedInCycle = true;
    }
    if (!allocatedInCycle) {
      break;
    }
  }

  if (slots.length === 0) {
    const fallbackSlots = Array.from(
      { length: allocation.maxTickets },
      (_, index) => ({
        index,
        k: options.k,
        costCents: allocation.ticketCostCents,
      }),
    );
    return {
      slots: fallbackSlots,
      plannedLeftover: allocation.leftoverCents,
      baseTicketCost: allocation.ticketCostCents,
      plannedTickets: allocation.maxTickets,
    };
  }

  return {
    slots,
    plannedLeftover: remaining,
    baseTicketCost: allocation.ticketCostCents,
    plannedTickets: slots.length,
  };
}

type ResolveAffordableKInput = {
  desiredK?: number;
  fallbackK: number;
  defaultK: number;
  budgetRemaining: number;
  resolveTicketCost: (kValue: number) => Promise<number>;
  strategyName: StrategyName;
  warnings: Set<string>;
};

type AffordableKResult = {
  k: number;
  costCents: number;
};

async function resolveAffordableK(
  input: ResolveAffordableKInput,
): Promise<AffordableKResult | null> {
  const {
    desiredK,
    fallbackK,
    defaultK,
    budgetRemaining,
    resolveTicketCost,
    strategyName,
    warnings,
  } = input;

  const candidates: Array<{
    k: number;
    label: "override" | "fallback" | "default";
  }> = [];
  if (desiredK !== undefined) {
    candidates.push({ k: desiredK, label: "override" });
  }
  candidates.push({ k: fallbackK, label: "fallback" });
  candidates.push({ k: defaultK, label: "default" });

  const visited = new Set<number>();

  for (const candidate of candidates) {
    if (visited.has(candidate.k)) {
      continue;
    }
    visited.add(candidate.k);

    const cost = await resolveTicketCost(candidate.k);

    if (candidate.label === "override" && cost > budgetRemaining) {
      warnings.add(
        `Orçamento insuficiente para estratégia ${strategyName} com k=${candidate.k} (custa ${cost} centavos, restam ${budgetRemaining}).`,
      );
    }

    if (cost <= budgetRemaining) {
      if (
        desiredK !== undefined &&
        candidate.label !== "override" &&
        candidate.k !== desiredK
      ) {
        warnings.add(
          `Estratégia ${strategyName} usando k=${candidate.k} por limitação de orçamento (override solicitado: ${desiredK}).`,
        );
      }

      return { k: candidate.k, costCents: cost };
    }
  }

  return null;
}

type AssertBudgetInput = {
  strategies: StrategyRequest[];
  budgetCents: number;
  resolveTicketCost: (kValue: number) => Promise<number>;
};

async function assertStrategiesWithinBudget({
  strategies,
  budgetCents,
  resolveTicketCost,
}: AssertBudgetInput) {
  for (const strategy of strategies) {
    if (strategy.kOverride !== undefined) {
      const overrideCost = await resolveTicketCost(strategy.kOverride);
      if (overrideCost > budgetCents) {
        throw new PricingError(
          "BUDGET_BELOW_MIN",
          `Orçamento (${budgetCents} centavos) não comporta kOverride=${strategy.kOverride} (custa ${overrideCost} centavos).`,
        );
      }
    }
  }
}

async function executeFallback(
  fallback: StrategyRequest,
  request: GenerateBatchRequest,
  ticketIndex: number,
  attempt: number,
  k: number,
  duplicates: Set<string>,
  accumulator: MetricsAccumulator,
  summary: MutableStrategyExecutionSummary,
  logger: Logger,
  limits: BettingLimits,
  budgetRemaining: number,
  resolveTicketCost: (kValue: number) => Promise<number>,
): Promise<StrategyTicket | null> {
  const derivedSeed = `${request.seed}:${ticketIndex}:${fallback.name}:fallback:${attempt}`;
  try {
    summary.attempts += 1;

    const ticketCost = await resolveTicketCost(k);
    if (ticketCost > budgetRemaining) {
      logger.warn(
        {
          strategy: fallback.name,
          ticketIndex,
          derivedSeed,
          budgetRemaining,
          requiredCost: ticketCost,
        },
        "Fallback não executado: orçamento insuficiente",
      );
      return null;
    }

    const result = await executeStrategy(fallback, {
      seed: derivedSeed,
      k,
      window: fallback.window ?? request.window,
      client: request.client,
      limits,
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

  const limits = await getBettingLimits({ client: options.client });
  const k = options.k ?? limits.defaultDezenaCount;
  const result = await executeStrategy(normalizedStrategy, {
    seed: options.seed,
    k,
    window: normalizedStrategy.window ?? options.window,
    client: options.client,
    limits,
  });

  const costCents = await calculateTicketCost(result.metadata.k, {
    client: options.client,
    limits,
  });

  return {
    strategy: normalizedStrategy.name,
    dezenas: result.dezenas,
    metadata: result.metadata,
    costCents,
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
    kOverride: item.kOverride,
  }));

  const unique = new Map<StrategyName, StrategyRequest>();
  for (const entry of normalized) {
    const existing = unique.get(entry.name);
    if (existing) {
      existing.weight = (existing.weight ?? 0) + (entry.weight ?? 0);
      if (entry.window !== undefined) {
        existing.window = entry.window;
      }
      if (entry.kOverride !== undefined) {
        existing.kOverride = entry.kOverride;
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
  planning: TicketPlanning;
  plannedSnapshot: Array<{ k: number; costCents: number }>;
  strategies: Map<StrategyName, MutableStrategyExecutionSummary>;
  warnings: Set<string>;
  metricsAccumulator: MetricsAccumulator;
  seed: string;
  request: GenerateBatchRequest;
  normalizedStrategies: StrategyRequest[];
  logger: Logger;
  limits: BettingLimits;
};

function buildResult({
  tickets,
  planning,
  plannedSnapshot,
  strategies,
  warnings,
  metricsAccumulator,
  seed,
  request,
  normalizedStrategies,
  logger,
  limits,
}: BuildResultInput): BatchGenerationResult {
  const metrics = metricsAccumulator.build();
  const totalCost = tickets.reduce((sum, ticket) => sum + ticket.costCents, 0);
  const requestedBudget = request.budgetCents;
  const actualLeftover = Math.max(0, requestedBudget - totalCost);
  const plannedTickets = planning.plannedTickets;
  const plannedLeftover = planning.plannedLeftover;
  const ticketCostBaseline = planning.baseTicketCost;
  const averageTicketCost =
    tickets.length > 0
      ? Math.round(totalCost / tickets.length)
      : ticketCostBaseline;

  const ticketCostBreakdown = buildTicketCostBreakdown(
    tickets,
    plannedSnapshot,
  );

  const generatedTickets = tickets.length;

  if (generatedTickets < plannedTickets) {
    warnings.add(
      `Lote gerou ${generatedTickets} de ${plannedTickets} apostas previstas; leftover ajustado para ${actualLeftover} centavos (planejado ${plannedLeftover}).`,
    );
    logger.warn(
      {
        plannedTickets,
        generatedTickets,
        plannedLeftover,
        actualLeftover,
      },
      "Quantidade de apostas geradas abaixo do planejado",
    );
  }

  reportMetric("bets.generation", {
    plannedTickets,
    generatedTickets,
    plannedLeftover,
    actualLeftover,
    totalCost,
    requestedBudget,
    seed,
  });

  logger.info(
    {
      plannedTickets,
      generatedTickets: tickets.length,
      plannedLeftover,
      actualLeftover,
      totalCost,
      requestedBudget,
    },
    "Resumo de geração de apostas",
  );

  const payload: StrategyPayload = {
    version: SCHEMA_VERSION,
    seed,
    requestedBudgetCents: requestedBudget,
    ticketCostCents: ticketCostBaseline,
    averageTicketCostCents: averageTicketCost,
    ticketCostBreakdown,
    totalCostCents: totalCost,
    leftoverCents: actualLeftover,
    ticketsGenerated: generatedTickets,
    strategies: Array.from(strategies.values()),
    metrics,
    config: {
      strategies: normalizedStrategies,
      k: request.k ?? limits.defaultDezenaCount,
      window: request.window,
      timeoutMs: request.timeoutMs ?? 3_000,
      spreadBudget: request.spreadBudget ?? false,
    },
    warnings: Array.from(warnings.values()),
  };

  assertStrategyPayloadSchema(payload, logger);

  return {
    tickets,
    ticketCostCents: ticketCostBaseline,
    averageTicketCostCents: averageTicketCost,
    ticketCostBreakdown,
    totalCostCents: totalCost,
    budgetCents: requestedBudget,
    leftoverCents: actualLeftover,
    payload,
    warnings: payload.warnings,
  };
}

function buildTicketCostBreakdown(
  tickets: StrategyTicket[],
  plannedSnapshot: Array<{ k: number; costCents: number }>,
) {
  const plannedCounts = new Map<
    number,
    { costCents: number; planned: number }
  >();
  const emittedCounts = new Map<
    number,
    { costCents: number; emitted: number }
  >();

  plannedSnapshot.forEach((slot) => {
    const entry = plannedCounts.get(slot.k);
    if (entry) {
      entry.planned += 1;
      entry.costCents = slot.costCents;
    } else {
      plannedCounts.set(slot.k, {
        planned: 1,
        costCents: slot.costCents,
      });
    }
  });

  tickets.forEach((ticket) => {
    const kValue = ticket.dezenas.length;
    const entry = emittedCounts.get(kValue);
    if (entry) {
      entry.emitted += 1;
      entry.costCents = ticket.costCents;
    } else {
      emittedCounts.set(kValue, {
        emitted: 1,
        costCents: ticket.costCents,
      });
    }
  });

  const keys = new Set<number>([
    ...plannedCounts.keys(),
    ...emittedCounts.keys(),
  ]);

  return Array.from(keys)
    .sort((a, b) => a - b)
    .map((kValue) => {
      const planned = plannedCounts.get(kValue);
      const emitted = emittedCounts.get(kValue);
      return {
        k: kValue,
        costCents: emitted?.costCents ?? planned?.costCents ?? 0,
        planned: planned?.planned ?? 0,
        emitted: emitted?.emitted ?? 0,
      };
    });
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
