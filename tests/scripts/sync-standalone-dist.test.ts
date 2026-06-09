// @vitest-environment node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/sync-standalone-dist.ts');
const bunBinary = process.env['BUN_BIN'] || 'bun';
const tempDirs: string[] = [];

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function createTempWorkspace(): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'megasena-standalone-'));
  tempDirs.push(tempDir);
  return tempDir;
}

describe('scripts/sync-standalone-dist.ts', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it('sincroniza o standalone e remove artefatos locais de banco', async () => {
    const workspace = await createTempWorkspace();

    await fs.mkdir(path.join(workspace, '.next', 'standalone', '.next'), { recursive: true });
    await fs.mkdir(path.join(workspace, '.next', 'standalone', 'db', 'backups'), { recursive: true });
    await fs.mkdir(path.join(workspace, '.next', 'static', 'chunks'), { recursive: true });

    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'server.js'), 'console.log("ok");');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', '.next', 'BUILD_ID'), 'build-id');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'mega-sena.db'), 'db');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'mega-sena.db-shm'), 'db');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'mega-sena.db-wal'), 'db');
    await fs.writeFile(path.join(workspace, '.next', 'standalone', 'db', 'backups', 'backup.db'), 'db');
    await fs.writeFile(path.join(workspace, '.next', 'static', 'chunks', 'main.js'), 'chunk');

    const result = spawnSync(bunBinary, ['run', scriptPath], {
      cwd: workspace,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(await pathExists(path.join(workspace, 'dist', 'standalone', 'server.js'))).toBe(true);
    expect(await pathExists(path.join(workspace, 'dist', 'standalone', '.next', 'BUILD_ID'))).toBe(true);
    expect(await pathExists(path.join(workspace, 'dist', 'standalone', '.next', 'static', 'chunks', 'main.js'))).toBe(true);
    expect(await pathExists(path.join(workspace, 'dist', 'standalone', 'db', 'mega-sena.db'))).toBe(false);
    expect(await pathExists(path.join(workspace, 'dist', 'standalone', 'db', 'backups', 'backup.db'))).toBe(false);
  });

  it('falha com mensagem clara quando o build ainda não existe', async () => {
    const workspace = await createTempWorkspace();

    const result = spawnSync(bunBinary, ['run', scriptPath], {
      cwd: workspace,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Execute "bun run build" antes de preparar o dist.');
  });

  it('bloqueia standalone com rewrite de API contaminado por porta temporária', async () => {
    const workspace = await createTempWorkspace();

    await fs.mkdir(path.join(workspace, '.next', 'standalone'), { recursive: true });
    await fs.mkdir(path.join(workspace, '.next', 'static'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, '.next', 'standalone', 'server.js'),
      '{"destination":"http://localhost:3211/api/:path*"}'
    );

    const result = spawnSync(bunBinary, ['run', scriptPath], {
      cwd: workspace,
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Standalone com rewrite de API para localhost:3211');
    expect(result.stderr).toContain('sem API_PORT temporário');
  });
});
