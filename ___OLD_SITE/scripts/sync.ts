// Register server-only stub before importing server-only modules
import "../scripts/dev/register-server-only-stub.js";

import { syncMegaSena } from "../src/services/sync";
import { logger } from "../src/lib/logger";
import { createSyncUI } from "../src/lib/console-ui";

async function main() {
  try {
    validateDatabaseUrl();

    const args = new Set(process.argv.slice(2));
    const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
    const limit = limitArg
      ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
      : undefined;
    const fullBackfill = args.has("--full");
    const verbose = args.has("--verbose");
    const pretty = process.env.LOG_PRETTY === "1";

    // Create rich console UI for interactive terminals
    const ui = createSyncUI({ verbose, pretty });

    const summary = await syncMegaSena({ fullBackfill, limit, ui });
    logger.info(summary, "Resumo final da sincronização CLI");
  } catch (error) {
    // Show error in rich format if possible
    const ui = createSyncUI();
    if (error instanceof Error) {
      ui.showError(error);
    }
    throw error;
  }
}

main().catch((error) => {
  logger.error({ error }, "Erro ao executar sync CLI");
  process.exit(1);
});

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definido. Configure o .env antes de rodar o sync.",
    );
  }

  if (!url.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL esperado com protocolo 'file:'. Valor atual: ${url}. Verifique se cada variável está em sua própria linha no .env`,
    );
  }
}
