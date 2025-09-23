import process from "node:process";

import { Prisma } from "@prisma/client";

import { childLogger } from "../src/lib/logger";
import { prisma } from "../src/lib/prisma";
import {
  BETTING_LIMIT_KEYS,
  DEFAULT_BETTING_LIMITS,
  getBettingLimits,
  resetBettingLimits,
  upsertBettingLimits,
  type BettingLimits,
  type BettingLimitAuditContext,
  type BettingLimitKey,
  type LimitOverrides,
} from "../src/services/strategy-limits";

const logger = childLogger({ service: "limits-cli" });

async function main() {
  validateDatabaseUrl();

  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const setArgs: Record<string, number> = {};
  let show = false;
  let reset = false;
  let historyCount: number | undefined;
  let actor: string | undefined;
  let note: string | undefined;
  let origin = "cli";

  for (const arg of args) {
    if (arg === "--show") {
      show = true;
      continue;
    }
    if (arg === "--reset") {
      reset = true;
      continue;
    }
    if (arg.startsWith("--set=")) {
      const payload = arg.substring("--set=".length);
      const [key, value] = payload.split("=");
      applySetArg(setArgs, key, value);
      continue;
    }
    if (arg.startsWith("--actor=")) {
      actor = arg.substring("--actor=".length).trim() || undefined;
      continue;
    }
    if (arg.startsWith("--note=")) {
      note = arg.substring("--note=".length).trim() || undefined;
      continue;
    }
    if (arg.startsWith("--origin=")) {
      origin = arg.substring("--origin=".length).trim() || "cli";
      continue;
    }
    if (arg.startsWith("--history")) {
      const [, raw] = arg.split("=");
      historyCount = raw ? Number.parseInt(raw, 10) : 5;
      if (!Number.isFinite(historyCount) || historyCount <= 0) {
        throw new Error("--history requer número positivo");
      }
      continue;
    }
    throw new Error(`Argumento desconhecido: ${arg}`);
  }

  if (reset && Object.keys(setArgs).length > 0) {
    throw new Error("Use --reset ou --set, não ambos no mesmo comando");
  }

  const auditContext: BettingLimitAuditContext = {
    origin,
    actor,
    note,
  };

  if (reset) {
    const result = await resetBettingLimits({
      client: prisma,
      audit: auditContext,
    });
    logger.info({ limits: result }, "Limites resetados para padrão");
    show = true;
  }

  if (Object.keys(setArgs).length > 0) {
    const overrides = buildOverrides(setArgs);
    const result = await upsertBettingLimits(overrides, {
      client: prisma,
      audit: auditContext,
    });
    logger.info({ limits: result }, "Limites atualizados com sucesso");
    show = true;
  }

  if (show || (args.length === 0 && !historyCount)) {
    const limits = await getBettingLimits({ client: prisma });
    printLimits(limits);
  }

  if (historyCount) {
    await printAuditHistory(historyCount);
  }
}

function applySetArg(
  target: Record<string, number>,
  key: string,
  value?: string,
) {
  if (!key || value === undefined) {
    throw new Error("Argumento --set deve seguir o formato --set=chave=valor");
  }

  if (
    !BETTING_LIMIT_KEYS.includes(key as (typeof BETTING_LIMIT_KEYS)[number])
  ) {
    throw new Error(
      `Chave inválida '${key}'. Valores permitidos: ${BETTING_LIMIT_KEYS.join(", ")}`,
    );
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Valor inválido para ${key}: ${value}`);
  }

  target[key] = parsed;
}

function buildOverrides(source: Record<string, number>): LimitOverrides {
  const overrides: LimitOverrides = {};
  for (const [key, value] of Object.entries(source)) {
    overrides[key as BettingLimitKey] = value;
  }
  return overrides;
}

function printLimits(limits: BettingLimits) {
  const entries = Object.entries(limits)
    .map(([key, value]) => `${key.padEnd(20, " ")}: ${value}`)
    .join("\n");
  console.log("Limites atuais:\n" + entries);
}

async function printAuditHistory(count: number) {
  const entries = await prisma.bettingLimitAudit.findMany({
    orderBy: { created_at: "desc" },
    take: count,
  });
  if (entries.length === 0) {
    console.log("Nenhum registro de auditoria encontrado.");
    return;
  }

  console.log("\nHistórico recente:");
  for (const entry of entries) {
    const timestamp = entry.created_at.toISOString();
    const actor = entry.actor ?? "(não informado)";
    const origin = entry.origin;
    const overrides = entry.overrides
      ? JSON.stringify(entry.overrides, null, 2)
      : "{}";
    const note = entry.note ? `\n  nota: ${entry.note}` : "";
    console.log(`- ${timestamp} — origin=${origin} actor=${actor}${note}`);
    console.log(`  overrides: ${overrides}`);
  }
}

function validateDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definido. Configure o .env antes de rodar o script de limites.",
    );
  }

  if (!url.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL esperado com protocolo 'file:'. Valor atual: ${url}. Verifique se cada variável está em sua própria linha no .env`,
    );
  }
}

function printHelp() {
  console.log(`CLI de limites de aposta

Uso: npm run limits -- [opções]

Opções:
  --show                 Exibe limites atuais (padrão quando nenhum argumento é fornecido)
  --set=chave=valor      Define override numérico (pode ser usado múltiplas vezes)
  --reset                Remove overrides e volta aos valores padrão
  --actor=nome           Registra responsável pela alteração
  --note=texto           Comentário opcional para auditoria
  --origin=fonte         Origem da alteração (default: cli)
  --history[=N]          Mostra N últimos registros de auditoria (default: 5)
  --help, -h             Exibe esta ajuda

Chaves válidas: ${BETTING_LIMIT_KEYS.join(", ")}
Valores padrão: ${JSON.stringify(DEFAULT_BETTING_LIMITS, null, 2)}
`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ code: error.code, meta: error.meta }, error.message);
    } else {
      logger.error({ error }, "Erro ao executar CLI de limites");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
