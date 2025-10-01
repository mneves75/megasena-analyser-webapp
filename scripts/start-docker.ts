#!/usr/bin/env bun
/**
 * Docker Container Startup Script
 *
 * Manages both Next.js and Bun API servers within a single container.
 * Handles graceful shutdown, health monitoring, and proper signal forwarding.
 *
 * Signal Handling:
 * - SIGTERM: Graceful shutdown (sent by Docker/Kubernetes)
 * - SIGINT: Graceful shutdown (Ctrl+C)
 * - SIGUSR1/SIGUSR2: Reload configuration (future use)
 *
 * Exit Codes:
 * - 0: Clean shutdown
 * - 1: Unexpected error
 * - 2: Startup failure
 */

import { spawn } from 'bun';
import { logger } from '../lib/logger';

// Process references for cleanup
let apiServer: ReturnType<typeof spawn> | null = null;
let nextServer: ReturnType<typeof spawn> | null = null;

// Shutdown flag to prevent multiple shutdown attempts
let isShuttingDown = false;

// Startup timestamp for uptime tracking
const startTime = Date.now();

/**
 * Start both API server and Next.js server
 */
async function startServers() {
  logger.info('🐳 Starting Mega-Sena Analyser in Docker container...');
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Ports: Next.js=${process.env.PORT || 3000}, API=${process.env.API_PORT || 3201}`);

  try {
    // Step 1: Start Bun API server
    logger.info('📡 Starting Bun API server...');
    // Use pre-bundled server binary (resolves path aliases at build time)
    apiServer = spawn(['/app/server-bundle'], {
      cwd: '/app', // Ensure running from project root
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        API_PORT: process.env.API_PORT || '3201',
      },
    });

    // Wait for API server to initialize
    // Give it time to bind to port and run migrations
    logger.info('⏳ Waiting for API server to initialize...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 2: Verify API server is running
    try {
      const healthCheck = await fetch(`http://localhost:${process.env.API_PORT || '3201'}/api/health`);
      if (!healthCheck.ok) {
        throw new Error(`API health check failed with status: ${healthCheck.status}`);
      }
      logger.info('✅ API server ready');
    } catch (error) {
      logger.error('❌ API server health check failed', error);
      throw new Error('API server failed to start');
    }

    // Step 3: Start Next.js server
    logger.info('🌐 Starting Next.js server...');
    const port = process.env.PORT || '3000';
    nextServer = spawn(['bun', 'run', 'start', '--', '--port', port], {
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        PORT: port,
      },
    });

    // Wait for Next.js to be ready
    logger.info('⏳ Waiting for Next.js server to initialize...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info('✅ All services started successfully');
    logger.info(`🚀 Application ready at http://localhost:${port}`);
    logger.info(`📊 API endpoints at http://localhost:${process.env.API_PORT || '3201'}/api/*`);

    return true;
  } catch (error) {
    logger.error('❌ Failed to start servers', error);
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
async function shutdown(signal: string, exitCode = 0) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal:', { signal });
    return;
  }

  isShuttingDown = true;
  const uptime = Math.round((Date.now() - startTime) / 1000);

  logger.info(`\n📦 Received ${signal}, initiating graceful shutdown...`);
  logger.info(`⏱️  Container uptime: ${uptime} seconds`);

  try {
    // Stop Next.js first (frontend)
    if (nextServer) {
      logger.info('🛑 Stopping Next.js server...');
      nextServer.kill('SIGTERM');

      // Give Next.js time to finish in-flight requests
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Force kill if still running
      if (!nextServer.killed) {
        logger.warn('⚠️  Next.js did not stop gracefully, forcing shutdown...');
        nextServer.kill('SIGKILL');
      }

      logger.info('✓ Next.js server stopped');
    }

    // Stop API server
    if (apiServer) {
      logger.info('🛑 Stopping API server...');
      apiServer.kill('SIGTERM');

      // Give API time to close database connections
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Force kill if still running
      if (!apiServer.killed) {
        logger.warn('⚠️  API server did not stop gracefully, forcing shutdown...');
        apiServer.kill('SIGKILL');
      }

      logger.info('✓ API server stopped');
    }

    logger.info('✅ Graceful shutdown complete');
    logger.info(`👋 Goodbye! (uptime: ${uptime}s)`);

  } catch (error) {
    logger.error('❌ Error during shutdown', error);
    exitCode = 1;
  }

  // Exit process
  process.exit(exitCode);
}

/**
 * Monitor server processes and restart if they crash unexpectedly
 */
async function monitorProcesses() {
  if (apiServer) {
    apiServer.exited.then((code) => {
      if (!isShuttingDown) {
        logger.error(`❌ API server exited unexpectedly with code: ${code}`);
        shutdown('API_CRASH', 1);
      }
    });
  }

  if (nextServer) {
    nextServer.exited.then((code) => {
      if (!isShuttingDown) {
        logger.error(`❌ Next.js server exited unexpectedly with code: ${code}`);
        shutdown('NEXT_CRASH', 1);
      }
    });
  }
}

// ============================================================================
// Signal Handlers
// ============================================================================

// SIGTERM: Graceful shutdown (Docker stop, Kubernetes pod termination)
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  shutdown('SIGTERM', 0);
});

// SIGINT: Graceful shutdown (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  shutdown('SIGINT', 0);
});

// SIGUSR1: Reload configuration (future use)
process.on('SIGUSR1', () => {
  logger.info('Received SIGUSR1 signal (reload configuration)');
  // TODO: Implement configuration reload without downtime
});

// Uncaught exceptions: Log and shutdown
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught exception', error);
  shutdown('UNCAUGHT_EXCEPTION', 1);
});

// Unhandled promise rejections: Log and shutdown
process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled promise rejection', reason);
  shutdown('UNHANDLED_REJECTION', 1);
});

// ============================================================================
// Main Execution
// ============================================================================

(async () => {
  logger.info('═'.repeat(60));
  logger.info('🎰 Mega-Sena Analyser - Docker Container');
  logger.info('═'.repeat(60));

  // Start servers
  const success = await startServers();

  if (!success) {
    logger.error('❌ Startup failed');
    process.exit(2);
  }

  // Monitor processes for unexpected exits
  await monitorProcesses();

  // Keep process alive and wait for shutdown signal
  await new Promise(() => {}); // Infinite wait
})();
