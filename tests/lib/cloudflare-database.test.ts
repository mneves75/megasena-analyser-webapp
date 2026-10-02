// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { getDatabase, runWithDatabase, createDurableDatabase } from '@/lib/cloudflare/database';
import { withDatabaseTransaction } from '@/lib/db-transaction';

describe('Worker database request scopes', () => {
  it('rejects unscoped access and isolates overlapping asynchronous scopes', async () => {
    expect(() => getDatabase()).toThrow(/scope/i);
    const first = { exec: vi.fn(), prepare: vi.fn() };
    const second = { exec: vi.fn(), prepare: vi.fn() };
    await Promise.all([
      runWithDatabase(first, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        expect(getDatabase()).toBe(first);
      }),
      runWithDatabase(second, async () => {
        await Promise.resolve();
        expect(getDatabase()).toBe(second);
      }),
    ]);
    expect(() => getDatabase()).toThrow(/scope/i);
  });

  it('uses storage transactions and materializes SQL cursor results', () => {
    const storage = { sql: { exec: vi.fn((sql: string) => ({ toArray: () => sql.includes('changes()') ? [{ changes: 1 }] : [{ count: 3 }] })) }, transactionSync: vi.fn(fn => fn()) };
    const db = createDurableDatabase(storage);
    expect(db.prepare('SELECT count(*) AS count FROM draws').get()).toEqual({ count: 3 });
    expect(db.prepare('SELECT * FROM draws').all()).toEqual([{ count: 3 }]);
    expect(db.prepare('INSERT INTO draws VALUES (?)').run(1)).toEqual({ changes: 1 });
    withDatabaseTransaction(db, () => db.exec('SELECT 1'));
    expect(storage.transactionSync).toHaveBeenCalledOnce();
    expect(storage.sql.exec.mock.calls.flat().join(' ')).not.toMatch(/BEGIN|SAVEPOINT/);
  });
});

describe('synchronous database transactions', () => {
  it('does not confuse Bun native transaction factories with a synchronous adapter hook', () => {
    const mutation = vi.fn();
    const db = { exec: vi.fn(), prepare: vi.fn(), transaction: vi.fn(fn => fn) };
    withDatabaseTransaction(db, mutation);
    expect(mutation).toHaveBeenCalledOnce();
    expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rolls back failed local nested transactions using savepoints', () => {
    const db = { exec: vi.fn(), prepare: vi.fn() };
    expect(() => withDatabaseTransaction(db, () => { throw new Error('cache failure'); })).toThrow('cache failure');
    const commands = db.exec.mock.calls.map(([sql]) => sql);
    expect(commands[0]).toMatch(/^SAVEPOINT /);
    expect(commands[1]).toMatch(/^ROLLBACK TO /);
    expect(commands[2]).toMatch(/^RELEASE /);
  });

  it('rejects asynchronous callbacks before invoking them and rolls back returned promises', () => {
    const db = { exec: vi.fn(), prepare: vi.fn() };
    const mutation = vi.fn();
    expect(() => withDatabaseTransaction(db, async () => { mutation(); })).toThrow(/synchronous/);
    expect(mutation).not.toHaveBeenCalled();
    expect(() => withDatabaseTransaction(db, () => Promise.resolve())).toThrow(/synchronous/);
    expect(db.exec.mock.calls.some(([sql]) => sql.startsWith('ROLLBACK TO'))).toBe(true);
  });
});
