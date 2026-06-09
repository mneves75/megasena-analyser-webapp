#!/usr/bin/env bun
/**
 * Development script that runs both the Bun API server and Next.js dev server concurrently
 * Uses Bun runtime for both servers via --bun flag
 */

import { spawn } from 'bun';
import { stopSubprocess } from '../lib/process-lifecycle';

console.log('Starting development servers with Bun runtime...\n');
const NEXT_PORT = '3000';
const API_PORT = '3201';

// Start the Bun API server (already runs on Bun natively)
console.log(`Starting Bun API server on port ${API_PORT}...`);
const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', API_PORT },
});

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
      // Retry until the API is actually ready for dependent SSR pages.
    }

    await Bun.sleep(500);
  }

  throw new Error(`API server did not become healthy on port ${API_PORT}`);
};

await ensureProcessIsAlive('API server', apiServer);
await waitForApiHealth();

// Start the Next.js dev server with Bun runtime (--bun flag)
console.log(`Starting Next.js dev server on port ${NEXT_PORT} (Bun runtime)...\n`);
const nextServer = spawn(['bun', 'run', 'dev:next-only', '--', '-p', NEXT_PORT], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', API_PORT, PORT: NEXT_PORT },
});
await ensureProcessIsAlive('Next.js dev server', nextServer);

let shuttingDown = false;

const shutdown = async (signal: string, exitCode: number, alreadyExited?: string): Promise<never> => {
  if (!shuttingDown) {
    shuttingDown = true;
    console.log(`\n\nShutting down servers (${signal})...`);
    if (alreadyExited !== 'Next.js dev server') {
      await stopSubprocess(nextServer, {
        label: 'Next.js dev server',
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

// Handle cleanup on exit
process.on('SIGINT', () => {
  void shutdown('SIGINT', 0);
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM', 0);
});

const crashed = await Promise.race([
  apiServer.exited.then((code) => ({ label: 'API server', code })),
  nextServer.exited.then((code) => ({ label: 'Next.js dev server', code })),
]);

if (!shuttingDown) {
  console.error(`${crashed.label} exited unexpectedly with code ${crashed.code ?? 'unknown'}.`);
}

await shutdown('PROCESS_EXIT', typeof crashed.code === 'number' ? crashed.code : 1, crashed.label);
