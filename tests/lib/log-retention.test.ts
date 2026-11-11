import { afterEach, describe, expect, it } from 'vitest';
import { enqueueLogEvent, flushLogQueue, stopLogWriter } from '@/lib/log-store';
import { getDatabase } from '@/lib/db';
import { deleteExpired, retentionCutoff, runRetention } from '@/lib/retention';

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

    const result = await runRetention('log_events', { beforeIso: cutoffIso, reason: 'test' });

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

    const result = await runRetention('log_events', { beforeIso: cutoffIso, reason: 'test', dryRun: true });

    expect(result.eligibleCount).toBe(1);
    expect(result.deletedCount).toBeUndefined();

    const remaining = db
      .prepare('SELECT COUNT(*) as count FROM log_events')
      .get() as { count: number };
    expect(remaining.count).toBeGreaterThanOrEqual(1);
  });
});

describe('deleteExpired', () => {
  it('deletes rows strictly older than the ISO cutoff and keeps the row at it', () => {
    const db = getDatabase();
    const now = Date.parse('2026-06-01T12:00:00.000Z');
    const cutoff = retentionCutoff(30, now);
    expect(cutoff).toBe('2026-05-02T12:00:00.000Z');
    const rows = [
      ['boundary-older', new Date(Date.parse(cutoff) - 1).toISOString()],
      ['boundary-at', cutoff],
      ['boundary-newer', new Date(Date.parse(cutoff) + 1).toISOString()],
    ];
    for (const [id, timestamp] of rows) {
      db.prepare('INSERT INTO log_events (id, timestamp, level, event) VALUES (?, ?, ?, ?)').run(id, timestamp, 'info', 'test');
    }

    deleteExpired('log_events', 30, now);

    const kept = db.prepare("SELECT id FROM log_events WHERE id LIKE 'boundary-%' ORDER BY id").all() as { id: string }[];
    expect(kept.map(row => row.id)).toEqual(['boundary-at', 'boundary-newer']);
  });
});

describe('audit/log indexes after migrations', () => {
  it('keeps only the timestamp indexes that retention reads', () => {
    const names = (getDatabase()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('audit_logs', 'log_events') AND name NOT LIKE 'sqlite_autoindex_%' ORDER BY name")
      .all() as { name: string }[]).map(row => row.name);
    expect(names).toEqual(['idx_audit_logs_timestamp', 'idx_log_events_timestamp']);
  });
});
