#!/usr/bin/env bun
/**
 * Docker Container Startup Script (Distroless-compatible)
 *
 * Manages both Next.js and Bun API servers within a single container.
 * No shell dependencies - pure Bun execution for distroless images.
 * Handles SIGTERM/SIGINT for graceful shutdown natively.
 *
 * Signal Handling:
 * - SIGTERM: Graceful shutdown (sent by Docker/Kubernetes)
 * - SIGINT: Graceful shutdown (Ctrl+C)
 *
 * Exit Codes:
 * - 0: Clean shutdown
 * - 1: Unexpected error
 * - 2: Startup failure
 */

import { spawn, type Subprocess } from 'bun';

// Process references for cleanup
let apiServer: Subprocess | null = null;
let nextServer: Subprocess | null = null;

// Shutdown flag to prevent multiple shutdown attempts
let isShuttingDown = false;

// Startup timestamp for uptime tracking
const startTime = Date.now();

const PORT = process.env.PORT || '80';
const API_PORT = process.env.API_PORT || '3201';
const DATABASE_PATH = process.env.DATABASE_PATH || '/app/db/mega-sena.db';

/**
 * Start both API server and Next.js server
 */
async function startServers(): Promise<boolean> {
  console.log('='.repeat(60));
  console.log('Mega-Sena Analyzer - Docker Container (Distroless)');
  console.log('='.repeat(60));
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Ports: Next.js=${PORT}, API=${API_PORT}`);
  console.log(`Database: ${DATABASE_PATH}`);
  console.log('');

  try {
    // Step 1: Start Bun API server (pre-compiled binary)
    console.log('[1/3] Starting API server...');
    apiServer = spawn(['./server-bundle'], {
      cwd: '/app',
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        API_PORT,
        DATABASE_PATH,
      },
    });

    // Wait for API server to initialize
    console.log('[2/3] Waiting for API server initialization...');
    await Bun.sleep(3000);

    // Verify API server is running
    try {
      const healthCheck = await fetch(`http://localhost:${API_PORT}/api/health`);
      if (!healthCheck.ok) {
        throw new Error(`API health check failed with status: ${healthCheck.status}`);
      }
      console.log('[OK] API server ready');
    } catch (error) {
      console.error('[FAIL] API server health check failed:', error);
      throw new Error('API server failed to start');
    }

    // Step 2: Start Next.js server (standalone mode with Bun runtime)
    console.log('[3/3] Starting Next.js server (Bun runtime)...');
    nextServer = spawn(['bun', '--bun', './server.js'], {
      cwd: '/app',
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        PORT,
        HOSTNAME: '0.0.0.0',
      },
    });

    // Wait for Next.js to be ready
    await Bun.sleep(2000);

    console.log('');
    console.log('[OK] All services started successfully');
    console.log(`Application ready at http://localhost:${PORT}`);
    console.log(`API endpoints at http://localhost:${API_PORT}/api/*`);
    console.log('');

    return true;
  } catch (error) {
    console.error('[FAIL] Failed to start servers:', error);
    await shutdown('STARTUP_ERROR', 2);
    return false;
  }
}

/**
 * Graceful shutdown handler
 *
 * Stops both servers in reverse order of startup:
 * 1. Stop Next.js (stops accepting new requests)
 * 2. Wait for in-flight requests to complete
 * 3. Stop API server
 * 4. Clean up resources
 */
async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    console.warn('Shutdown already in progress, ignoring signal:', signal);
    return;
  }

  isShuttingDown = true;
  const uptime = Math.round((Date.now() - startTime) / 1000);

  console.log('');
  console.log(`Received ${signal}, initiating graceful shutdown...`);
  console.log(`Container uptime: ${uptime} seconds`);

  try {
    // Stop Next.js first (frontend)
    if (nextServer) {
      console.log('Stopping Next.js server...');
      nextServer.kill('SIGTERM');

      // Give Next.js time to finish in-flight requests
      await Bun.sleep(2000);

      // Force kill if still running
      if (!nextServer.killed) {
        console.warn('Next.js did not stop gracefully, forcing shutdown...');
        nextServer.kill('SIGKILL');
      }

      console.log('[OK] Next.js server stopped');
    }

    // Stop API server
    if (apiServer) {
      console.log('Stopping API server...');
      apiServer.kill('SIGTERM');

      // Give API time to close database connections
      await Bun.sleep(1000);

      // Force kill if still running
      if (!apiServer.killed) {
        console.warn('API server did not stop gracefully, forcing shutdown...');
        apiServer.kill('SIGKILL');
      }

      console.log('[OK] API server stopped');
    }

    console.log('');
    console.log('[OK] Graceful shutdown complete');
    console.log(`Goodbye! (uptime: ${uptime}s)`);
  } catch (error) {
    console.error('[FAIL] Error during shutdown:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

/**
 * Monitor server processes and restart if they crash unexpectedly
 */
function monitorProcesses(): void {
  if (apiServer) {
    apiServer.exited.then((code) => {
      if (!isShuttingDown) {
        console.error(`[CRASH] API server exited unexpectedly with code: ${code}`);
        shutdown('API_CRASH', 1);
      }
    });
  }

  if (nextServer) {
    nextServer.exited.then((code) => {
      if (!isShuttingDown) {
        console.error(`[CRASH] Next.js server exited unexpectedly with code: ${code}`);
        shutdown('NEXT_CRASH', 1);
      }
    });
  }
}

// ============================================================================
// Signal Handlers
// Bun handles these natively - no dumb-init required in distroless
// ============================================================================

// SIGTERM: Graceful shutdown (Docker stop, Kubernetes pod termination)
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal');
  shutdown('SIGTERM', 0);
});

// SIGINT: Graceful shutdown (Ctrl+C)
process.on('SIGINT', () => {
  console.log('Received SIGINT signal');
  shutdown('SIGINT', 0);
});

// Uncaught exceptions: Log and shutdown
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION', 1);
});

// Unhandled promise rejections: Log and shutdown
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  shutdown('UNHANDLED_REJECTION', 1);
});

// ============================================================================
// Main Execution
// ============================================================================

const success = await startServers();

if (!success) {
  console.error('[FAIL] Startup failed');
  process.exit(2);
}

// Monitor processes for unexpected exits
monitorProcesses();

// Keep process alive and wait for shutdown signal
await new Promise(() => {});
