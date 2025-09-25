import { Command } from "commander";

import { withCliContext } from "@/cli/context";
import {
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
  getFrequencies,
  getPairs,
  getTriplets,
  getRuns,
  getSums,
  getQuadrants,
  getRecency,
} from "@/services/stats";

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function registerStatsCommand(program: Command) {
  const stats = program
    .command("stats")
    .description("Visualiza estatísticas históricas em modo texto ou JSON");

  registerFrequenciesCommand(stats);
  registerPairsCommand(stats);
  registerTripletsCommand(stats);
  registerRunsCommand(stats);
  registerSumsCommand(stats);
  registerQuadrantsCommand(stats);
  registerRecencyCommand(stats);
}

function registerFrequenciesCommand(parent: Command) {
  const command = parent
    .command("frequencies")
    .description("Lista as dezenas mais frequentes dentro da janela informada")
    .option(
      "--window <number>",
      "Quantidade de concursos analisados (default 200)",
    )
    .option("--limit <number>", "Qtde. de dezenas exibidas (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 60 }) ?? 10;

      await withCliContext(async ({ prisma }) => {
        const result = await getFrequencies({
          window: windowSize,
          client: prisma,
        });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Frequência de dezenas");
        printKeyValueTable([
          ["Concursos total", result.totalDraws],
          ["Janela inicial", result.windowStart ?? "não limitada"],
        ]);

        result.items.slice(0, displayLimit).forEach((item, index) => {
          const dezena = item.dezena.toString().padStart(2, "0");
          const hits = item.hits.toString().padStart(3, " ");
          const percentage = percentFormatter.format(item.frequency);
          console.log(
            `${String(index + 1).padStart(2, "0")}. ${dezena} – ${hits} hits (${percentage})`,
          );
        });
      });
    },
  );
}

function registerPairsCommand(parent: Command) {
  const command = parent
    .command("pairs")
    .description("Exibe pares mais recorrentes na janela informada")
    .option("--window <number>")
    .option("--limit <number>", "Qtde. de pares (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 200 }) ?? 10;
      const queryLimit = options.limit
        ? displayLimit
        : Math.max(displayLimit, 20);

      await withCliContext(async ({ prisma }) => {
        const result = await getPairs({
          window: windowSize,
          limit: queryLimit,
          client: prisma,
        });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Top pares");
        result.slice(0, displayLimit).forEach((pair, index) => {
          const label = pair.combination
            .map((n) => n.toString().padStart(2, "0"))
            .join("-");
          console.log(
            `${String(index + 1).padStart(2, "0")}. ${label} – ${pair.hits} ocorrências`,
          );
        });
      });
    },
  );
}

function registerTripletsCommand(parent: Command) {
  const command = parent
    .command("triplets")
    .description("Exibe trincas mais recorrentes na janela informada")
    .option("--window <number>")
    .option("--limit <number>", "Qtde. de trincas (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 200 }) ?? 10;
      const queryLimit = options.limit
        ? displayLimit
        : Math.max(displayLimit, 20);

      await withCliContext(async ({ prisma }) => {
        const result = await getTriplets({
          window: windowSize,
          limit: queryLimit,
          client: prisma,
        });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Top trincas");
        result.slice(0, displayLimit).forEach((triplet, index) => {
          const label = triplet.combination
            .map((n) => n.toString().padStart(2, "0"))
            .join("-");
          console.log(
            `${String(index + 1).padStart(2, "0")}. ${label} – ${triplet.hits} ocorrências`,
          );
        });
      });
    },
  );
}

function registerRunsCommand(parent: Command) {
  const command = parent
    .command("runs")
    .description("Mostra sequências consecutivas mais comuns")
    .option("--window <number>")
    .option("--limit <number>", "Qtde. de sequências (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 200 }) ?? 10;

      await withCliContext(async ({ prisma }) => {
        const result = await getRuns({ window: windowSize, client: prisma });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Sequências consecutivas");
        result.slice(0, displayLimit).forEach((run, index) => {
          const label = run.sequence
            .map((n) => n.toString().padStart(2, "0"))
            .join("-");
          console.log(
            `${String(index + 1).padStart(2, "0")}. ${label} – tamanho ${run.length}, ${run.count} ocorrências`,
          );
        });
      });
    },
  );
}

function registerSumsCommand(parent: Command) {
  const command = parent
    .command("sums")
    .description(
      "Apresenta estatísticas de soma total e distribuição par/ímpar",
    )
    .option("--window <number>")
    .option("--limit <number>", "Qtde. de somas no histograma (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 60 }) ?? 10;

      await withCliContext(async ({ prisma }) => {
        const result = await getSums({ window: windowSize, client: prisma });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        const totalDraws = result.totalDraws;
        const parityTotal = result.parity.even + result.parity.odd;
        const evenPercent =
          parityTotal > 0 ? result.parity.even / parityTotal : 0;
        const oddPercent =
          parityTotal > 0 ? result.parity.odd / parityTotal : 0;

        printHeading("Soma dos concursos");
        printKeyValueTable([
          ["Concursos analisados", totalDraws],
          ["Soma média", Math.round(result.average ?? 0)],
          [
            "Pares",
            `${result.parity.even} (${percentFormatter.format(evenPercent)})`,
          ],
          [
            "Ímpares",
            `${result.parity.odd} (${percentFormatter.format(oddPercent)})`,
          ],
        ]);

        console.log("\nTop somas:");
        result.histogram
          .sort((a, b) => b.count - a.count)
          .slice(0, displayLimit)
          .forEach((entry, index) => {
            console.log(
              `${String(index + 1).padStart(2, "0")}. soma ${entry.sum} – ${entry.count} ocorrências`,
            );
          });
      });
    },
  );
}

function registerQuadrantsCommand(parent: Command) {
  const command = parent
    .command("quadrants")
    .description("Distribuição das dezenas por faixas de dez números")
    .option("--window <number>");

  registerJsonFlags(command);

  command.action(
    async (options: {
      window?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const windowSize = parseOptionalInteger(options.window, { min: 1 });

      await withCliContext(async ({ prisma }) => {
        const result = await getQuadrants({
          window: windowSize,
          client: prisma,
        });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Distribuição por faixas");
        const total = result.reduce((acc, item) => acc + item.total, 0);
        result.forEach((item) => {
          const share =
            total > 0 ? percentFormatter.format(item.total / total) : "0%";
          console.log(`${item.range}: ${item.total} dezenas (${share})`);
        });
      });
    },
  );
}

function registerRecencyCommand(parent: Command) {
  const command = parent
    .command("recency")
    .description(
      "Mostra há quantos concursos cada dezena apareceu pela última vez",
    )
    .option("--limit <number>", "Qtde. de dezenas mais atrasadas (default 10)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      limit?: number;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const displayLimit =
        parseOptionalInteger(options.limit, { min: 1, max: 60 }) ?? 10;

      await withCliContext(async ({ prisma }) => {
        const result = await getRecency({ client: prisma });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        printHeading("Dezenas mais atrasadas");
        const sorted = [...result].sort((a, b) => {
          const aVal = a.contestsSinceLast ?? -1;
          const bVal = b.contestsSinceLast ?? -1;
          return bVal - aVal;
        });

        sorted.slice(0, displayLimit).forEach((item, index) => {
          const status =
            item.contestsSinceLast === null
              ? "nunca registrada"
              : `${item.contestsSinceLast} concursos de distância`;
          console.log(
            `${String(index + 1).padStart(2, "0")}. ${item.dezena.toString().padStart(2, "0")} – ${status}`,
          );
        });
      });
    },
  );
}
