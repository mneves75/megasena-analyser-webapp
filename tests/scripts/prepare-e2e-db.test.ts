import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

// A fixture command must never delete an inherited real database or accept a
// caller-selected path outside its disposable test directory, including symlinks.
it('refuses a database path outside the disposable fixture directory', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-safety-'));
  const database = path.join(directory, 'sentinel.db');
  try {
    fs.writeFileSync(database, 'DO_NOT_DELETE');
    const result = spawnSync('bun', ['run', 'scripts/prepare-e2e-db.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: database, E2E_DATABASE_PATH: database },
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(result.status, result.stdout + result.stderr).not.toBe(0);
    expect(fs.readFileSync(database, 'utf8')).toBe('DO_NOT_DELETE');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
