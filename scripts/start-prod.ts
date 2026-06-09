#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'bun';
import { stopSubprocess } from '../lib/process-lifecycle';

const PORT = process.env['PORT'] || '3000';
const API_PORT = process.env['API_PORT'] || '3201';
const STANDALONE_SERVER = path.join(process.cwd(), '.next', 'standalone', 'server.js');
const NEXT_STATIC_SOURCE = path.join(process.cwd(), '.next', 'static');
const STANDALONE_STATIC_TARGET = path.join(
  process.cwd(),
  '.next',
  'standalone',
  '.next',
  'static'
);

if (!fs.existsSync(STANDALONE_SERVER)) {
  throw new Error(
    `Standalone build not found at ${STANDALONE_SERVER}. Run "bun run build" before "bun run start".`
  );
}

if (!fs.existsSync(NEXT_STATIC_SOURCE)) {
  throw new Error(
    `Next static assets not found at ${NEXT_STATIC_SOURCE}. Run "bun run build" before "bun run start".`
  );
}

fs.rmSync(STANDALONE_STATIC_TARGET, { recursive: true, force: true });
fs.cpSync(NEXT_STATIC_SOURCE, STANDALONE_STATIC_TARGET, { recursive: true });

let shuttingDown = false;

const ensureProcessIsAlive = async (
  label: string,
  processRef: ReturnType<typeof spawn>
): Promise<void> => {
  const result = await Promise.race([
    processRef.exited.then((code) => ({ kind: 'exit' as const, code })),
    Bun.sleep(1000).then(() => ({ kind: 'ok' as const })),
  ]);

  if (result.kind === 'exit') {
    throw new Error(`${label} exited early with code ${result.code ?? 'unknown'}`);
  }
};

const waitForApiHealth = async (): Promise<void> => {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the API is healthy.
    }

    await Bun.sleep(500);
  }

  throw new Error(`API server did not become healthy on port ${API_PORT}`);
};

console.log('Starting production servers...');

const apiEnv: Record<string, string> = {
  ...(process.env as Record<string, string>),
  NODE_ENV: 'production',
  API_PORT,
};

// IP_HASH_SECRET is required (fail-closed in server.ts). Operators running
// `bun run start` on systemd/PM2/etc. must export it. The only escape hatch is
// IP_HASH_SECRET_AUTOGENERATE=true, set explicitly by the caller (e.g. Playwright
// webServer config) — never silently injected here.

const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: apiEnv,
});
await ensureProcessIsAlive('API server', apiServer);
await waitForApiHealth();

const nextServer = spawn(['bun', '--bun', '.next/standalone/server.js'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT,
    HOSTNAME: '0.0.0.0',
  },
});
await ensureProcessIsAlive('Standalone Next.js server', nextServer);

const shutdown = async (signal: string, exitCode: number, alreadyExited?: string): Promise<never> => {
  if (!shuttingDown) {
    shuttingDown = true;
    console.log(`\nShutting down production servers (${signal})...`);
    if (alreadyExited !== 'Standalone Next.js server') {
      await stopSubprocess(nextServer, {
        label: 'Standalone Next.js server',
        graceMs: 2000,
      });
    }
    if (alreadyExited !== 'API server') {
      await stopSubprocess(apiServer, {
        label: 'API server',
        graceMs: 1000,
      });
    }
  }

  process.exit(exitCode);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT', 0);
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM', 0);
});

const crashed = await Promise.race([
  apiServer.exited.then((code) => ({ label: 'API server', code })),
  nextServer.exited.then((code) => ({ label: 'Standalone Next.js server', code })),
]);

if (!shuttingDown) {
  console.error(`${crashed.label} exited unexpectedly with code ${crashed.code ?? 'unknown'}.`);
}

await shutdown('PROCESS_EXIT', typeof crashed.code === 'number' ? crashed.code : 1, crashed.label);
