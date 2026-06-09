import { getDatabase } from './db';
import { logger } from './logger';

export interface AuditRetentionResult {
  cutoffIso: string;
  eligibleCount: number;
  deletedCount?: number;
  executedAt: string;
  dryRun: boolean;
}

export interface AuditRetentionOptions {
  retentionDays?: number;
  beforeIso?: string;
  dryRun?: boolean;
  reason?: string;
}

function isoCutoffFromDays(days: number): string {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

export async function runAuditRetention(options: AuditRetentionOptions): Promise<AuditRetentionResult> {
  const retentionDays = typeof options.retentionDays === 'number' ? options.retentionDays : 365;
  const cutoffIso = options.beforeIso ?? isoCutoffFromDays(retentionDays);
  const executedAt = new Date().toISOString();
  const reason = options.reason ?? 'manual';
  const dryRun = options.dryRun ?? false;

  const db = getDatabase();

  try {
    const eligible = db
      .prepare('SELECT COUNT(*) as count FROM audit_logs WHERE timestamp < ?')
      .get(cutoffIso) as { count: number };

    if (dryRun) {
      logger.info('audit.retention_dry_run', {
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
      .prepare('DELETE FROM audit_logs WHERE timestamp < ?')
      .run(cutoffIso) as unknown as { changes?: number };
    const deletedCount = typeof result?.changes === 'number' ? result.changes : undefined;

    logger.info('audit.retention_applied', {
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
    logger.error('audit.retention_failed', error, {
      cutoff: cutoffIso,
      reason,
    });
    throw error;
  }
}

export function startAuditRetentionScheduler(retentionDays: number, intervalMs: number): () => void {
  let inFlight = false;

  const run = async (reason: string) => {
    if (inFlight) {
      logger.warn('audit.retention_skipped', { reason: 'in_flight', nextReason: reason });
      return;
    }
    inFlight = true;
    try {
      await runAuditRetention({ retentionDays, reason });
    } catch (error) {
      logger.error('audit.retention_scheduler_failed', error, { reason });
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
