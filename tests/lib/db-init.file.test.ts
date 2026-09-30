import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Failure modes: an out-of-range application ID is silently stored as zero;
// rewriting the ID on every open prevents WAL readers during an active writer.
describe('database initialization under WAL contention', () => {
  it('stores a signed application ID and opens while another connection is writing', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-db-init-'));
    try {
      const run = spawnSync('bun', ['-e', `
        import { Database } from 'bun:sqlite';
        import { getDatabase, closeDatabase } from './lib/db.ts';
        const first = getDatabase();
        const signature = first.prepare('PRAGMA application_id').get().application_id;
        if (signature !== (0xA17E6D42 | 0)) throw new Error('Application ID was not persisted');
        first.exec('CREATE TABLE fixture (value INTEGER)');
        closeDatabase();
        const writer = new Database(process.env.DATABASE_PATH);
        writer.exec('BEGIN IMMEDIATE; INSERT INTO fixture VALUES (1)');
        try {
          const reader = getDatabase();
          const row = reader.prepare('SELECT COUNT(*) count FROM fixture').get();
          if (row.count !== 0) throw new Error('Reader saw an uncommitted write');
          console.log('WAL_READER_OK');
        } finally {
          closeDatabase();
          writer.exec('ROLLBACK');
          writer.close();
        }
      `], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: path.join(directory, 'test.db'), VITEST: '', VITEST_FORCE_FILE_DB: '1' },
        encoding: 'utf8',
        timeout: 15000,
      });
      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(run.stdout).toContain('WAL_READER_OK');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
