import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('balanced generation covers all 60 numbers when frequencies tie', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-balanced-'));
  try {
    const run = spawnSync('bun', ['-e', `
      import { runMigrations, closeDatabase } from './lib/db.ts';
      import { BetGenerator } from './lib/analytics/bet-generator.ts';
      runMigrations();
      const result = new BetGenerator().generateOptimizedBets(60, 'optimized', 'balanced');
      console.log('RESULT:' + JSON.stringify({
        coverage: new Set(result.bets.flatMap(bet => bet.numbers)).size,
        totalNumbers: result.totalNumbers,
        cost: result.totalCost,
        count: result.bets.length,
      }));
      closeDatabase();
    `], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: path.join(directory, 'test.db'), VITEST: '', VITEST_FORCE_FILE_DB: '1' },
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(run.status, run.stdout + run.stderr).toBe(0);
    const line = run.stdout.split('\n').find((value) => value.startsWith('RESULT:'));
    expect(JSON.parse(line?.slice(7) ?? '{}')).toEqual({ coverage: 60, totalNumbers: 60, cost: 60, count: 10 });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
