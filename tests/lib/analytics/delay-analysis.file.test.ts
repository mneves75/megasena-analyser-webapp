import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('DelayAnalysisEngine (sqlite file)', () => {
  it('uses the number of locally available draws instead of raw contest ids', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-delay-'));
    const dbPath = path.join(tempDir, 'delay.db');

    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { DelayAnalysisEngine } = await import('./lib/analytics/delay-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const insert = db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)\");",
            "insert.run(2900, '2025-01-01', 1, 2, 3, 4, 5, 6);",
            "insert.run(2901, '2025-01-08', 7, 8, 9, 10, 11, 12);",
            "insert.run(2902, '2025-01-15', 13, 14, 15, 16, 17, 18);",
            "const row = new DelayAnalysisEngine().getNumberDelays().find((item) => item.number === 1);",
            "console.log('RESULT:' + JSON.stringify(row));",
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

      const resultLine = run.stdout
        .split('\n')
        .find((line) => line.startsWith('RESULT:'));

      expect(resultLine).toBeTruthy();

      const parsed = JSON.parse(resultLine!.slice('RESULT:'.length)) as {
        delayDraws: number;
        averageDelay: number;
      };

      expect(parsed.delayDraws).toBe(2);
      expect(parsed.averageDelay).toBe(3);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
