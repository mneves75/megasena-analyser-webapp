import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'scripts', 'backup-database.ts');

function createDatabase(dbPath: string, marker: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const run = spawnSync(
    'bun',
    [
      '-e',
      [
        "const { Database } = require('bun:sqlite');",
        'const database = new Database(process.env.TEST_DATABASE_PATH);',
        "database.exec('CREATE TABLE marker (value TEXT NOT NULL)');",
        "database.prepare('INSERT INTO marker (value) VALUES (?)').run(process.env.TEST_MARKER);",
        'database.close();',
      ].join(' '),
    ],
    {
      env: {
        ...process.env,
        TEST_DATABASE_PATH: dbPath,
        TEST_MARKER: marker,
      },
      encoding: 'utf8',
    }
  );
  if (run.status !== 0) {
    throw new Error(run.stdout + run.stderr);
  }
}

function runBackup(
  cwd: string,
  env: Record<string, string | undefined> = {}
): ReturnType<typeof spawnSync> {
  return spawnSync('bun', [scriptPath], {
    cwd,
    env: {
      ...process.env,
      BACKUP_RETENTION_DAYS: '7',
      BACKUP_MAX_COUNT: '5',
      ...env,
    },
    encoding: 'utf8',
  });
}

function readBackupMarker(backupPath: string): string {
  const run = spawnSync(
    'bun',
    [
      '-e',
      [
        "const { Database } = require('bun:sqlite');",
        'const database = new Database(process.env.TEST_DATABASE_PATH, { readonly: true });',
        "const row = database.prepare('SELECT value FROM marker').get();",
        "if (!row) throw new Error('Backup sem marcador');",
        "console.log('RESULT:' + row.value);",
        'database.close();',
      ].join(' '),
    ],
    {
      env: {
        ...process.env,
        TEST_DATABASE_PATH: backupPath,
      },
      encoding: 'utf8',
    }
  );
  if (run.status !== 0) {
    throw new Error(run.stdout + run.stderr);
  }
  return run.stdout.trim().replace(/^RESULT:/, '');
}

describe('backup-database script', () => {
  it('uses a seven-day rolling retention by default', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-backup-default-'));
    const dbPath = path.join(tempDir, 'db', 'mega-sena.db');
    const backupDir = path.join(tempDir, 'db', 'backups');
    const oldBackup = path.join(
      backupDir,
      'mega-sena-backup-2000-01-01T00-00-00.db'
    );

    try {
      createDatabase(dbPath, 'origem');
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(oldBackup, 'expirado');
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldBackup, eightDaysAgo, eightDaysAgo);
      const childEnv: NodeJS.ProcessEnv = { ...process.env };
      delete childEnv['BACKUP_RETENTION_DAYS'];
      delete childEnv['BACKUP_MAX_COUNT'];

      const run = spawnSync('bun', [scriptPath], {
        cwd: tempDir,
        env: childEnv,
        encoding: 'utf8',
      });

      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(fs.existsSync(oldBackup)).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['BACKUP_RETENTION_DAYS', '0'],
    ['BACKUP_RETENTION_DAYS', '1.5'],
    ['BACKUP_MAX_COUNT', '-1'],
    ['BACKUP_MAX_COUNT', 'abc'],
  ])('aborts before creating or deleting files when %s=%s', (name, value) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-backup-config-'));
    const dbPath = path.join(tempDir, 'db', 'mega-sena.db');
    const backupDir = path.join(tempDir, 'db', 'backups');
    const sentinelPath = path.join(backupDir, 'mega-sena-backup-2000-01-01T00-00-00.db');

    try {
      createDatabase(dbPath, 'origem');
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(sentinelPath, 'não remover');
      const before = fs.readdirSync(backupDir);

      const run = runBackup(tempDir, { [name]: value });

      expect(run.status).not.toBe(0);
      expect(run.stdout + run.stderr).toContain(
        `${name} deve ser um número inteiro positivo`
      );
      expect(fs.readdirSync(backupDir)).toEqual(before);
      expect(fs.readFileSync(sentinelPath, 'utf8')).toBe('não remover');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps the fresh backup after count-based cleanup', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-backup-fresh-'));
    const dbPath = path.join(tempDir, 'db', 'mega-sena.db');
    const backupDir = path.join(tempDir, 'db', 'backups');

    try {
      createDatabase(dbPath, 'backup fresco');
      fs.mkdirSync(backupDir, { recursive: true });
      const oldBackup = path.join(
        backupDir,
        'mega-sena-backup-2000-01-01T00-00-00.db'
      );
      fs.writeFileSync(oldBackup, 'antigo');
      fs.utimesSync(oldBackup, new Date(0), new Date(0));

      const run = runBackup(tempDir, { BACKUP_MAX_COUNT: '1' });

      expect(run.status, run.stdout + run.stderr).toBe(0);
      const backups = fs.readdirSync(backupDir);
      expect(backups).toHaveLength(1);
      const freshBackup = path.join(backupDir, backups[0]!);
      expect(fs.existsSync(freshBackup)).toBe(true);
      expect(readBackupMarker(freshBackup)).toBe('backup fresco');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('backs up the database selected by DATABASE_PATH', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mega-sena-backup-path-'));
    const defaultDbPath = path.join(tempDir, 'db', 'mega-sena.db');
    const selectedDbPath = path.join(tempDir, 'custom', 'selected.db');
    const backupDir = path.join(tempDir, 'db', 'backups');

    try {
      createDatabase(defaultDbPath, 'banco padrão');
      createDatabase(selectedDbPath, 'banco selecionado');

      const run = runBackup(tempDir, { DATABASE_PATH: selectedDbPath });

      expect(run.status, run.stdout + run.stderr).toBe(0);
      expect(run.stdout + run.stderr).toContain(path.resolve(selectedDbPath));
      const backups = fs.readdirSync(backupDir);
      expect(backups).toHaveLength(1);
      expect(readBackupMarker(path.join(backupDir, backups[0]!))).toBe(
        'banco selecionado'
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
