import { getDatabase } from './db';
import { logger } from './logger';

export type AuditEventName =
  | 'api.health_read'
  | 'api.dashboard_read'
  | 'api.statistics_read'
  | 'api.trends_read'
  | 'bets.generate_requested'
  | 'system.audit_flush_failed';

export interface AuditEventInput {
  event: AuditEventName;
  requestId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  success?: boolean;
  durationMs?: number;
  clientIdHash?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  event: string;
  request_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  success: 0 | 1;
  duration_ms: number | null;
  client_id_hash: string | null;
  user_agent: string | null;
  metadata_json: string | null;
}

const AUDIT_QUEUE_MAX = 1000;
const AUDIT_FLUSH_THRESHOLD = 25;
const AUDIT_FLUSH_BATCH_SIZE = 200;
const AUDIT_FLUSH_INTERVAL_MS = 2000;

let auditQueue: AuditLogRow[] = [];
let flushInFlight: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function sanitizeString(value: string, maxLength: number): string {
  return truncate(value.replace(/[\r\n\t]/g, ' '), maxLength);
}

function sanitizeUserAgent(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  // Minimal sanitization: remove control chars and cap length.
  // Full UA parsing is intentionally avoided to prevent brittle heuristics.
  return sanitizeString(value, 120);
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const redactionKeyPattern = /(authorization|token|secret|password|cookie|set-cookie)/i;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'undefined') {
      continue;
    }

    if (redactionKeyPattern.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, 500);
      continue;
    }

    sanitized[key] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function safeJsonStringify(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.error('system.audit_metadata_stringify_failed', error);
    return null;
  }
}

function normalizeClientIdHash(clientIdHash: string | undefined): string | null {
  if (!clientIdHash) {
    return null;
  }

  const normalized = sanitizeString(clientIdHash, 128);
  return normalized.length > 0 ? normalized : null;
}

function buildAuditRow(input: AuditEventInput): AuditLogRow {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  const sanitizedMetadata = sanitizeMetadata(input.metadata);

  return {
    id,
    timestamp,
    event: input.event,
    request_id: input.requestId ?? null,
    route: input.route ?? null,
    method: input.method ?? null,
    status_code: typeof input.statusCode === 'number' ? Math.round(input.statusCode) : null,
    success: input.success === false ? 0 : 1,
    duration_ms: typeof input.durationMs === 'number' ? Math.round(input.durationMs) : null,
    client_id_hash: normalizeClientIdHash(input.clientIdHash),
    user_agent: sanitizeUserAgent(input.userAgent),
    metadata_json: safeJsonStringify(sanitizedMetadata),
  };
}

export function startAuditWriter(): void {
  if (flushTimer) {
    return;
  }

  flushTimer = setInterval(() => {
    void flushAuditQueue('interval');
  }, AUDIT_FLUSH_INTERVAL_MS);
}

export async function stopAuditWriter(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  await flushAuditQueue('stop');
}

export function enqueueAuditEvent(input: AuditEventInput): void {
  if (auditQueue.length >= AUDIT_QUEUE_MAX) {
    logger.warn('audit.queue_full', { size: auditQueue.length });
    return;
  }

  auditQueue.push(buildAuditRow(input));

  if (auditQueue.length >= AUDIT_FLUSH_THRESHOLD) {
    void flushAuditQueue('threshold');
  }
}

export async function flushAuditQueue(reason: 'interval' | 'threshold' | 'stop' | 'manual'): Promise<void> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = (async () => {
    if (auditQueue.length === 0) {
      return;
    }

    const batch = auditQueue.splice(0, AUDIT_FLUSH_BATCH_SIZE);
    const db = getDatabase();

    try {
      db.exec('BEGIN IMMEDIATE TRANSACTION');
      const stmt = db.prepare(`
        INSERT INTO audit_logs (
          id, timestamp, event, request_id, route, method, status_code, success,
          duration_ms, client_id_hash, user_agent, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of batch) {
        stmt.run(
          row.id,
          row.timestamp,
          row.event,
          row.request_id,
          row.route,
          row.method,
          row.status_code,
          row.success,
          row.duration_ms,
          row.client_id_hash,
          row.user_agent,
          row.metadata_json
        );
      }

      db.exec('COMMIT');

      logger.debug('audit.flush_success', { reason, count: batch.length });
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch (rollbackError) {
        logger.error('audit.rollback_failed', rollbackError);
      }

      // Best effort requeue: put the batch back at the front.
      auditQueue = batch.concat(auditQueue).slice(0, AUDIT_QUEUE_MAX);

      logger.error('system.audit_flush_failed', error, { reason, count: batch.length });
    }
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}
