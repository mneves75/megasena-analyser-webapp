import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('runMigrations retry (sqlite file)', () => {
  it('reapplies a failed migration and replaces its status with success', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-migration-retry-'));
    const dbPath = path.join(tempDir, 'test.db');
    const migrationsDir = path.join(tempDir, 'db', 'migrations');

    try {
      fs.symlinkSync(path.join(process.cwd(), 'lib'), path.join(tempDir, 'lib'), 'dir');
      fs.mkdirSync(migrationsDir, { recursive: true });
      fs.writeFileSync(
        path.join(migrationsDir, '001_recover.sql'),
        [
          'CREATE TABLE recovered (id INTEGER PRIMARY KEY);',
          'CREATE TABLE audit_logs (id TEXT PRIMARY KEY);',
          'CREATE TABLE log_events (id TEXT PRIMARY KEY);',
        ].join('\n')
      );

      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { Database } = require('bun:sqlite');",
            "const seeded = new Database(process.env.DATABASE_PATH);",
            "seeded.exec(\"CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'success', error_message TEXT)\");",
            "seeded.prepare(\"INSERT INTO migrations (name, status, error_message) VALUES (?, 'failed', ?)\").run('001_recover.sql', 'falha anterior');",
            'seeded.close();',
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const row = db.prepare(\"SELECT status, error_message FROM migrations WHERE name = '001_recover.sql'\").get();",
            "const recovered = db.prepare(\"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovered'\").get();",
            "console.log('RESULT:' + JSON.stringify({ row, recovered: Boolean(recovered) }));",
            'closeDatabase();',
          ].join(' '),
        ],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            DATABASE_PATH: dbPath,
            VITEST: '',
            VITEST_FORCE_FILE_DB: '1',
          },
          encoding: 'utf8',
        }
      );

      expect(run.status, run.stdout + run.stderr).toBe(0);
      const resultLine = run.stdout
        .split('\n')
        .find((line) => line.startsWith('RESULT:'));
      expect(resultLine).toBeTruthy();

      const result = JSON.parse(resultLine!.slice('RESULT:'.length)) as {
        row: { status: string; error_message: string | null };
        recovered: boolean;
      };
      expect(result).toEqual({
        row: { status: 'success', error_message: null },
        recovered: true,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses the complete image migration set when the mounted set is stale', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-stale-migrations-'));
    const dbPath = path.join(tempDir, 'test.db');
    const mountedMigrations = path.join(tempDir, 'db', 'migrations');
    const imageMigrations = path.join(tempDir, 'migrations-source');
    const baseMigration = [
      'CREATE TABLE audit_logs (id TEXT PRIMARY KEY);',
      'CREATE TABLE log_events (id TEXT PRIMARY KEY);',
    ].join('\n');

    try {
      fs.symlinkSync(path.join(process.cwd(), 'lib'), path.join(tempDir, 'lib'), 'dir');
      fs.mkdirSync(mountedMigrations, { recursive: true });
      fs.mkdirSync(imageMigrations, { recursive: true });
      fs.writeFileSync(path.join(mountedMigrations, '001_base.sql'), baseMigration);
      fs.writeFileSync(path.join(imageMigrations, '001_base.sql'), baseMigration);
      fs.writeFileSync(
        path.join(imageMigrations, '010_cache_revision.sql'),
        'CREATE TABLE cache_revisions (revision INTEGER NOT NULL); INSERT INTO cache_revisions VALUES (0);'
      );

      const run = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { runMigrations, getDatabase, closeDatabase } = await import('./lib/db.ts');",
            'runMigrations();',
            'const db = getDatabase();',
            "const row = db.prepare('SELECT revision FROM cache_revisions').get();",
            "console.log('RESULT:' + JSON.stringify(row));",
            'closeDatabase();',
          ].join(' '),
        ],
        {
          cwd: tempDir,
          env: {
            ...process.env,
            DATABASE_PATH: dbPath,
            VITEST: '',
            VITEST_FORCE_FILE_DB: '1',
          },
          encoding: 'utf8',
        }
      );

      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(run.stdout).toContain('RESULT:{"revision":0}');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
