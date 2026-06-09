import { getDatabase } from './db';
import { logger } from './logger';

export interface LogRetentionResult {
  cutoffIso: string;
  eligibleCount: number;
  deletedCount?: number;
  executedAt: string;
  dryRun: boolean;
}

export interface LogRetentionOptions {
  retentionDays?: number;
  beforeIso?: string;
  dryRun?: boolean;
  reason?: string;
}

function isoCutoffFromDays(days: number): string {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

export async function runLogRetention(options: LogRetentionOptions): Promise<LogRetentionResult> {
  const retentionDays = typeof options.retentionDays === 'number' ? options.retentionDays : 30;
  const cutoffIso = options.beforeIso ?? isoCutoffFromDays(retentionDays);
  const executedAt = new Date().toISOString();
  const reason = options.reason ?? 'manual';
  const dryRun = options.dryRun ?? false;

  const db = getDatabase();

  try {
    const eligible = db
      .prepare('SELECT COUNT(*) as count FROM log_events WHERE timestamp < ?')
      .get(cutoffIso) as { count: number };

    if (dryRun) {
      logger.info('log.retention_dry_run', {
        cutoff: cutoffIso,
        retentionDays: options.beforeIso ? undefined : retentionDays,
        eligibleCount: eligible.count,
        reason,
      });
      return {
        cutoffIso,
        eligibleCount: eligible.count,
        executedAt,
        dryRun,
      };
    }

    const result = db
      .prepare('DELETE FROM log_events WHERE timestamp < ?')
      .run(cutoffIso) as unknown as { changes?: number };
    const deletedCount = typeof result?.changes === 'number' ? result.changes : undefined;

    logger.info('log.retention_applied', {
      cutoff: cutoffIso,
      retentionDays: options.beforeIso ? undefined : retentionDays,
      eligibleCount: eligible.count,
      deletedCount,
      reason,
    });

    return {
      cutoffIso,
      eligibleCount: eligible.count,
      executedAt,
      dryRun,
      ...(deletedCount !== undefined ? { deletedCount } : {}),
    };
  } catch (error) {
    logger.error('log.retention_failed', error, {
      cutoff: cutoffIso,
      reason,
    });
    throw error;
  }
}

export function startLogRetentionScheduler(retentionDays: number, intervalMs: number): () => void {
  let inFlight = false;

  const run = async (reason: string) => {
    if (inFlight) {
      logger.warn('log.retention_skipped', { reason: 'in_flight', nextReason: reason });
      return;
    }
    inFlight = true;
    try {
      await runLogRetention({ retentionDays, reason });
    } catch (error) {
      logger.error('log.retention_scheduler_failed', error, { reason });
    } finally {
      inFlight = false;
    }
  };

  void run('startup');
  const timer = setInterval(() => {
    void run('interval');
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
