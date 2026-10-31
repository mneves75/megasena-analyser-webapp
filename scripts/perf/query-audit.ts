/**
 * Query audit of the shared API handler on a realistic, disposable SQLite DB.
 * Captures every SQL statement each page-facing GET route prepares, its
 * EXPLAIN QUERY PLAN, rows returned and wall time on bun:sqlite.
 *
 *   DATABASE_PATH=.scratch/perf/query-audit.db bun run db:migrate
 *   DATABASE_PATH=.scratch/perf/query-audit.db bun run db:import-draws db/seed/draws.json
 *   DATABASE_PATH=.scratch/perf/query-audit.db bun run scripts/perf/query-audit.ts --label baseline
 *
 * bun:sqlite exposes no rows-read counter: a SCAN of a table reads every row of
 * it, so the report carries the table sizes for that estimate. The production
 * Durable Object runs the same handler on its SQLite storage.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stringArg } from './matrix';

const ROUTES = [
  '/api/dashboard',
  '/api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true',
  '/api/draws',
  '/api/draws?year=2026',
  '/api/draws?contest=3065',
  '/api/draws?view=mega-da-virada',
  '/api/numbers',
  '/api/numbers?n=10',
  '/api/sitemap',
  '/api/health',
] as const;

interface Captured { sql: string; calls: number }

async function main(): Promise<void> {
  const label = stringArg(process.argv.slice(2), '--label', 'adhoc');
  const databasePath = process.env['DATABASE_PATH'] ?? '';
  if (!path.resolve(databasePath).startsWith(path.resolve('.scratch'))) {
    throw new Error('DATABASE_PATH deve apontar para um banco descartável dentro de .scratch/.');
  }
  const { getDatabase } = await import('@/lib/db');
  const { createApiHandler } = await import('@/lib/api/handler');
  const database = getDatabase();
  let current: Map<string, Captured> | null = null;
  const prepare = database.prepare.bind(database);
  (database as unknown as { prepare: typeof prepare }).prepare = ((sql: string) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (current) {
      const entry = current.get(normalized) ?? { sql: normalized, calls: 0 };
      entry.calls += 1;
      current.set(normalized, entry);
    }
    return prepare(sql);
  }) as typeof prepare;

  const tables = Object.fromEntries((prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
    .map(({ name }) => [name, (prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n]));

  const handler = createApiHandler({ environment: 'test', appVersion: 'query-audit', audit: () => {} });
  const report = [];
  for (const route of ROUTES) {
    for (const pass of ['cold', 'warm'] as const) {
      current = new Map();
      const started = performance.now();
      const response = await handler.fetch(new Request(`http://localhost${route}`), { internal: true, clientIp: null });
      const body = await response.text();
      const wallMs = Math.round((performance.now() - started) * 10) / 10;
      const captured = [...current.values()];
      current = null;
      const plans = captured.filter(entry => /^\s*(SELECT|WITH)\b/i.test(entry.sql)).map((entry) => {
        let plan: string[] = [];
        try {
          plan = (prepare(`EXPLAIN QUERY PLAN ${entry.sql}`).all(...Array(countParams(entry.sql)).fill(1)) as { detail: string }[])
            .map(row => row.detail);
        } catch (error) {
          plan = [`(plano indisponível: ${error instanceof Error ? error.message : String(error)})`];
        }
        return { ...entry, plan, scans: plan.filter(detail => /^SCAN\b/.test(detail)) };
      });
      report.push({ route, pass, status: response.status, wallMs, responseBytes: body.length,
        statements: captured.length, writes: captured.filter(e => !/^\s*(SELECT|WITH)\b/i.test(e.sql)).map(e => e.sql.slice(0, 120)),
        selects: plans });
      process.stderr.write(`${route} ${pass}: ${response.status} ${wallMs} ms, ${captured.length} statements\n`);
    }
  }
  const outDir = path.join('docs/perf/raw', label);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'query-audit.json'), `${JSON.stringify({
    tool: 'scripts/perf/query-audit.ts', measuredAt: new Date().toISOString(), runtime: `bun ${Bun.version}`,
    tables, routes: report,
  }, null, 1)}\n`);
  console.log('| route | pass | status | wall ms | statements | SCAN plans |');
  console.log('|---|---|---:|---:|---:|---|');
  for (const row of report) {
    const scans = [...new Set(row.selects.flatMap(select => select.scans))];
    console.log(`| ${row.route.slice(0, 40)} | ${row.pass} | ${row.status} | ${row.wallMs} | ${row.statements} | ${scans.join('; ').slice(0, 160)} |`);
  }
}

function countParams(sql: string): number {
  return (sql.replace(/'[^']*'/g, '').match(/\?/g) ?? []).length;
}

if (import.meta.main) await main();
