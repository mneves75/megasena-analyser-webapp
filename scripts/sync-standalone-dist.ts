#!/usr/bin/env bun

import { cp, readdir, readFile, rm, stat } from 'node:fs/promises';
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

async function assertContainerApiRewrite(serverPath: string): Promise<void> {
  const serverSource = await readFile(serverPath, 'utf8');
  const localhostApiRewrites = [...serverSource.matchAll(/http:\/\/localhost:(\d+)\/api\/:path\*/g)];
  const invalidRewrite = localhostApiRewrites.find((match) => match[1] !== '3201');

  if (invalidRewrite) {
    throw new Error(
      `Standalone com rewrite de API para localhost:${invalidRewrite[1]}. ` +
        'Refaça "bun run build" sem API_PORT temporário antes de preparar o deploy Docker.'
    );
  }
}

console.log('Sincronizando dist/standalone a partir do output oficial do Next.js...');

await assertPathExists(standaloneSource, 'Output standalone');
const standaloneServer = path.join(standaloneSource, 'server.js');
await assertPathExists(standaloneServer, 'Servidor standalone');
await assertPathExists(staticSource, 'Assets estáticos do Next.js');
await assertContainerApiRewrite(standaloneServer);

await rm(distRoot, { recursive: true, force: true });
await cp(standaloneSource, distRoot, { recursive: true });
await cp(staticSource, distStatic, { recursive: true });
await rm(tracedDbDir, { recursive: true, force: true });
await stripTracedEnvFiles(distRoot);

// O output tracing do Next pode arrastar .env locais para o standalone; como o
// Bun auto-carrega /app/.env no runtime, um .env dentro do dist vazaria segredos
// locais direto para a imagem publicada.
async function stripTracedEnvFiles(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      await stripTracedEnvFiles(entryPath);
    } else if (/^\.env(\..+)?$/.test(entry.name)) {
      await rm(entryPath, { force: true });
      console.log(`Removido do dist: ${path.relative(distRoot, entryPath)}`);
    }
  }
}

console.log(`dist/standalone pronto em ${distRoot} (sem banco/backups/.env locais traçados pelo build)`);
