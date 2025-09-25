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
import { createSyncUI, SilentSyncUI } from "@/lib/console-ui";
import { syncMegaSena } from "@/services/sync";

export function shouldUseSilentSync(
  jsonMode: "off" | "compact" | "pretty",
  explicitSilent?: boolean,
): boolean {
  const ciFlag = process.env.CI;
  const isCi = typeof ciFlag === "string" && ciFlag !== "" && ciFlag !== "0";
  return Boolean(explicitSilent) || jsonMode !== "off" || isCi;
}

export function registerSyncCommand(program: Command) {
  const command = program
    .command("sync")
    .description(
      "Executa a sincronização de concursos (incremental ou full backfill)",
    )
    .option("--full", "Força backfill completo")
    .option("--limit <number>", "Limita a quantidade de concursos processados")
    .option("--verbose", "Exibe logs detalhados da sincronização")
    .option("--silent", "Executa sem barra de progresso (útil para CI)");

  registerJsonFlags(command);

  command.action(
    async (options: {
      full?: boolean;
      limit?: number;
      verbose?: boolean;
      silent?: boolean;
      json?: boolean;
      prettyJson?: boolean;
    }) => {
      const jsonMode = resolveJsonMode(options);
      const limit = parseOptionalInteger(options.limit, { min: 1 });
      const verbose = Boolean(options.verbose);
      const isPrettyJson = jsonMode === "pretty";
      const silent = shouldUseSilentSync(jsonMode, options.silent);
      const fullBackfill = Boolean(options.full);

      await withCliContext(async ({ prisma }) => {
        const ui = silent
          ? new SilentSyncUI(verbose)
          : createSyncUI({ verbose, pretty: isPrettyJson });

        const result = await syncMegaSena({
          fullBackfill,
          limit,
          client: prisma,
          ui,
        });

        if (jsonMode !== "off") {
          printJsonPayload(result, jsonMode);
          return;
        }

        const durationMs =
          result.finishedAt.getTime() - result.startedAt.getTime();
        const durationSeconds = Math.round(durationMs / 1000);

        printHeading("Resumo da sincronização");
        printKeyValueTable([
          ["Processados", result.processed],
          ["Inseridos", result.inserted],
          ["Atualizados", result.updated],
          ["Último concurso", result.latestConcurso ?? "não encontrado"],
          ["Início", result.startedAt.toISOString()],
          ["Fim", result.finishedAt.toISOString()],
          ["Duração (s)", durationSeconds],
        ]);
      });
    },
  );
}
