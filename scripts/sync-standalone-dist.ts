#!/usr/bin/env bun

import { cp, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const standaloneSource = path.join(process.cwd(), '.next', 'standalone');
const staticSource = path.join(process.cwd(), '.next', 'static');
const distRoot = path.join(process.cwd(), 'dist', 'standalone');
const distStatic = path.join(distRoot, '.next', 'static');
const tracedDbDir = path.join(distRoot, 'db');

async function assertPathExists(targetPath: string, label: string): Promise<void> {
  try {
    await stat(targetPath);
  } catch {
    throw new Error(`${label} não encontrado em ${targetPath}. Execute "bun run build" antes de preparar o dist.`);
  }
}

console.log('Sincronizando dist/standalone a partir do output oficial do Next.js...');

await assertPathExists(standaloneSource, 'Output standalone');
await assertPathExists(path.join(standaloneSource, 'server.js'), 'Servidor standalone');
await assertPathExists(staticSource, 'Assets estáticos do Next.js');

await rm(distRoot, { recursive: true, force: true });
await cp(standaloneSource, distRoot, { recursive: true });
await cp(staticSource, distStatic, { recursive: true });
await rm(tracedDbDir, { recursive: true, force: true });

console.log(`dist/standalone pronto em ${distRoot} (sem banco/backups locais traçados pelo build)`);
