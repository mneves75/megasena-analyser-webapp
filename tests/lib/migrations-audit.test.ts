import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('runMigrations (sqlite file)', () => {
  it('creates audit_logs/log_events and records migrations 004/005/006', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-db-'));
    const dbPath = path.join(tempDir, 'test.db');

    try {
      const migrate = spawnSync('bun', ['run', 'scripts/migrate.ts'], {
        env: {
          ...process.env,
          DATABASE_PATH: dbPath,
          VITEST: '',
          VITEST_FORCE_FILE_DB: '1',
        },
        encoding: 'utf8',
      });

      expect(migrate.status).toBe(0);

      const verify = spawnSync(
        'bun',
        [
          '-e',
          [
            "const { Database } = require('bun:sqlite');",
            "const db = new Database(process.env.DATABASE_PATH);",
            "const columns = db.prepare('PRAGMA table_info(audit_logs)').all();",
            "if (!columns.length) process.exit(2);",
            "const auditColumns = db.prepare('PRAGMA table_info(audit_logs)').all();",
            "const logColumns = db.prepare('PRAGMA table_info(log_events)').all();",
            "if (!auditColumns.length || !logColumns.length) process.exit(2);",
            "if (auditColumns.some((col) => col.name === 'deleted_at')) process.exit(5);",
            "if (logColumns.some((col) => col.name === 'deleted_at')) process.exit(6);",
            "const applied = db.prepare(\"SELECT name FROM migrations WHERE status = 'success'\").all();",
            "if (!applied.some((row) => row.name === '004_audit_logs.sql')) process.exit(3);",
            "if (!applied.some((row) => row.name === '005_log_events.sql')) process.exit(4);",
            "if (!applied.some((row) => row.name === '006_remove_deleted_at.sql')) process.exit(7);",
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

      expect(verify.status).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
