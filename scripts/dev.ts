#!/usr/bin/env bun
/**
 * Development script that runs both the Bun API server and Next.js dev server concurrently
 */

import { spawn } from 'bun';

const isDev = process.env.NODE_ENV !== 'production';

console.log('🚀 Starting development servers...\n');

// Start the Bun API server
console.log('Starting Bun API server on port 3201...');
const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

// Wait a moment for the API server to start
await new Promise((resolve) => setTimeout(resolve, 1000));

// Start the Next.js dev server
console.log('Starting Next.js dev server on port 3000...\n');
const nextServer = spawn(['bun', 'x', 'next', 'dev'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down servers...');
  apiServer.kill();
  nextServer.kill();
  process.exit(0);
});

// Keep the script running
await Promise.all([apiServer.exited, nextServer.exited]);

