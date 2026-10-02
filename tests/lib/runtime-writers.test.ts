import { describe, expect, it } from 'vitest';
import { createAuditWriter } from '../../lib/audit';
import { createLogWriter } from '../../lib/log-store';
import { closeDatabase, getDatabase } from '../../lib/db';

describe('object-owned persistence buffers', () => {
  it('drains only the selected audit writer', async () => {
    closeDatabase();
    const first = createAuditWriter({ automaticFlush: false });
    const second = createAuditWriter({ automaticFlush: false });
    first.enqueue({ event: 'api.health_read', requestId: 'first' });
    second.enqueue({ event: 'api.health_read', requestId: 'second' });
    await first.stop();
    expect(getDatabase().prepare('SELECT request_id FROM audit_logs').all()).toEqual([expect.objectContaining({ request_id: 'first' })]);
    await second.stop();
    expect(getDatabase().prepare('SELECT count(*) as count FROM audit_logs').get()).toEqual({ count: 2 });
  });
  it('drains only the selected log writer', async () => {
    closeDatabase();
    const first = createLogWriter({ automaticFlush: false });
    const second = createLogWriter({ automaticFlush: false });
    first.enqueue({ timestamp: new Date().toISOString(), level: 'info', event: 'first' });
    second.enqueue({ timestamp: new Date().toISOString(), level: 'info', event: 'second' });
    await first.stop();
    expect(getDatabase().prepare('SELECT event FROM log_events').all()).toEqual([expect.objectContaining({ event: 'first' })]);
    await second.stop();
    expect(getDatabase().prepare('SELECT count(*) as count FROM log_events').get()).toEqual({ count: 2 });
  });
});
