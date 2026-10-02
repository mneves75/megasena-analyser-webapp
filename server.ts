#!/usr/bin/env bun
import { serve } from 'bun';
import { readFileSync } from 'node:fs';
import './lib/log-sink.runtime';
import './lib/log-context.runtime';
import { runMigrations, closeDatabase } from './lib/db';
import { logger } from './lib/logger';
import { enqueueAuditEvent, startAuditWriter, stopAuditWriter } from './lib/audit';
import { startAuditRetentionScheduler } from './lib/audit-retention';
import { startLogRetentionScheduler } from './lib/log-retention';
import { stopLogWriter } from './lib/log-store';
import { isHmacEnabled } from './lib/security/pseudonymize';
import { isInternalApiRequest, isRateLimitExempt } from './lib/security/internal-api';
import { resolveClientIp, isSecureRequest } from './lib/security/http';
import { createApiHandler } from './lib/api/handler';
function resolveAppVersion(): string {
  const envVersion = process.env['APP_VERSION'];
  if (envVersion && envVersion.trim().length > 0) {
    return envVersion.trim();
  }

  try {
    const pkgText = readFileSync(new URL('./package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(pkgText) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
      return pkg.version.trim();
    }
  } catch (error) {
    logger.warn('system.app_version_read_failed', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return 'unknown';
}

const APP_VERSION = resolveAppVersion();

const AUDIT_RETENTION_DAYS = Number(process.env['AUDIT_RETENTION_DAYS'] ?? '400');
const AUDIT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOG_RETENTION_DAYS = Number(process.env['LOG_RETENTION_DAYS'] ?? '30');
const LOG_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
let stopAuditRetentionScheduler: (() => void) | null = null;
let stopLogRetentionScheduler: (() => void) | null = null;
// Validate production secret BEFORE migrations to avoid mutating the database
// on a misconfigured deploy. fail-closed → no DB writes if IP_HASH_SECRET is
// missing in production.
{
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (isProduction && !isHmacEnabled()) {
    logger.error('security.ip_hash_secret_missing', new Error('IP_HASH_SECRET required in production'), {
      reason: 'IP_HASH_SECRET ausente ou com menos de 32 caracteres. A Política de Privacidade promete pseudonimização HMAC-SHA256, portanto a produção recusa iniciar com hashing mais fraco.',
    });
    process.exit(1);
  }
}

// Run migrations on startup
logger.info('db.initializing');
try {
  runMigrations();
  logger.info('db.ready');
  if (isHmacEnabled()) {
    logger.info('security.ip_hash_hmac_enabled');
  }
  startAuditWriter();
  logger.info('audit.writer_started');
  if (Number.isFinite(AUDIT_RETENTION_DAYS) && AUDIT_RETENTION_DAYS > 0) {
    stopAuditRetentionScheduler = startAuditRetentionScheduler(
      AUDIT_RETENTION_DAYS,
      AUDIT_RETENTION_INTERVAL_MS
    );
    logger.info('audit.retention_scheduler_started', {
      retentionDays: AUDIT_RETENTION_DAYS,
      intervalMs: AUDIT_RETENTION_INTERVAL_MS,
    });
  } else {
    logger.warn('audit.retention_scheduler_skipped', {
      reason: 'invalid_retention_days',
      retentionDays: AUDIT_RETENTION_DAYS,
    });
  }

  if (Number.isFinite(LOG_RETENTION_DAYS) && LOG_RETENTION_DAYS > 0) {
    stopLogRetentionScheduler = startLogRetentionScheduler(
      LOG_RETENTION_DAYS,
      LOG_RETENTION_INTERVAL_MS
    );
    logger.info('log.retention_scheduler_started', {
      retentionDays: LOG_RETENTION_DAYS,
      intervalMs: LOG_RETENTION_INTERVAL_MS,
    });
  } else {
    logger.warn('log.retention_scheduler_skipped', {
      reason: 'invalid_retention_days',
      retentionDays: LOG_RETENTION_DAYS,
    });
  }
} catch (error) {
  logger.error('db.initialization_failed', error);
  process.exit(1);
}

const handler = createApiHandler({
  environment: process.env['NODE_ENV'] ?? 'development',
  appVersion: APP_VERSION,
  ipHashSecret: process.env['IP_HASH_SECRET'],
  allowedOrigins: process.env['ALLOWED_ORIGINS'],
  minHealthTotalDraws: Number(process.env['HEALTH_MIN_TOTAL_DRAWS'] ?? '1'),
  uptime: () => process.uptime(),
  audit: enqueueAuditEvent,
});
const PORT = Number(process.env['API_PORT']) || 3201;
const server = serve({
  port: PORT,
  fetch(req, server) {
    const internal = isRateLimitExempt(req, isInternalApiRequest(req, server.requestIP(req)?.address ?? null));
    return handler.fetch(req, {
      internal,
      clientIp: internal ? null : resolveClientIp(req, server),
      secure: isSecureRequest(req, new URL(req.url), server),
    });
  },
});
logger.info('api.server_started', {
  port: PORT,
  routes: handler.routes,
});

// Graceful shutdown handlers
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('system.shutdown_forced', { signal });
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info('system.shutdown_started', { signal });
  await server.stop();
  let shutdownFailed = false;
  
  try {
    if (stopAuditRetentionScheduler) {
      stopAuditRetentionScheduler();
      stopAuditRetentionScheduler = null;
      logger.info('audit.retention_scheduler_stopped');
    }
  } catch (error) {
    logger.error('audit.retention_scheduler_stop_failed', error, { signal });
  }

  try {
    if (stopLogRetentionScheduler) {
      stopLogRetentionScheduler();
      stopLogRetentionScheduler = null;
      logger.info('log.retention_scheduler_stopped');
    }
  } catch (error) {
    logger.error('log.retention_scheduler_stop_failed', error, { signal });
  }

  try {
    await stopAuditWriter();
    logger.info('audit.writer_stopped');
  } catch (error) {
    shutdownFailed = true;
    logger.error('audit.stop_failed', error, { signal });
  }

  logger.info('system.shutdown_complete', { signal });
  try {
    await stopLogWriter();
  } catch (error) {
    shutdownFailed = true;
    console.error('log.writer_stop_failed', error);
  }
  
  try {
    closeDatabase();
  } catch (error) {
    shutdownFailed = true;
    console.error('db.close_failed', error);
  }

  process.exit(shutdownFailed ? 1 : 0);
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('system.uncaught_exception', error);
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('system.unhandled_rejection', reason);
  void gracefulShutdown('unhandledRejection');
});
