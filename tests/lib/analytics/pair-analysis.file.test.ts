import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('PairAnalysisEngine (sqlite file)', () => {
  it('returns an empty result and does not rebuild an empty cache while reading', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-pairs-'));
    const dbPath = path.join(tempDir, 'pairs.db');

    try {
      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            "const { PairAnalysisEngine } = await import('./lib/analytics/pair-analysis.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "db.prepare(\"INSERT INTO draws (contest_number, draw_date, number_1, number_2, number_3, number_4, number_5, number_6, prize_sena, winners_sena) VALUES (1, '2026-01-01', 1, 2, 3, 4, 5, 6, 0, 0)\").run();",
            'const pairs = new PairAnalysisEngine().getNumberPairs();',
            "const cache = db.prepare('SELECT COUNT(*) as count FROM number_pair_frequency').get();",
            "console.log('RESULT:' + JSON.stringify({ pairs, cacheCount: cache.count }));",
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
      expect(run.stderr).toContain('analytics.pair_cache_empty');

      const resultLine = run.stdout
        .split('\n')
        .find((line) => line.startsWith('RESULT:'));
      expect(resultLine).toBeTruthy();

      const result = JSON.parse(resultLine!.slice('RESULT:'.length)) as {
        pairs: unknown[];
        cacheCount: number;
      };
      expect(result).toEqual({ pairs: [], cacheCount: 0 });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
