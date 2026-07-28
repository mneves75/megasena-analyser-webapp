import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the "R$ 0,00M / 0x" rows that appeared on
 * /dashboard/statistics when the historical prize breakdown was missing from
 * the database: a number that never shared a draw with a paid sena prize has an
 * UNDEFINED average, and must not be ranked as the worst below-average number.
 */
function runScenario(statements: string[]): {
  luckyNumbers: Array<{ number: number; correlationScore: number; prizeDrawCount: number }>;
  unluckyNumbers: Array<{ number: number; correlationScore: number; prizeDrawCount: number }>;
  all: Array<{ number: number; prizeDrawCount: number }>;
} {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-prize-'));
  const dbPath = path.join(tempDir, 'prize.db');

  try {
    const run = spawnSync(
      'bun',
      [
        '-e',
        [
          "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
          "const { PrizeCorrelationEngine } = await import('./lib/analytics/prize-correlation.ts');",
          'runMigrations();',
          'const db = getDatabase();',
          ...statements,
          'const engine = new PrizeCorrelationEngine();',
          'const sets = engine.getCorrelationSets(60, 60);',
          'const all = engine.getPrizeCorrelation();',
          "console.log('RESULT:' + JSON.stringify({ ...sets, all }));",
          'closeDatabase();',
        ].join(' '),
      ],
      {
        env: {
          ...process.env,
          DATABASE_PATH: dbPath,
          VITEST: '',
          VITEST_FORCE_FILE_DB: '1',
        },
        encoding: 'utf8',
      }
    );

    expect(run.status).toBe(0);
    const line = run.stdout.split('\n').find((entry) => entry.startsWith('RESULT:'));
    expect(line).toBeDefined();
    return JSON.parse(line!.slice('RESULT:'.length));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function insertDraw(
  contest: number,
  numbers: number[],
  prizeSena: number,
  winnersSena: number
): string {
  return (
    'db.prepare("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, ' +
    'number_4, number_5, number_6, prize_sena, winners_sena, prize_quina, winners_quina) VALUES (' +
    `${contest}, '2026-01-0${(contest % 9) + 1}', ${numbers.join(', ')}, ${prizeSena}, ${winnersSena}, 1000, 5)").run();`
  );
}

describe('PrizeCorrelationEngine (sqlite file)', () => {
  it('omits numbers that never appeared in a prize-paying draw from both sets', () => {
    // Numbers 1-6 win big, 7-12 win small, 13-18 only ever appear in draws that
    // paid nothing (the shape a database with no historical prize data takes).
    const result = runScenario([
      insertDraw(1, [1, 2, 3, 4, 5, 6], 100000, 1),
      insertDraw(2, [7, 8, 9, 10, 11, 12], 10000, 1),
      insertDraw(3, [13, 14, 15, 16, 17, 18], 0, 0),
    ]);

    const noPrizeObservation = result.all
      .filter((entry) => entry.prizeDrawCount === 0)
      .map((entry) => entry.number);

    expect(noPrizeObservation).toEqual(expect.arrayContaining([13, 14, 15, 16, 17, 18]));

    const ranked = [...result.luckyNumbers, ...result.unluckyNumbers].map((entry) => entry.number);
    for (const number of noPrizeObservation) {
      expect(ranked).not.toContain(number);
    }

    // The numbers that DO have observations are still ranked normally.
    expect(result.luckyNumbers.map((entry) => entry.number)).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6])
    );
    expect(result.unluckyNumbers.map((entry) => entry.number)).toEqual(
      expect.arrayContaining([7, 8, 9, 10, 11, 12])
    );
  });

  it('reports both sets empty when no draw carries prize data at all', () => {
    const result = runScenario([
      insertDraw(1, [1, 2, 3, 4, 5, 6], 0, 0),
      insertDraw(2, [7, 8, 9, 10, 11, 12], 0, 0),
    ]);

    expect(result.luckyNumbers).toEqual([]);
    expect(result.unluckyNumbers).toEqual([]);
  });
});
