import { syncMegaSena } from "../src/services/sync";
import { logger } from "../src/lib/logger";

async function main() {
  validateDatabaseUrl();

  const args = new Set(process.argv.slice(2));
  const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
  const limit = limitArg
    ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
    : undefined;
  const fullBackfill = args.has("--full");

  const summary = await syncMegaSena({ fullBackfill, limit });
  logger.info(summary, "Resumo final da sincronização CLI");
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
