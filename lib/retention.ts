import { getDatabase } from './db';
import { logger } from './logger';

/** The two tables with a retention policy on the Bun path. */
export type RetentionTable = 'audit_logs' | 'log_events';

export interface RetentionResult {
  cutoffIso: string;
  eligibleCount: number;
  deletedCount?: number;
  executedAt: string;
  dryRun: boolean;
}

export interface RetentionOptions {
  retentionDays?: number;
  beforeIso?: string;
  dryRun?: boolean;
  reason?: string;
}

// SQL stays literal per table; it is never built from the table name.
const policies = {
  audit_logs: {
    events: 'audit',
    // 400 matches the deployed policy (server.ts, cloudflare.config.ts,
    // docs/PRIVACY.md). A shorter library default silently deleted a month of
    // evidence whenever a caller omitted the argument.
    defaultDays: 400,
    countSql: 'SELECT COUNT(*) as count FROM audit_logs WHERE timestamp < ?',
    deleteSql: 'DELETE FROM audit_logs WHERE timestamp < ?',
  },
  log_events: {
    events: 'log',
    defaultDays: 30,
    countSql: 'SELECT COUNT(*) as count FROM log_events WHERE timestamp < ?',
    deleteSql: 'DELETE FROM log_events WHERE timestamp < ?',
  },
} as const satisfies Record<RetentionTable, { events: string; defaultDays: number; countSql: string; deleteSql: string }>;

function isoCutoffFromDays(days: number): string {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString();
}

/** Hard-delete rows older than the cutoff (the approved retention exception). */
export async function runRetention(table: RetentionTable, options: RetentionOptions): Promise<RetentionResult> {
  const policy = policies[table];
  const retentionDays = typeof options.retentionDays === 'number' ? options.retentionDays : policy.defaultDays;
  const cutoffIso = options.beforeIso ?? isoCutoffFromDays(retentionDays);
  const executedAt = new Date().toISOString();
  const reason = options.reason ?? 'manual';
  const dryRun = options.dryRun ?? false;

  const db = getDatabase();

  try {
    const eligible = db.prepare(policy.countSql).get(cutoffIso) as { count: number };

    if (dryRun) {
      logger.info(`${policy.events}.retention_dry_run`, {
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

    const result = db.prepare(policy.deleteSql).run(cutoffIso) as unknown as { changes?: number };
    const deletedCount = typeof result?.changes === 'number' ? result.changes : undefined;

    logger.info(`${policy.events}.retention_applied`, {
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
    logger.error(`${policy.events}.retention_failed`, error, {
      cutoff: cutoffIso,
      reason,
    });
    throw error;
  }
}

export function startRetentionScheduler(table: RetentionTable, retentionDays: number, intervalMs: number): () => void {
  const events = policies[table].events;
  let inFlight = false;

  const run = async (reason: string) => {
    if (inFlight) {
      logger.warn(`${events}.retention_skipped`, { reason: 'in_flight', nextReason: reason });
      return;
    }
    inFlight = true;
    try {
      await runRetention(table, { retentionDays, reason });
    } catch (error) {
      logger.error(`${events}.retention_scheduler_failed`, error, { reason });
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
