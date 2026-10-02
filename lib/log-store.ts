import { getDatabase } from './db';
import { withDatabaseTransaction } from './db-transaction';

export type LogEventEntry = {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  route?: string;
  userAgent?: string;
  launchStage?: string;
  durationMs?: number;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

type LogEventRow = {
  id: string;
  timestamp: string;
  level: LogEventEntry['level'];
  event: string;
  request_id: string | null;
  session_id: string | null;
  user_id: string | null;
  route: string | null;
  user_agent: string | null;
  launch_stage: string | null;
  duration_ms: number | null;
  status_code: number | null;
  metadata_json: string | null;
  error_json: string | null;
};

export function createLogWriter(options: { automaticFlush: boolean } = { automaticFlush: true }) {
  const LOG_QUEUE_MAX = 2000;
  const LOG_FLUSH_THRESHOLD = 50;
  const LOG_FLUSH_BATCH_SIZE = 250;
  const LOG_FLUSH_INTERVAL_MS = 2000;

  let logQueue: LogEventRow[] = [];
  let flushInFlight: Promise<void> | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let queueFullWarned = false;

  function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength);
  }

  function sanitizeString(value: string, maxLength: number): string {
    return truncate(value.replace(/[\r\n\t]/g, ' '), maxLength);
  }

  function safeJsonStringify(value: unknown): string | null {
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  function sanitizeOptional(value: string | undefined, maxLength: number): string | null {
    if (!value) {
      return null;
    }
    const sanitized = sanitizeString(value, maxLength);
    return sanitized.length > 0 ? sanitized : null;
  }

  function buildLogRow(entry: LogEventEntry): LogEventRow {
    return {
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      event: sanitizeString(entry.event, 120),
      request_id: sanitizeOptional(entry.requestId, 128),
      session_id: sanitizeOptional(entry.sessionId, 128),
      user_id: sanitizeOptional(entry.userId, 128),
      route: sanitizeOptional(entry.route, 200),
      user_agent: sanitizeOptional(entry.userAgent, 120),
      launch_stage: sanitizeOptional(entry.launchStage, 60),
      duration_ms: typeof entry.durationMs === 'number' ? Math.round(entry.durationMs) : null,
      status_code: typeof entry.statusCode === 'number' ? Math.round(entry.statusCode) : null,
      metadata_json: safeJsonStringify(entry.metadata),
      error_json: safeJsonStringify(entry.error),
    };
  }

  function startLogWriter(): void {
    if (!options.automaticFlush || flushTimer) {
      return;
    }
    if (typeof process !== 'undefined' && process.env['VITEST']) {
      return;
    }

    flushTimer = setInterval(() => {
      void flushLogQueue('interval');
    }, LOG_FLUSH_INTERVAL_MS);
    if (typeof flushTimer === 'object' && typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  }

  async function stopLogWriter(): Promise<void> {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }

    await flushLogQueue('stop');
    while (logQueue.length > 0) {
      await flushLogQueue('stop');
    }
  }

  function enqueueLogEvent(entry: LogEventEntry): void {
    if (logQueue.length >= LOG_QUEUE_MAX) {
      if (!queueFullWarned) {
        queueFullWarned = true;
        console.warn('[log-store] queue full; dropping log events');
      }
      return;
    }

    logQueue.push(buildLogRow(entry));
    startLogWriter();

    if (options.automaticFlush && logQueue.length >= LOG_FLUSH_THRESHOLD) {
      void flushLogQueue('threshold');
    }
  }

  async function flushLogQueue(
    reason: 'interval' | 'threshold' | 'stop' | 'manual'
  ): Promise<void> {
    if (flushInFlight) {
      return flushInFlight;
    }

    flushInFlight = (async () => {
      if (logQueue.length === 0) {
        return;
      }

      const batch = logQueue.splice(0, LOG_FLUSH_BATCH_SIZE);
      try {
        const db = getDatabase();
        withDatabaseTransaction(db, () => {
          const stmt = db.prepare(`
            INSERT INTO log_events (
              id,
              timestamp,
              level,
              event,
              request_id,
              session_id,
              user_id,
              route,
              user_agent,
              launch_stage,
              duration_ms,
              status_code,
              metadata_json,
              error_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const row of batch) {
            stmt.run(
              row.id,
              row.timestamp,
              row.level,
              row.event,
              row.request_id,
              row.session_id,
              row.user_id,
              row.route,
              row.user_agent,
              row.launch_stage,
              row.duration_ms,
              row.status_code,
              row.metadata_json,
              row.error_json
            );
          }

        });
        if (queueFullWarned && logQueue.length < LOG_QUEUE_MAX / 2) {
          queueFullWarned = false;
        }
      } catch (error) {
        logQueue = batch.concat(logQueue).slice(0, LOG_QUEUE_MAX);
        console.error('[log-store] flush failed', { reason, error });
        if (reason === 'stop') {
          throw error;
        }
      }
    })().finally(() => {
      flushInFlight = null;
    });

    return flushInFlight;
  }

  return { start: startLogWriter, stop: stopLogWriter, enqueue: enqueueLogEvent, flush: flushLogQueue };
}

const defaultWriter = createLogWriter();
export const startLogWriter = defaultWriter.start;
export const stopLogWriter = defaultWriter.stop;
export const enqueueLogEvent = defaultWriter.enqueue;
export const flushLogQueue = defaultWriter.flush;
