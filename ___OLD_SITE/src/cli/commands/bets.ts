import { randomUUID } from "node:crypto";

import { Command } from "commander";

import { withCliContext } from "@/cli/context";
import {
  parseAmountToCents,
  parseOptionalDate,
  parseOptionalInteger,
  registerJsonFlags,
  resolveJsonMode,
} from "@/cli/options";
import {
  printHeading,
  printJsonPayload,
  printKeyValueTable,
} from "@/cli/output";
import {
  BatchGenerationError,
  generateBatch,
  type StrategyRequest,
} from "@/services/bets";
import { persistBatch, listBets } from "@/services/bet-store";
import type { StoredBet } from "@/services/bet-store";
import { PricingError } from "@/services/pricing";
import type { StrategyName } from "@/types/strategy";
import { getStrategyLabel } from "@/services/strategies/labels";

const STRATEGY_NAMES: StrategyName[] = [
  "balanced",
  "uniform",
  "hot-streak",
  "cold-surge",
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function registerBetsCommand(program: Command) {
  const bets = program
    .command("bets")
    .description("Ferramentas de geração e consulta de apostas");

  registerGenerateCommand(bets);
  registerListCommand(bets);
}

type GenerateOptions = {
  budget: string;
  strategy?: string;
  seed?: string;
  window?: number;
  spreadBudget?: boolean;
  timeout?: number;
  k?: number;
  persist?: boolean;
  json?: boolean;
  prettyJson?: boolean;
};

function registerGenerateCommand(parent: Command) {
  const command = parent
    .command("generate")
    .description("Gera um lote de apostas com as heurísticas do motor")
    .requiredOption("--budget <valor>", "Orçamento em reais (ex.: 120.50)")
    .option(
      "--strategy <nome>",
      `Estratégia principal (${STRATEGY_NAMES.join(", ")})`,
      "balanced",
    )
    .option("--seed <valor>", "Seed customizada para reprodutibilidade")
    .option(
      "--window <concursos>",
      "Janela estatística aplicada às estratégias",
    )
    .option(
      "--spread-budget",
      "Distribui o orçamento entre múltiplos valores de k",
    )
    .option("--timeout <ms>", "Tempo máximo de geração antes de abortar (ms)")
    .option("--k <dezenas>", "Sobrescreve o número base de dezenas (6-15)")
    .option("--persist", "Persiste o lote gerado no banco");

  registerJsonFlags(command);

  command.action(async (options: GenerateOptions) => {
    const jsonMode = resolveJsonMode(options);
    const budgetCents = parseAmountToCents(options.budget, {
      minCents: 600,
    });
    const windowSize = parseOptionalInteger(options.window, { min: 1 });
    const timeoutMs =
      parseOptionalInteger(options.timeout, { min: 1 }) ?? 3_000;
    const spreadBudget = Boolean(options.spreadBudget);
    const persist = Boolean(options.persist);
    const seed = options.seed?.trim() ?? createSeed();
    const strategyName = normalizeStrategy(options.strategy);
    const strategies = buildStrategyRequests(strategyName, windowSize);
    const kValue = parseOptionalInteger(options.k, { min: 6, max: 15 });
    if (kValue !== undefined) {
      strategies[0].kOverride = kValue;
    }

    try {
      await withCliContext(async ({ prisma }) => {
        const result = await generateBatch({
          budgetCents,
          seed,
          strategies,
          window: windowSize,
          timeoutMs,
          spreadBudget,
          client: prisma,
          k: kValue,
        });

        if (persist) {
          await persistBatch(result, { client: prisma });
        }

        if (jsonMode !== "off") {
          printJsonPayload(
            {
              persisted: persist,
              tickets: result.tickets,
              payload: result.payload,
              warnings: result.warnings,
            },
            jsonMode,
          );
          return;
        }

        printHeading("Resumo do lote gerado");
        printKeyValueTable([
          ["Seed", seed],
          [
            "Estratégias",
            strategies.map((item) => getStrategyLabel(item.name)).join(", "),
          ],
          ["Orçamento", formatCurrency(budgetCents)],
          ["Custo total", formatCurrency(result.totalCostCents)],
          ["Leftover", formatCurrency(result.leftoverCents)],
          ["Tickets", result.tickets.length],
          ["Persistido", persist ? "sim" : "não (use --persist para salvar)"],
        ]);

        if (result.payload.ticketCostBreakdown?.length) {
          console.log("\nDistribuição planejada vs. emitida:");
          result.payload.ticketCostBreakdown.forEach((entry) => {
            console.log(
              ` k=${entry.k}: planejadas ${entry.planned}, emitidas ${entry.emitted}, custo ${formatCurrency(entry.costCents)}`,
            );
          });
        }

        if (persist) {
          console.log("\n✅ Lote persistido com sucesso.\n");
        } else {
          console.log(
            "\n⚠️ Simulação: nada foi salvo. Informe --persist para gravar o lote.\n",
          );
        }

        if (result.warnings.length > 0) {
          console.log("\nAvisos:");
          result.warnings.forEach((warning) => {
            console.log(` • ${warning}`);
          });
        }
      });
    } catch (error) {
      if (handleKnownGenerationError(error)) {
        return;
      }
      throw error;
    }
  });
}

function registerListCommand(parent: Command) {
  const command = parent
    .command("list")
    .description("Consulta apostas persistidas aplicando filtros opcionais")
    .option("--strategy <nome>", "Filtra por estratégia utilizada")
    .option("--from <ISO>", "Data inicial (YYYY-MM-DD)")
    .option("--to <ISO>", "Data final (YYYY-MM-DD)")
    .option("--min-budget <valor>", "Orçamento mínimo (reais)")
    .option("--max-budget <valor>", "Orçamento máximo (reais)")
    .option("--limit <n>", "Quantidade máxima de registros (default 20)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      strategy?: string;
      from?: string;
      to?: string;
      minBudget?: string;
      maxBudget?: string;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const strategyFilter = options.strategy?.trim().toLowerCase();
      const fromDate = parseOptionalDate(options.from);
      const toDate = parseOptionalDate(options.to);
      const minBudgetCents = options.minBudget
        ? parseAmountToCents(options.minBudget)
        : undefined;
      const maxBudgetCents = options.maxBudget
        ? parseAmountToCents(options.maxBudget)
        : undefined;
      const limit =
        parseOptionalInteger(options.limit, { min: 1, max: 200 }) ?? 20;

      await withCliContext(async ({ prisma }) => {
        const bets = await listBets(
          {
            strategy: strategyFilter,
            budgetMinCents: minBudgetCents,
            budgetMaxCents: maxBudgetCents,
            createdFrom: fromDate,
            createdTo: toDate,
            limit,
          },
          { client: prisma },
        );

        if (jsonMode !== "off") {
          const serialized = bets.map((bet) => ({
            id: bet.id,
            createdAt: bet.createdAt.toISOString(),
            strategy: bet.strategyName,
            ticket: {
              costCents: bet.ticketCostCents,
              seed: bet.ticketSeed,
              metadata: bet.metadata,
              dezenas: bet.dezenas,
            },
            batch: {
              id: bet.batch.id,
              createdAt: bet.batch.createdAt.toISOString(),
              budgetCents: bet.batch.budgetCents,
              totalCostCents: bet.batch.totalCostCents,
              leftoverCents: bet.batch.leftoverCents,
              ticketsGenerated: bet.batch.ticketsGenerated,
              averageTicketCostCents: bet.batch.averageTicketCostCents,
              seed: bet.batch.seed,
              payload: bet.batch.payload,
            },
          }));

          printJsonPayload(serialized, jsonMode);
          return;
        }

        if (bets.length === 0) {
          console.log("Nenhuma aposta encontrada com os filtros informados.");
          return;
        }

        printHeading(`Últimas ${bets.length} apostas`);
        bets.forEach((bet) => {
          printBetLine(bet);
        });
      });
    },
  );
}

function normalizeStrategy(value: string | undefined): StrategyName {
  if (!value) {
    return "balanced";
  }
  const normalized = value.trim().toLowerCase();
  if (STRATEGY_NAMES.includes(normalized as StrategyName)) {
    return normalized as StrategyName;
  }
  throw new Error(
    `Estratégia inválida: ${value}. Valores aceitos: ${STRATEGY_NAMES.join(", ")}`,
  );
}

function buildStrategyRequests(
  primary: StrategyName,
  window?: number,
): StrategyRequest[] {
  const requests: StrategyRequest[] = [{ name: primary, weight: 1, window }];

  if (primary !== "uniform") {
    requests.push({ name: "uniform", weight: 1 });
  }

  return requests;
}

function createSeed() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function handleKnownGenerationError(error: unknown): boolean {
  if (error instanceof PricingError || error instanceof BatchGenerationError) {
    console.error(`Erro ao gerar apostas: ${error.message}`);
    process.exitCode = 65;
    return true;
  }
  return false;
}

function printBetLine(bet: StoredBet) {
  const createdAt = bet.createdAt.toISOString();
  const totalCost = formatCurrency(bet.batch.totalCostCents);
  const budget = formatCurrency(bet.batch.budgetCents);
  const leftover = formatCurrency(bet.batch.leftoverCents);
  const seed = bet.batch.seed;
  const ticket = formatCurrency(bet.ticketCostCents);
  const mixSummary = summarizeTicketBreakdown(
    bet.batch.payload.ticketCostBreakdown ?? [],
  );

  console.log(
    `[${createdAt}] ${bet.strategyName} · ticket ${ticket} · gasto ${totalCost} (budget ${budget}, leftover ${leftover}) · seed ${seed}${mixSummary}`,
  );
}

export function summarizeTicketBreakdown(
  breakdown: Array<{
    k: number;
    planned?: number;
    emitted?: number;
    costCents?: number;
  }>,
) {
  if (!breakdown || breakdown.length === 0) {
    return "";
  }
  const parts = breakdown
    .map((entry) => {
      const emitted = entry.emitted ?? entry.planned ?? 0;
      return `${emitted}x${entry.k}`;
    })
    .filter((part) => !part.startsWith("0x"));
  if (parts.length === 0) {
    return "";
  }
  return ` · mix ${parts.join("+")}`;
}
