#!/usr/bin/env bun
/**
 * Development script that runs both the Bun API server and Next.js dev server concurrently
 * Uses Bun runtime for both servers via --bun flag
 */

import { spawn } from 'bun';

console.log('Starting development servers with Bun runtime...\n');

// Start the Bun API server (already runs on Bun natively)
console.log('Starting Bun API server on port 3201...');
const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

// Wait a moment for the API server to start
await new Promise((resolve) => setTimeout(resolve, 1000));

// Start the Next.js dev server with Bun runtime (--bun flag)
console.log('Starting Next.js dev server on port 3000 (Bun runtime)...\n');
const nextServer = spawn(['bun', '--bun', 'next', 'dev'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\nShutting down servers...');
  apiServer.kill();
  nextServer.kill();
  process.exit(0);
});

// Keep the script running
await Promise.all([apiServer.exited, nextServer.exited]);

