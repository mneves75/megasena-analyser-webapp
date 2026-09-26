import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * End-to-end tests for `scripts/import-draws.ts`, the CLI that syncs a live
 * database from the versioned seed (db/seed/draws.json) without replacing the
 * file. Each test runs the real CLI under Bun against a temporary SQLite file.
 *
 * Failure modes it must handle (written before the implementation):
 * 1. missing or unreadable input file              → exit 1, DB unchanged
 * 2. malformed JSON                                 → exit 1, DB unchanged
 * 3. schema violations (range, duplicates, count, date format, negatives)
 *                                                   → exit 1, whole batch rejected
 * 4. the same contest twice in the payload          → exit 1
 * 5. an existing contest whose date or numbers differ from the payload
 *                                                   → exit 1, DB unchanged (divergence)
 * 6. a result that would leave a gap in the contest sequence → exit 1, rolled back
 * 7. --dry-run                                      → reports the plan, writes nothing
 * 8. rerun with the same payload                    → no-op (idempotent)
 * 9. successful import                              → derived caches recomputed and
 *                                                     the cache revision bumped
 */

interface SeedDraw {
  contest: number;
  date: string;
  numbers: number[];
  prizeSena: number | null;
  winnersSena: number;
  prizeQuina: number | null;
  winnersQuina: number;
  prizeQuadra: number | null;
  winnersQuadra: number;
  totalCollection: number | null;
  accumulated: boolean;
  accumulatedValue: number | null;
  nextEstimatedPrize: number | null;
  specialDraw: boolean;
}

interface DbState {
  count: number;
  maxContest: number | null;
  frequencySum: number;
  revision: number | null;
  prizeQuinaOf2: number | null;
}

const REPO = process.cwd();

function draw(contest: number, date: string, numbers: number[], overrides: Partial<SeedDraw> = {}): SeedDraw {
  return {
    contest,
    date,
    numbers,
    prizeSena: 0,
    winnersSena: 0,
    prizeQuina: 40_000,
    winnersQuina: 50,
    prizeQuadra: 900,
    winnersQuadra: 3_000,
    totalCollection: 40_000_000,
    accumulated: true,
    accumulatedValue: 5_000_000,
    nextEstimatedPrize: 10_000_000,
    specialDraw: false,
    ...overrides,
  };
}

const BASE: SeedDraw[] = [
  draw(1, '2026-05-02', [4, 12, 23, 31, 45, 58]),
  draw(2, '2026-05-04', [1, 9, 18, 27, 36, 54]),
  draw(3, '2026-05-06', [6, 14, 22, 30, 38, 46]),
];
const NEW: SeedDraw[] = [
  draw(4, '2026-05-08', [3, 11, 19, 28, 37, 55]),
  draw(5, '2026-05-10', [7, 15, 24, 33, 42, 60]),
];

let tempDir: string;
let dbPath: string;

function bun(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync('bun', args, {
    cwd: REPO,
    env: { ...process.env, DATABASE_PATH: dbPath, VITEST: '', NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

function seedDatabase(draws: SeedDraw[]): void {
  const script = [
    "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
    "const { StatisticsEngine } = await import('./lib/analytics/statistics.ts');",
    'runMigrations();',
    'const db = getDatabase();',
    "const insert = db.prepare('INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, prize_quina, prize_quadra, winners_quina) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');",
    `for (const d of ${JSON.stringify(draws)}) insert.run(d.contest, d.date, ...d.numbers, d.prizeSena, d.prizeQuina, d.prizeQuadra, d.winnersQuina);`,
    'new StatisticsEngine().updateNumberFrequencies();',
    'closeDatabase();',
  ].join('\n');
  const result = bun(['-e', script]);
  expect(result.status, result.stderr).toBe(0);
}

function readState(): DbState {
  const script = [
    "const { Database } = require('bun:sqlite');",
    `const db = new Database(${JSON.stringify(dbPath)}, { readonly: true });`,
    "const draws = db.prepare('SELECT COUNT(*) AS count, MAX(contest_number) AS maxContest FROM draws').get();",
    "const freq = db.prepare('SELECT COALESCE(SUM(frequency), 0) AS s FROM number_frequency').get();",
    "const rev = db.prepare(\"SELECT revision FROM cache_revisions WHERE name = 'draws'\").get();",
    "const two = db.prepare('SELECT prize_quina FROM draws WHERE contest_number = 2').get();",
    'console.log(JSON.stringify({ count: draws.count, maxContest: draws.maxContest, frequencySum: freq.s, revision: rev?.revision ?? null, prizeQuinaOf2: two?.prize_quina ?? null }));',
  ].join('\n');
  const result = bun(['-e', script]);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim().split('\n').at(-1) ?? '{}') as DbState;
}

function writePayload(content: unknown, raw = false): string {
  const file = path.join(tempDir, `payload-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, raw ? String(content) : JSON.stringify(content));
  return file;
}

function importDraws(file: string, ...flags: string[]) {
  return bun(['run', 'scripts/import-draws.ts', file, ...flags]);
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-import-'));
  dbPath = path.join(tempDir, 'import.db');
  seedDatabase(BASE);
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('import-draws CLI (sqlite file)', () => {
  it('rejects a missing input file without touching the database', () => {
    const before = readState();
    const result = importDraws(path.join(tempDir, 'nope.json'));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Não foi possível ler/);
    expect(readState()).toEqual(before);
  });

  it('rejects malformed JSON', () => {
    const before = readState();
    const result = importDraws(writePayload('{"contest": 4', true));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/JSON inválido/);
    expect(readState()).toEqual(before);
  });

  it.each([
    ['a number above 60', draw(4, '2026-05-08', [3, 11, 19, 28, 37, 61])],
    ['a repeated number', draw(4, '2026-05-08', [3, 3, 19, 28, 37, 55])],
    ['five numbers', draw(4, '2026-05-08', [3, 11, 19, 28, 37])],
    ['a DD/MM/YYYY date', draw(4, '08/05/2026', [3, 11, 19, 28, 37, 55])],
    ['negative winners', draw(4, '2026-05-08', [3, 11, 19, 28, 37, 55], { winnersQuina: -1 })],
    ['a fractional contest', draw(4.5, '2026-05-08', [3, 11, 19, 28, 37, 55])],
  ])('rejects the whole batch when an entry has %s', (_label, bad) => {
    const before = readState();
    const result = importDraws(writePayload([...BASE, NEW[1], bad]));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Entrada inválida/);
    expect(readState()).toEqual(before);
  });

  it('rejects a payload that lists the same contest twice', () => {
    const before = readState();
    const result = importDraws(writePayload([...BASE, NEW[0], NEW[0]]));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/duplicad/i);
    expect(readState()).toEqual(before);
  });

  it('refuses to import when an existing contest diverges from the payload', () => {
    const before = readState();
    const diverged = draw(2, '2026-05-04', [1, 9, 18, 27, 36, 53]);
    const result = importDraws(writePayload([BASE[0], diverged, BASE[2], ...NEW]));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/diverg/i);
    expect(readState()).toEqual(before);
  });

  it('rolls back an import that would leave a gap in the contest sequence', () => {
    const before = readState();
    const result = importDraws(writePayload([...BASE, NEW[1]]));
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toMatch(/lacuna|gap/i);
    expect(readState()).toEqual(before);
  });

  it('reports the plan on --dry-run and writes nothing', () => {
    const before = readState();
    const result = importDraws(writePayload([...BASE, ...NEW]), '--dry-run');
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"toInsert":[4,5]');
    expect(readState()).toEqual(before);
  });

  it('inserts only the missing contests, recomputes caches and is idempotent', () => {
    const before = readState();
    // Contest 2 carries a different prize in the payload: prizes are never
    // rewritten by this append-only import, only reported.
    const payload = [BASE[0], { ...BASE[1], prizeQuina: 99_999 }, BASE[2], ...NEW];

    const first = importDraws(writePayload(payload));
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain('"inserted":2');
    expect(first.stdout).toContain('"prizeDifferences":[2]');
    const after = readState();
    expect(after.count).toBe(5);
    expect(after.maxContest).toBe(5);
    expect(after.frequencySum).toBe(30);
    expect(after.revision).not.toBe(before.revision);
    expect(after.prizeQuinaOf2).toBe(before.prizeQuinaOf2);

    const second = importDraws(writePayload(payload));
    expect(second.status, second.stderr).toBe(0);
    expect(second.stdout).toContain('"inserted":0');
    expect(readState()).toEqual(after);
  });
});
