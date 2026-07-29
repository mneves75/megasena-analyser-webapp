#!/usr/bin/env bun

import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { GITLEAKS_IMAGE } from './security-tool-images';

function run(command: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function requireSuccess(result: { exitCode: number; stderr: string }, label: string): void {
  if (result.exitCode !== 0) {
    throw new Error(`${label} falhou: ${result.stderr.trim()}`);
  }
}

const rootResult = run(['git', 'rev-parse', '--show-toplevel'], process.cwd());
requireSuccess(rootResult, 'git rev-parse');

const repoRoot = rootResult.stdout.trim();
const filesResult = run(['git', 'ls-files', '-co', '--exclude-standard', '-z'], repoRoot);
requireSuccess(filesResult, 'git ls-files');

const sourceFiles = filesResult.stdout.split('\0').filter(Boolean);
if (sourceFiles.length === 0) {
  throw new Error('Nenhum arquivo fonte encontrado para secret scanning.');
}

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'megasena-secret-scan-'));

try {
  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(tempRoot, relativePath);
    try {
      await stat(sourcePath);
    } catch {
      continue;
    }
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  const scan = Bun.spawnSync(
    [
      'docker',
      'run',
      '--rm',
      '--network=none',
      '-v',
      `${tempRoot}:/repo:ro`,
      GITLEAKS_IMAGE,
      'dir',
      '/repo',
      '--no-banner',
      '--redact',
    ],
    { stdout: 'inherit', stderr: 'inherit' }
  );

  if (scan.exitCode !== 0) {
    process.exitCode = scan.exitCode;
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
