#!/usr/bin/env bun
/**
 * Tell IndexNow engines (Bing and partners) which pages changed after new
 * contests were imported. Run it after `db:import-draws` has reached production.
 *
 * Pages that change when contest N arrives: its own page, the previous contest
 * (gains the "Próximo concurso" link), the year pages of both, the hubs, and all
 * 60 number pages (every current delay moves). Nothing else is submitted.
 *
 * Usage:
 *   INDEXNOW_KEY=... bun run scripts/indexnow-submit.ts --contests 3061,3062 [--dry-run]
 * Env: INDEXNOW_KEY (required, same value the site serves at /indexnow-key.txt),
 *      NEXT_PUBLIC_BASE_URL, INDEXNOW_ENDPOINT, DATABASE_PATH (read-only).
 */

import path from 'node:path';
import { Database } from 'bun:sqlite';

const DEFAULT_ENDPOINT = 'https://api.indexnow.org/indexnow';
const DEFAULT_BASE_URL = 'https://megasena-analyzer.com.br';
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

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

function main(): Promise<void> | void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const key = (process.env['INDEXNOW_KEY'] ?? '').trim();
  if (!KEY_PATTERN.test(key)) {
    fail('INDEXNOW_KEY ausente ou inválida (8 a 128 caracteres entre A-Z, a-z, 0-9 e hífen).');
  }
  const contests = parseContests(args);

  const base = (process.env['NEXT_PUBLIC_BASE_URL'] || DEFAULT_BASE_URL).replace(/\/$/, '');
  const url = (pagePath: string): string => (pagePath === '/' ? base : `${base}${pagePath}`);
  const dbPath = process.env['DATABASE_PATH']
    ? path.resolve(process.env['DATABASE_PATH'])
    : path.join(process.cwd(), 'db', 'mega-sena.db');

  const db = new Database(dbPath, { readonly: true });
  const changed = new Set<string>(['/', '/resultados', '/numeros', '/dashboard', '/dashboard/statistics']);
  try {
    const find = db.prepare('SELECT draw_date FROM draws WHERE contest_number = ?');
    const previous = db.prepare(
      'SELECT contest_number, draw_date FROM draws WHERE contest_number < ? ORDER BY contest_number DESC LIMIT 1'
    );
    for (const contest of contests) {
      const row = find.get(contest) as { draw_date: string } | null;
      if (!row) {
        fail(`Concurso ${contest} não está no banco; importe-o antes de notificar.`);
      }
      changed.add(`/concurso/${contest}`);
      changed.add(`/resultados/${row.draw_date.slice(0, 4)}`);
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

  const payload = {
    host: new URL(base).host,
    key,
    keyLocation: `${base}/indexnow-key.txt`,
    urlList: [...changed].map(url),
  };
  const endpoint = process.env['INDEXNOW_ENDPOINT'] || DEFAULT_ENDPOINT;

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, endpoint, ...payload, key: '<redacted>' }, null, 2));
    return;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  }).then((response) => {
    // 200 = accepted, 202 = accepted while the key file is still being validated.
    if (response.status !== 200 && response.status !== 202) {
      fail(`IndexNow respondeu ${response.status} ${response.statusText}.`);
    }
    console.log(JSON.stringify({ submitted: payload.urlList.length, status: response.status }));
  });
}

try {
  await main();
} catch (error) {
  console.error(error instanceof SubmitError ? error.message : error);
  process.exit(1);
}
