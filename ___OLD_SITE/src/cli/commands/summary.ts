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
import { loadHomeSummary } from "@/services/dashboard/home-summary";

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function registerSummaryCommand(program: Command) {
  const command = program
    .command("summary")
    .description(
      "Exibe o resumo do dashboard inicial (concursos, preços, números em destaque)",
    )
    .option(
      "--window <number>",
      "Quantidade de concursos analisados (default 200)",
    );

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
        const summary = await loadHomeSummary({ windowSize, client: prisma });

        if (jsonMode !== "off") {
          printJsonPayload(summary, jsonMode);
          return;
        }

        printHeading("Indicadores principais");
        printKeyValueTable(
          summary.highlights.map((item) => [item.label, item.value]),
        );

        printHeading("Números em destaque");
        summary.topNumbers.forEach((item, index) => {
          const rank = String(index + 1).padStart(2, "0");
          const dezena = item.dezena.toString().padStart(2, "0");
          const hits = item.hits.toString().padStart(3, " ");
          const percentage = percentFormatter.format(item.percentage);
          const recency =
            item.contestsSinceLast === null
              ? "sem registros"
              : `${item.contestsSinceLast} concursos sem aparecer`;
          console.log(
            `${rank}. ${dezena} – ${hits} hits (${percentage}) · ${recency}`,
          );
        });

        printHeading("Resumo estatístico");
        printKeyValueTable([
          ["Concursos analisados", summary.totalDraws],
          ["Soma média", summary.averageSum],
          ["Distribuição par/ímpar", summary.paritySummary],
          [
            "Última sincronização",
            summary.lastSyncDate
              ? dateFormatter.format(summary.lastSyncDate)
              : "ainda não sincronizado",
          ],
        ]);
      });
    },
  );
}
