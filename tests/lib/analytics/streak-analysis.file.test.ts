import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * `getHotStreaks()` sorts by intensity DESCENDING, which is correct for the hot
 * list and inverted for the cold one. Slicing that order directly returned the
 * LEAST cold entries under the "Números Frios (Baixa Intensidade)" heading.
 */
describe('StreakAnalysisEngine (sqlite file)', () => {
  it('returns cold numbers ordered from coldest, not from the least cold', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-streaks-'));
    const dbPath = path.join(tempDir, 'streaks.db');

    try {
      // Window of 4 recent draws over a 12-draw history. Numbers 1-6 appear in
      // every recent draw (hot). Numbers 7-12 appear in one recent draw
      // (partially cold). Numbers 13-18 appear in none (coldest).
      const statements: string[] = [];
      for (let contest = 1; contest <= 8; contest++) {
        statements.push(
          'db.prepare("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, ' +
            'number_4, number_5, number_6, prize_sena, winners_sena) VALUES (' +
            `${contest}, '2026-01-01', 7, 8, 9, 10, 11, 12, 0, 0)").run();`
        );
      }
      for (let contest = 9; contest <= 10; contest++) {
        statements.push(
          'db.prepare("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, ' +
            'number_4, number_5, number_6, prize_sena, winners_sena) VALUES (' +
            `${contest}, '2026-02-01', 13, 14, 15, 16, 17, 18, 0, 0)").run();`
        );
      }
      for (let contest = 11; contest <= 14; contest++) {
        statements.push(
          'db.prepare("INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, ' +
            'number_4, number_5, number_6, prize_sena, winners_sena) VALUES (' +
            `${contest}, '2026-03-01', 1, 2, 3, 4, 5, 6, 0, 0)").run();`
        );
      }

      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { StreakAnalysisEngine } = await import('./lib/analytics/streak-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            ...statements,
            'const engine = new StreakAnalysisEngine(4);',
            'const sets = engine.getStreakSets(10, 60);',
            "console.log('RESULT:' + JSON.stringify(sets));",
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

      const sets = JSON.parse(line!.slice('RESULT:'.length)) as {
        hotNumbers: Array<{ number: number; streakIntensity: number }>;
        coldNumbers: Array<{
          number: number;
          streakIntensity: number;
          lastDrawnContest: number | null;
        }>;
      };

      expect(sets.coldNumbers.length).toBeGreaterThan(0);

      const intensities = sets.coldNumbers.map((entry) => entry.streakIntensity);
      const ascending = [...intensities].sort((a, b) => a - b);
      expect(intensities).toEqual(ascending);

      // Hot numbers stay ordered from the highest intensity.
      const hotIntensities = sets.hotNumbers.map((entry) => entry.streakIntensity);
      expect(hotIntensities).toEqual([...hotIntensities].sort((a, b) => b - a));
      expect(sets.coldNumbers.find((entry) => entry.number === 13)?.lastDrawnContest).toBe(10);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('handles an empty database and uses the effective window size', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-streaks-empty-'));
    const dbPath = path.join(tempDir, 'streaks.db');
    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { StreakAnalysisEngine } = await import('./lib/analytics/streak-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            'const empty = new StreakAnalysisEngine(10).getHotStreaks();',
            "db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (1, '2026-01-01', 1, 2, 3, 4, 5, 6, 0, 0)\").run();",
            'const oneDraw = new StreakAnalysisEngine(10).getHotStreaks();',
            "console.log('RESULT:' + JSON.stringify({ empty, numberOne: oneDraw.find((entry) => entry.number === 1) }));",
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
      const result = JSON.parse(line!.slice('RESULT:'.length)) as {
        empty: unknown[];
        numberOne: { trend: string; streakIntensity: number };
      };
      expect(result.empty).toEqual([]);
      expect(result.numberOne).toMatchObject({ trend: 'normal', streakIntensity: 1 });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
