import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueLogEvent, flushLogQueue, stopLogWriter } from '@/lib/log-store';
import { closeDatabase, getDatabase } from '@/lib/db';

beforeEach(() => { closeDatabase(); });

afterEach(async () => {
  await stopLogWriter();
});

describe('log-store', () => {
  it('drains every queued batch before shutdown resolves', async () => {
    const db = getDatabase();
    for (let index = 0; index < 1000; index++) {
      enqueueLogEvent({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'log.shutdown_test',
      });
    }
    await stopLogWriter();
    const row = db.prepare('SELECT count(*) as count FROM log_events').get() as { count: number };
    expect(row.count).toBe(1000);
  });

  it('flushes queued log events into SQLite', async () => {
    const db = getDatabase();

    enqueueLogEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'log.store_test',
      requestId: 'req_test',
      metadata: { source: 'vitest' },
    });

    await flushLogQueue('manual');

    const row = db.prepare('SELECT count(*) as count FROM log_events').get() as { count: number };
    expect(row.count).toBe(1);
  });

  it('rejects a failed shutdown flush and retains its batch for retry', async () => {
    enqueueLogEvent({ timestamp: new Date().toISOString(), level: 'info', event: 'log.retry' });
    const db = getDatabase();
    const exec = vi.spyOn(db, 'exec').mockImplementationOnce(() => { throw new Error('DB unavailable'); });
    await expect(stopLogWriter()).rejects.toThrow('DB unavailable');
    exec.mockRestore();
    await stopLogWriter();
    const row = db.prepare('SELECT count(*) as count FROM log_events').get() as { count: number };
    expect(row.count).toBe(1);
  });
});
