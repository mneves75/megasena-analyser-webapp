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
  BETTING_LIMIT_KEYS,
  getBettingLimits,
  resetBettingLimits,
  upsertBettingLimits,
} from "@/services/strategy-limits";

const LIMIT_KEYS = new Set(BETTING_LIMIT_KEYS);

export function registerLimitsCommand(program: Command) {
  const command = program
    .command("limits")
    .description("Inspeciona ou altera limites operacionais do motor");

  command
    .option("--show", "Exibe limites atuais (default)")
    .option("--reset", "Restaura limites padrão")
    .option("--set <chave=valor...>", "Define overrides temporários")
    .option("--history [n]", "Mostra últimos ajustes de auditoria (default 5)")
    .option("--actor <nome>", "Nome do responsável registrado na auditoria")
    .option("--note <texto>", "Observação opcional para auditoria")
    .option("--origin <texto>", "Origem do ajuste (default cli)");

  registerJsonFlags(command);

  command.action(async (options: Record<string, unknown>) => {
    const jsonMode = resolveJsonMode(options);
    const shouldReset = Boolean(options["reset"]);
    const origin = options["origin"] ? String(options["origin"]) : "cli";
    const actor = options["actor"] ? String(options["actor"]) : undefined;
    const note = options["note"] ? String(options["note"]) : undefined;
    const historyOption = options["history"];
    let historyCount = 0;
    if (historyOption !== undefined && historyOption !== false) {
      historyCount =
        historyOption === true
          ? 5
          : (parseOptionalInteger(historyOption, { min: 0 }) ?? 0);
    }
    const overrides = parseSetOverrides(options["set"]);

    if (shouldReset && Object.keys(overrides).length > 0) {
      throw new Error("Use --reset ou --set, não ambos no mesmo comando");
    }

    await withCliContext(async ({ prisma }) => {
      if (shouldReset) {
        await resetBettingLimits({
          client: prisma,
          audit: { origin, actor, note },
        });
      }

      if (Object.keys(overrides).length > 0) {
        await upsertBettingLimits(overrides, {
          client: prisma,
          audit: { origin, actor, note },
        });
      }

      const limits = await getBettingLimits({ client: prisma });

      const history =
        historyCount > 0
          ? await prisma.bettingLimitAudit.findMany({
              orderBy: { created_at: "desc" },
              take: historyCount,
            })
          : [];

      if (jsonMode !== "off") {
        printJsonPayload({ limits, history }, jsonMode);
        return;
      }

      printHeading("Limites de aposta");
      printKeyValueTable(
        Object.entries(limits).map(([key, value]) => [key, value]),
      );

      if (history.length > 0) {
        printHeading("Histórico recente");
        history.forEach((entry) => {
          console.log(
            `- ${entry.created_at.toISOString()} · origin=${entry.origin} actor=${entry.actor ?? "(não informado)"}`,
          );
          if (entry.note) {
            console.log(`  nota: ${entry.note}`);
          }
          console.log(`  overrides: ${JSON.stringify(entry.overrides)}`);
        });
      }
    });
  });
}

function parseSetOverrides(value: unknown) {
  if (!value) {
    return {} as Record<string, number>;
  }

  const entries = Array.isArray(value) ? value : [value];
  const overrides: Record<string, number> = {};

  for (const entry of entries) {
    const raw = String(entry);
    const [key, rawValue] = raw.split("=");
    if (!key || rawValue === undefined) {
      throw new Error(`Override inválido: ${raw}. Use chave=valor.`);
    }
    if (!LIMIT_KEYS.has(key as (typeof BETTING_LIMIT_KEYS)[number])) {
      throw new Error(
        `Chave inválida '${key}'. Valores permitidos: ${BETTING_LIMIT_KEYS.join(", ")}`,
      );
    }
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Valor inválido para ${key}: ${rawValue}`);
    }
    overrides[key] = parsed;
  }

  return overrides;
}
