#!/usr/bin/env bun

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const standaloneRoot = path.join(process.cwd(), '.next', 'standalone');
const forbiddenDbPattern = /\.(db|sqlite)(?:-(?:shm|wal))?$|\.db(?:-(?:shm|wal))?$|\.bak$|\.backup$/i;
// node_modules may legitimately ship sample SQLite fixtures and is huge; the
// contract targets the app's own local database state, never vendored files.
const SKIPPED_DIRS = new Set(['node_modules']);

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectForbiddenFiles(dir: string, root = dir): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...(await collectForbiddenFiles(entryPath, root)));
      continue;
    }

    if (forbiddenDbPattern.test(entry.name)) {
      files.push(path.relative(root, entryPath));
    }
  }

  return files.sort();
}

async function main(): Promise<void> {
  if (!(await pathExists(standaloneRoot))) {
    throw new Error(`Output standalone não encontrado em ${standaloneRoot}. Execute "bun run build".`);
  }

  // Scan the entire standalone tree (not just db/) so a database configured via
  // a non-default DATABASE_PATH cannot land outside db/ and ship undetected.
  const forbiddenFiles = await collectForbiddenFiles(standaloneRoot);
  if (forbiddenFiles.length > 0) {
    throw new Error(
      [
        'Standalone contém artefatos SQLite locais traçados pelo build:',
        ...forbiddenFiles.map((file) => `- ${file}`),
        'Configure outputFileTracingExcludes ou remova os artefatos antes de publicar.',
      ].join('\n')
    );
  }

  console.log('Standalone limpo: nenhum artefato SQLite local em .next/standalone.');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
