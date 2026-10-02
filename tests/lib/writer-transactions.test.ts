import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => {
  const rows: unknown[][] = [];
  let fail = false;
  return { rows, setFailure(value: boolean) { fail = value; }, database: {
    exec(sql: string) { throw new Error(`Durable Object rejects transaction SQL: ${sql}`); },
    transactionSync<T>(callback: () => T): T {
      const before = rows.length;
      try { return callback(); } catch (error) { rows.splice(before); throw error; }
    },
    prepare() { return { run(...values: unknown[]) {
      rows.push(values);
      if (fail) throw new Error('Persistence failure');
    } }; },
  } };
});
vi.mock('../../lib/db', () => ({ getDatabase: () => fixture.database }));
beforeEach(() => { vi.resetModules(); fixture.rows.splice(0); fixture.setFailure(false); });

describe('writer transaction adapters', () => {
  for (const kind of ['audit', 'log'] as const) {
    const create = async () => {
      if (kind === 'audit') {
        const { createAuditWriter } = await import('../../lib/audit');
        const writer = createAuditWriter({ automaticFlush: false });
        return { stop: writer.stop, enqueue: () => writer.enqueue({ event: 'api.health_read' }) };
      }
      const { createLogWriter } = await import('../../lib/log-store');
      const writer = createLogWriter({ automaticFlush: false });
      return { stop: writer.stop, enqueue: () => writer.enqueue({ timestamp: new Date().toISOString(), level: 'info', event: 'api.health_read' }) };
    };
    it(`${kind} uses the runtime transaction adapter without SQL BEGIN`, async () => {
      const writer = await create();
      writer.enqueue();
      await writer.stop();
      expect(fixture.rows).toHaveLength(1);
    });
    it(`${kind} rolls back a failed batch and retains it for retry`, async () => {
      const writer = await create();
      writer.enqueue();
      fixture.setFailure(true);
      await expect(writer.stop()).rejects.toThrow('Persistence failure');
      expect(fixture.rows).toHaveLength(0);
      fixture.setFailure(false);
      await writer.stop();
      expect(fixture.rows).toHaveLength(1);
    });
  }
});
