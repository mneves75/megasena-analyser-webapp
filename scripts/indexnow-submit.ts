#!/usr/bin/env bun
/**
 * Tell IndexNow engines (Bing and partners) which pages changed after new
 * contests were imported. Run it after `db:import-draws` has reached production.
 *
 * Pages that change when contest N arrives: its own page, the previous contest
 * (gains the "Próximo concurso" link), the year pages of both, the hubs, all 60
 * number pages (every current delay moves), and /mega-da-virada when N is an
 * edition. Nothing else is submitted.
 *
 * Usage:
 *   INDEXNOW_KEY=... bun run scripts/indexnow-submit.ts --contests 3061,3062 [--dry-run]
 * Env: INDEXNOW_KEY (required, same value the site serves at /indexnow-key.txt),
 *      NEXT_PUBLIC_BASE_URL, INDEXNOW_ENDPOINT, DATABASE_PATH (opened read-only).
 */

import { Database } from 'bun:sqlite';
import { MEGA_DA_VIRADA_CONDITION } from '@/lib/analytics/mega-da-virada';
import { BASE_URL } from '@/lib/constants';
import { resolveDatabasePath } from '@/lib/db-path';
import { ARCHIVE_DRIVEN_PATHS } from '@/lib/seo/archive-paths';
import { readIndexNowKey } from '@/lib/seo/indexnow';

const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const REQUEST_TIMEOUT_MS = 15_000;

class SubmitError extends Error {}

function fail(message: string): never {
  throw new SubmitError(message);
}

function parseContests(args: string[]): number[] {
  const index = args.indexOf('--contests');
  const value = index === -1 ? undefined : args[index + 1];
  if (!value || !/^[1-9]\d*(,[1-9]\d*)*$/.test(value)) {
    fail('Informe --contests com números de concurso separados por vírgula (ex.: --contests 3061,3062).');
  }
  return [...new Set(value.split(',').map(Number))].sort((a, b) => a - b);
}

/** Paths whose content changed when these contests were loaded. */
function changedPaths(contests: number[]): string[] {
  const db = new Database(resolveDatabasePath(), { readonly: true });
  const changed = new Set<string>(ARCHIVE_DRIVEN_PATHS);
  try {
    const find = db.prepare(
      `SELECT draw_date, ${MEGA_DA_VIRADA_CONDITION} AS mega_da_virada FROM draws WHERE contest_number = ?`
    );
    const previous = db.prepare(
      'SELECT contest_number, draw_date FROM draws WHERE contest_number < ? ORDER BY contest_number DESC LIMIT 1'
    );
    for (const contest of contests) {
      const row = find.get(contest) as { draw_date: string; mega_da_virada: number } | null;
      if (!row) {
        fail(`Concurso ${contest} não está no banco; importe-o antes de notificar.`);
      }
      changed.add(`/concurso/${contest}`);
      changed.add(`/resultados/${row.draw_date.slice(0, 4)}`);
      if (row.mega_da_virada) {
        changed.add('/mega-da-virada');
      }
      const before = previous.get(contest) as { contest_number: number; draw_date: string } | null;
      if (before) {
        changed.add(`/concurso/${before.contest_number}`);
        changed.add(`/resultados/${before.draw_date.slice(0, 4)}`);
      }
    }
  } finally {
    db.close();
  }
  for (let number = 1; number <= 60; number++) {
    changed.add(`/numeros/${number}`);
  }
  return [...changed];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const key = readIndexNowKey();
  if (key === null) {
    fail('INDEXNOW_KEY ausente ou inválida (8 a 128 caracteres entre A-Z, a-z, 0-9 e hífen).');
  }
  const base = BASE_URL.replace(/\/$/, '');
  const toUrl = (pagePath: string): string => (pagePath === '/' ? base : `${base}${pagePath}`);
  const payload = {
    host: new URL(base).host,
    key,
    keyLocation: `${base}/indexnow-key.txt`,
    urlList: changedPaths(parseContests(args)).map(toUrl),
  };
  const endpoint = process.env['INDEXNOW_ENDPOINT'] || DEFAULT_ENDPOINT;

  if (args.includes('--dry-run')) {
    console.log(JSON.stringify({ dryRun: true, endpoint, ...payload, key: '<redacted>' }, null, 2));
    return;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    fail(`Falha ao contatar o IndexNow (${endpoint}): ${error instanceof Error ? error.message : String(error)}`);
  }
  // 200 = accepted, 202 = accepted while the key file is still being validated.
  if (response.status !== 200 && response.status !== 202) {
    fail(`IndexNow respondeu ${response.status} ${response.statusText}.`);
  }
  console.log(JSON.stringify({ submitted: payload.urlList.length, status: response.status }));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof SubmitError ? error.message : error);
  process.exit(1);
}
