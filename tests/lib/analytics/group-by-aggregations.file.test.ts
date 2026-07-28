import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('grouped analytics (sqlite file)', () => {
  it('preserves manually verified decade, prime, and pair results', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-grouped-'));
    const dbPath = path.join(tempDir, 'analytics.db');

    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { StatisticsEngine } = await import('./lib/analytics/statistics.ts');",
            "const { DecadeAnalysisEngine } = await import('./lib/analytics/decade-analysis.ts');",
            "const { PrimeAnalysisEngine } = await import('./lib/analytics/prime-analysis.ts');",
            "const { PairAnalysisEngine } = await import('./lib/analytics/pair-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
            "insert.run(1, '2026-01-01', 1, 2, 3, 11, 12, 13);",
            "insert.run(2, '2026-01-08', 1, 2, 7, 21, 22, 23);",
            "insert.run(3, '2026-01-15', 1, 17, 27, 37, 47, 57);",
            'new StatisticsEngine().updateNumberFrequencies();',
            'const pairEngine = new PairAnalysisEngine();',
            'pairEngine.updatePairFrequencies();',
            'const decades = new DecadeAnalysisEngine().getDecadeDistribution();',
            'const primes = new PrimeAnalysisEngine().getPrimeDistribution();',
            'const pairs = pairEngine.getNumberPairs(2);',
            "console.log('RESULT:' + JSON.stringify({ decades, primes, pairs }));",
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

      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);

      const resultLine = run.stdout
        .split('\n')
        .find((line) => line.startsWith('RESULT:'));
      expect(resultLine).toBeTruthy();

      const result = JSON.parse(resultLine!.slice('RESULT:'.length)) as {
        decades: Array<{
          decade: string;
          totalOccurrences: number;
          topNumbers: Array<{ number: number; frequency: number }>;
        }>;
        primes: {
          averagePrimesPerDraw: number;
          mostCommonCount: number;
          distribution: Array<{ primeCount: number; occurrences: number }>;
          primeFrequencies: Array<{ number: number; frequency: number }>;
        };
        pairs: Array<{
          pair: [number, number];
          frequency: number;
          expectedFrequency: number;
          correlation: number;
          lastSeenContest: number | null;
        }>;
      };

      expect(result.decades.map((decade) => decade.totalOccurrences)).toEqual([7, 4, 4, 1, 1, 1]);
      expect(result.decades[0]?.topNumbers).toEqual([
        { number: 1, frequency: 3 },
        { number: 2, frequency: 2 },
        { number: 3, frequency: 1 },
      ]);
      expect(result.primes.averagePrimesPerDraw).toBeCloseTo(10 / 3);
      expect(result.primes.mostCommonCount).toBe(3);
      expect(result.primes.distribution.slice(0, 2)).toEqual([
        { primeCount: 3, occurrences: 2, percentage: 66.67 },
        { primeCount: 4, occurrences: 1, percentage: 33.33 },
      ]);
      expect(result.primes.primeFrequencies[0]).toMatchObject({ number: 2, frequency: 2 });
      // Number 1 appears in 3 of the 3 draws, number 2 in 2 of them, so the
      // per-draw marginals are 3/3 and 2/3. Drawing is without replacement:
      //   3 * (3/3) * (2/3) * (5/6) * (60/59) = 1.6949 -> 1.69
      //   correlation = 2 / 1.6949 = 1.18
      // The previous expectation of 0.83 / 2.4 came from squaring per-slot
      // probabilities and multiplying by the 15 pairs in a draw, which
      // understates the expectation by ~2,03x. Sanity check: under a uniform
      // history this formula reduces to totalDraws * (6/60) * (5/59), the exact
      // hypergeometric value.
      expect(result.pairs).toEqual([
        {
          pair: [1, 2],
          frequency: 2,
          expectedFrequency: 1.69,
          correlation: 1.18,
          lastSeenContest: 2,
          lastSeenDate: '2026-01-08',
        },
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
