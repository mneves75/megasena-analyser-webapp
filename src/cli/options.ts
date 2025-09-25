import type { Command } from "commander";

import type { JsonMode } from "@/cli/output";

export function registerJsonFlags(command: Command) {
  return command
    .option("--json", "emite payload em JSON compacto")
    .option("--pretty-json", "emite payload em JSON identado");
}

export function resolveJsonMode(options: {
  json?: boolean;
  prettyJson?: boolean;
}): JsonMode {
  if (options.prettyJson) {
    return "pretty";
  }
  if (options.json) {
    return "compact";
  }
  return "off";
}

export function parseOptionalInteger(
  value: unknown,
  { min, max }: { min?: number; max?: number } = {},
): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Valor numérico inválido: ${value}`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`Valor deve ser >= ${min}: ${parsed}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`Valor deve ser <= ${max}: ${parsed}`);
  }
  return parsed;
}

export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "on", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`Valor booleano inválido: ${value}`);
}

export function parseAmountToCents(
  value: unknown,
  { minCents = 0 }: { minCents?: number } = {},
): number {
  if (value === null || value === undefined || value === "") {
    throw new Error("Informe um valor monetário válido");
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    if (cents < minCents) {
      throw new Error(`Valor deve ser >= ${(minCents / 100).toFixed(2)}`);
    }
    return cents;
  }

  const raw = String(value).trim().replace(/\s+/g, "");
  const normalized = raw.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor monetário inválido: ${value}`);
  }
  const cents = Math.round(parsed * 100);
  if (cents < minCents) {
    throw new Error(`Valor deve ser >= ${(minCents / 100).toFixed(2)}`);
  }
  return cents;
}

export function parseOptionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const raw = typeof value === "string" ? value.trim() : String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida: ${value}`);
  }
  return parsed;
}
