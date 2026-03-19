#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'bun';

const PORT = process.env['PORT'] || '3000';
const API_PORT = process.env['API_PORT'] || '3201';
const STANDALONE_SERVER = path.join(process.cwd(), '.next', 'standalone', 'server.js');

if (!fs.existsSync(STANDALONE_SERVER)) {
  throw new Error(
    `Standalone build not found at ${STANDALONE_SERVER}. Run "bun run build" before "bun run start".`
  );
}

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

const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', API_PORT },
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

const shutdown = (signal: string, exitCode: number): never => {
  if (!shuttingDown) {
    shuttingDown = true;
    console.log(`\nShutting down production servers (${signal})...`);
    apiServer.kill();
    nextServer.kill();
  }

  process.exit(exitCode);
};

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

const crashed = await Promise.race([
  apiServer.exited.then((code) => ({ label: 'API server', code })),
  nextServer.exited.then((code) => ({ label: 'Standalone Next.js server', code })),
]);

if (!shuttingDown) {
  console.error(`${crashed.label} exited unexpectedly with code ${crashed.code ?? 'unknown'}.`);
}

shutdown('PROCESS_EXIT', typeof crashed.code === 'number' ? crashed.code : 1);
