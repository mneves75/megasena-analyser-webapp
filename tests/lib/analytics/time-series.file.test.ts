import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runWithFileDatabase(script: string): unknown {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-time-series-'));
  const dbPath = path.join(tempDir, 'analytics.db');

  try {
    const run = spawnSync('bun', ['-e', script], {
      env: {
        ...process.env,
        DATABASE_PATH: dbPath,
        VITEST: '',
        VITEST_FORCE_FILE_DB: '1',
      },
      encoding: 'utf8',
    });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);

    const resultLine = run.stdout
      .split('\n')
      .find((line) => line.startsWith('RESULT:'));

    expect(resultLine).toBeTruthy();
    return JSON.parse(resultLine!.slice('RESULT:'.length)) as unknown;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('analytics dates (sqlite file)', () => {
  it('returns non-null yearly and monthly frequency buckets for ISO dates', () => {
    const result = runWithFileDatabase(
      [
        "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
        "const { TimeSeriesEngine } = await import('./lib/analytics/time-series.ts');",
        'runMigrations();',
        'const db = getDatabase();',
        "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
        "insert.run(1, '2025-12-31', 1, 2, 3, 4, 5, 6);",
        "insert.run(2, '2026-01-07', 1, 7, 8, 9, 10, 11);",
        "insert.run(3, '2026-01-14', 12, 13, 14, 15, 16, 17);",
        'const engine = new TimeSeriesEngine();',
        "console.log('RESULT:' + JSON.stringify({ yearly: engine.getFrequencyTimeSeries([1], 'yearly'), monthly: engine.getFrequencyTimeSeries([1], 'monthly') }));",
        'closeDatabase();',
      ].join(' ')
    ) as {
      yearly: Array<{ period: string; num_1: number }>;
      monthly: Array<{ period: string; num_1: number }>;
    };

    expect(result.yearly).toEqual([
      { period: '2025', num_1: 1 },
      { period: '2026', num_1: 1 },
    ]);
    expect(result.monthly).toEqual([
      { period: '2025-12', num_1: 1 },
      { period: '2026-01', num_1: 1 },
    ]);
  });

  it('buckets multi-number frequencies by quarter (Q1/Q2/Q3/Q4)', () => {
    const result = runWithFileDatabase(
      [
        "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
        "const { TimeSeriesEngine } = await import('./lib/analytics/time-series.ts');",
        'runMigrations();',
        'const db = getDatabase();',
        "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
        "insert.run(1, '2026-01-05', 1, 2, 3, 4, 5, 6);",
        "insert.run(2, '2026-04-19', 1, 7, 8, 9, 10, 11);",
        "insert.run(3, '2026-08-02', 12, 13, 14, 15, 16, 17);",
        "insert.run(4, '2026-11-25', 1, 12, 18, 19, 20, 21);",
        'const engine = new TimeSeriesEngine();',
        "console.log('RESULT:' + JSON.stringify(engine.getFrequencyTimeSeries([1, 12], 'quarterly')));",
        'closeDatabase();',
      ].join(' ')
    ) as Array<{ period: string; num_1: number; num_12: number }>;

    expect(result).toEqual([
      { period: '2026-Q1', num_1: 1, num_12: 0 },
      { period: '2026-Q2', num_1: 1, num_12: 0 },
      { period: '2026-Q3', num_1: 0, num_12: 1 },
      { period: '2026-Q4', num_1: 1, num_12: 1 },
    ]);
  });

  it('aggregates multi-number frequencies with zero-filled periods (GROUP BY rewrite)', () => {
    const result = runWithFileDatabase(
      [
        "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
        "const { TimeSeriesEngine } = await import('./lib/analytics/time-series.ts');",
        'runMigrations();',
        'const db = getDatabase();',
        "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
        "insert.run(1, '2026-01-05', 1, 2, 3, 4, 5, 6);",
        "insert.run(2, '2026-01-19', 1, 7, 8, 9, 10, 11);",
        "insert.run(3, '2026-02-02', 12, 13, 14, 15, 16, 17);",
        'const engine = new TimeSeriesEngine();',
        "console.log('RESULT:' + JSON.stringify(engine.getFrequencyTimeSeries([1, 12, 60], 'monthly')));",
        'closeDatabase();',
      ].join(' ')
    ) as Array<{ period: string; num_1: number; num_12: number; num_60: number }>;

    expect(result).toEqual([
      { period: '2026-01', num_1: 2, num_12: 0, num_60: 0 },
      { period: '2026-02', num_1: 0, num_12: 1, num_60: 0 },
    ]);
  });

  it('uses contest order for the last matching draw instead of lexical date order', () => {
    const result = runWithFileDatabase(
      [
        "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
        "const { StatisticsEngine } = await import('./lib/analytics/statistics.ts');",
        'runMigrations();',
        'const db = getDatabase();',
        "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
        "insert.run(1, '31/12/2024', 1, 2, 3, 4, 5, 6);",
        "insert.run(2, '14/07/2026', 7, 8, 9, 10, 11, 12);",
        "console.log('RESULT:' + JSON.stringify(new StatisticsEngine().detectPatterns()));",
        'closeDatabase();',
      ].join(' ')
    ) as Array<{ type: string; lastSeen: string | null }>;

    expect(result.find((pattern) => pattern.type === 'consecutive')?.lastSeen).toBe('14/07/2026');
  });
});
