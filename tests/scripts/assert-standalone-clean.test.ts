// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/assert-standalone-clean.ts');
const bunBinary = process.env['BUN_BIN'] || 'bun';
const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'megasena-standalone-clean-'));
  tempDirs.push(tempDir);
  return tempDir;
}

describe('scripts/assert-standalone-clean.ts', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('aceita standalone sem artefatos SQLite locais', async () => {
    const workspace = await createTempWorkspace();
    await fs.mkdir(path.join(workspace, '.next', 'standalone', 'db', 'migrations'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(workspace, '.next', 'standalone', 'db', 'migrations', '001_initial_schema.sql'),
      'create table ok(id text);'
    );

    const result = spawnSync(bunBinary, ['run', scriptPath], {
      cwd: workspace,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Standalone limpo');
  });

  it('falha quando o standalone contém banco ou backup local', async () => {
    const workspace = await createTempWorkspace();
    await fs.mkdir(path.join(workspace, '.next', 'standalone', 'db', 'backups'), {
      recursive: true,
    });
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'mega-sena.db'), 'db');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'mega-sena.db-wal'), 'wal');
    await fs.writeFile(
      path.join(workspace, '.next', 'standalone', 'db', 'backups', 'backup.db'),
      'backup'
    );

    const result = spawnSync(bunBinary, ['run', scriptPath], {
      cwd: workspace,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Standalone contém artefatos SQLite locais');
    expect(result.stderr).toContain('db/mega-sena.db');
    expect(result.stderr).toContain('db/mega-sena.db-wal');
    expect(result.stderr).toContain('db/backups/backup.db');
  });
});
