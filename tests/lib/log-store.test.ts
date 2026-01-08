import { afterEach, describe, expect, it } from 'vitest';
import { enqueueLogEvent, flushLogQueue, stopLogWriter } from '@/lib/log-store';
import { getDatabase } from '@/lib/db';

afterEach(async () => {
  await stopLogWriter();
});

describe('log-store', () => {
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
});
