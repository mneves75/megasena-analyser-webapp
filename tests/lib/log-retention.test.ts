import { afterEach, describe, expect, it } from 'vitest';
import { enqueueLogEvent, flushLogQueue, stopLogWriter } from '@/lib/log-store';
import { getDatabase } from '@/lib/db';
import { runLogRetention } from '@/lib/log-retention';

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(async () => {
  await stopLogWriter();
});

describe('log retention', () => {
  it('hard-deletes log events older than cutoff', async () => {
    const db = getDatabase();
    const now = Date.now();
    const cutoffIso = new Date(now - DAY_MS).toISOString();

    enqueueLogEvent({
      timestamp: new Date(now - DAY_MS * 2).toISOString(),
      level: 'info',
      event: 'log.retention_old',
    });
    enqueueLogEvent({
      timestamp: new Date(now).toISOString(),
      level: 'info',
      event: 'log.retention_new',
    });

    await flushLogQueue('manual');

    const result = await runLogRetention({ beforeIso: cutoffIso, reason: 'test' });

    expect(result.eligibleCount).toBe(1);
    expect(result.deletedCount).toBe(1);

    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM log_events')
      .get() as { count: number };
    expect(remaining.count).toBe(1);
  });

  it('reports eligible rows without mutating on dry run', async () => {
    const db = getDatabase();
    const now = Date.now();
    const cutoffIso = new Date(now - DAY_MS).toISOString();

    enqueueLogEvent({
      timestamp: new Date(now - DAY_MS * 2).toISOString(),
      level: 'warn',
      event: 'log.retention_dry_run',
    });

    await flushLogQueue('manual');

    const result = await runLogRetention({ beforeIso: cutoffIso, reason: 'test', dryRun: true });

    expect(result.eligibleCount).toBe(1);
    expect(result.deletedCount).toBeUndefined();

    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM log_events')
      .get() as { count: number };
    expect(remaining.count).toBeGreaterThanOrEqual(1);
  });
});
