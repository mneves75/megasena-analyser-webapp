#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';
import path from 'node:path';

type HealthPayload = {
  status?: unknown;
  version?: unknown;
  database?: {
    connected?: unknown;
    totalDraws?: unknown;
    lastContestNumber?: unknown;
    lastDrawDate?: unknown;
    dataReady?: unknown;
  };
};

type CheckOptions = {
  baseUrl: string;
  expectedVersion: string;
  timeoutMs: number;
  minTotalDraws: number;
  maxDrawAgeDays: number;
};

type CheckResult = {
  healthUrl: string;
  observedVersion: string;
  totalDraws: number | null;
  lastContestNumber: number | null;
  lastDrawDate: string | null;
};

const DEFAULT_BASE_URL = 'https://megasena-analyzer.com.br';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MIN_TOTAL_DRAWS = 3000;
const DEFAULT_MAX_DRAW_AGE_DAYS = 21;

export function buildHealthUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = '/api/health';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function validateHealthPayload(
  payload: HealthPayload,
  expectedVersion: string,
  options: { minTotalDraws?: number; maxDrawAgeDays?: number; now?: Date } = {}
): CheckResult {
  if (payload.status !== 'healthy') {
    throw new Error(`Produção não está saudável: status=${String(payload.status)}`);
  }

  if (payload.database?.connected !== true) {
    throw new Error('Produção não confirma conexão ativa com o banco.');
  }

  if (typeof payload.version !== 'string' || payload.version.length === 0) {
    throw new Error('Produção não retornou versão válida em /api/health.');
  }

  if (payload.version !== expectedVersion) {
    throw new Error(
      `Produção está desatualizada: esperado ${expectedVersion}, observado ${payload.version}.`
    );
  }

  const totalDraws =
    typeof payload.database.totalDraws === 'number' && Number.isFinite(payload.database.totalDraws)
      ? payload.database.totalDraws
      : null;
  const lastContestNumber =
    typeof payload.database.lastContestNumber === 'number' &&
    Number.isFinite(payload.database.lastContestNumber)
      ? payload.database.lastContestNumber
      : null;
  const lastDrawDate =
    typeof payload.database.lastDrawDate === 'string' && payload.database.lastDrawDate.length > 0
      ? payload.database.lastDrawDate
      : null;
  const minTotalDraws = options.minTotalDraws ?? DEFAULT_MIN_TOTAL_DRAWS;
  if (totalDraws === null || totalDraws < minTotalDraws) {
    throw new Error(
      `Banco de produção incompleto: esperado ao menos ${minTotalDraws} concursos, observado ${String(totalDraws)}.`
    );
  }

  const maxDrawAgeDays = options.maxDrawAgeDays ?? DEFAULT_MAX_DRAW_AGE_DAYS;
  if (lastDrawDate === null) {
    throw new Error('Produção não retornou data do último concurso em /api/health.');
  }
  const drawDateMs = Date.parse(lastDrawDate);
  if (Number.isNaN(drawDateMs)) {
    throw new Error(`Produção retornou data inválida para o último concurso: ${lastDrawDate}.`);
  }
  const nowMs = (options.now ?? new Date()).getTime();
  const ageDays = (nowMs - drawDateMs) / (24 * 60 * 60 * 1000);
  if (ageDays > maxDrawAgeDays) {
    throw new Error(
      `Banco de produção está stale: último concurso em ${lastDrawDate}, limite ${maxDrawAgeDays} dias.`
    );
  }

  return {
    healthUrl: '',
    observedVersion: payload.version,
    totalDraws,
    lastContestNumber,
    lastDrawDate,
  };
}

export async function readPackageVersion(packageJsonPath = path.join(process.cwd(), 'package.json')) {
  const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { version?: unknown };
  if (typeof pkg.version !== 'string' || pkg.version.trim().length === 0) {
    throw new Error('package.json não contém uma versão válida.');
  }
  return pkg.version.trim();
}

export async function checkProductionFreshness(options: CheckOptions): Promise<CheckResult> {
  const healthUrl = buildHealthUrl(options.baseUrl);
  const response = await fetch(healthUrl, {
    headers: {
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`GET ${healthUrl} falhou com HTTP ${response.status}.`);
  }

  const result = validateHealthPayload((await response.json()) as HealthPayload, options.expectedVersion, {
    minTotalDraws: options.minTotalDraws,
    maxDrawAgeDays: options.maxDrawAgeDays,
  });
  return {
    ...result,
    healthUrl,
  };
}

async function main(): Promise<void> {
  const expectedVersion = process.env['EXPECTED_VERSION'] || (await readPackageVersion());
  const baseUrl = process.env['PRODUCTION_BASE_URL'] || DEFAULT_BASE_URL;
  const timeoutMs = Number(process.env['PRODUCTION_CHECK_TIMEOUT_MS'] || DEFAULT_TIMEOUT_MS);
  const minTotalDraws = Number(process.env['PRODUCTION_MIN_TOTAL_DRAWS'] || DEFAULT_MIN_TOTAL_DRAWS);
  const maxDrawAgeDays = Number(process.env['PRODUCTION_MAX_DRAW_AGE_DAYS'] || DEFAULT_MAX_DRAW_AGE_DAYS);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('PRODUCTION_CHECK_TIMEOUT_MS deve ser um número positivo.');
  }
  if (!Number.isFinite(minTotalDraws) || minTotalDraws <= 0) {
    throw new Error('PRODUCTION_MIN_TOTAL_DRAWS deve ser um número positivo.');
  }
  if (!Number.isFinite(maxDrawAgeDays) || maxDrawAgeDays <= 0) {
    throw new Error('PRODUCTION_MAX_DRAW_AGE_DAYS deve ser um número positivo.');
  }

  const result = await checkProductionFreshness({
    baseUrl,
    expectedVersion,
    timeoutMs,
    minTotalDraws,
    maxDrawAgeDays,
  });

  console.log(`Produção atualizada: ${result.observedVersion}`);
  console.log(`Health check: ${result.healthUrl}`);
  if (result.totalDraws !== null) {
    console.log(`Concursos no banco: ${result.totalDraws}`);
  }
  if (result.lastContestNumber !== null && result.lastDrawDate !== null) {
    console.log(`Último concurso: #${result.lastContestNumber} (${result.lastDrawDate})`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
