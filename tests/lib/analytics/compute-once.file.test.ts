import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('compute-once analytics (sqlite file)', () => {
  it('derives prize, streak, and delay subsets from one complete result', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-compute-once-'));
    const dbPath = path.join(tempDir, 'analytics.db');

    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { PrizeCorrelationEngine } = await import('./lib/analytics/prize-correlation.ts');",
            "const { StreakAnalysisEngine } = await import('./lib/analytics/streak-analysis.ts');",
            "const { DelayAnalysisEngine } = await import('./lib/analytics/delay-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena, prize_quina, winners_quina) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\");",
            "insert.run(1, '2026-01-01', 1, 2, 3, 4, 5, 6, 100, 1, 40, 1);",
            "insert.run(2, '2026-01-08', 1, 7, 8, 9, 10, 11, 200, 0, 80, 2);",
            "insert.run(3, '2026-01-15', 1, 12, 13, 14, 15, 16, 300, 2, 120, 0);",
            "insert.run(4, '2026-01-22', 17, 18, 19, 20, 21, 22, 400, 1, 160, 1);",
            'const prizeEngine = new PrizeCorrelationEngine();',
            'const correlations = prizeEngine.getPrizeCorrelation();',
            'const correlationSets = prizeEngine.getCorrelationSets(60, 60);',
            'const expectedLucky = correlations.filter((item) => item.correlationScore > 1).slice(0, 60);',
            'const expectedUnlucky = correlations.filter((item) => item.correlationScore < 1).sort((a, b) => a.correlationScore - b.correlationScore).slice(0, 60);',
            'const streakEngine = new StreakAnalysisEngine(2);',
            'const streaks = streakEngine.getHotStreaks();',
            'const streakSets = streakEngine.getStreakSets(60, 60);',
            "const expectedHot = streaks.filter((item) => item.trend === 'hot').slice(0, 60);",
            "const expectedCold = streaks.filter((item) => item.trend === 'cold').slice(0, 60);",
            'const delayEngine = new DelayAnalysisEngine();',
            'const delays = delayEngine.getNumberDelays();',
            "delayEngine.getNumberDelays = () => { throw new Error('unexpected recompute'); };",
            'const distribution = delayEngine.getDelayDistribution(delays);',
            "console.log('RESULT:' + JSON.stringify({ prize: JSON.stringify(correlationSets) === JSON.stringify({ luckyNumbers: expectedLucky, unluckyNumbers: expectedUnlucky }), streak: JSON.stringify(streakSets) === JSON.stringify({ hotNumbers: expectedHot, coldNumbers: expectedCold }), delayTotal: distribution.reduce((sum, item) => sum + item.count, 0) }));",
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
        prize: boolean;
        streak: boolean;
        delayTotal: number;
      };
      expect(result).toEqual({ prize: true, streak: true, delayTotal: 60 });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
