import { AsyncLocalStorage } from 'node:async_hooks';
import type { DatabaseLike } from '@/lib/db-transaction';

export type { DatabaseLike } from '@/lib/db-transaction';

export interface SqlStorageLike {
  exec(sql: string, ...params: (string | number | null | ArrayBuffer)[]): {
    toArray(): Record<string, unknown>[];
  };
}

export interface DurableStorageLike {
  sql: SqlStorageLike;
  transactionSync<T>(callback: () => T): T;
}

const databaseScope = new AsyncLocalStorage<DatabaseLike>();

export function runWithDatabase<T>(database: DatabaseLike, callback: () => T): T {
  return databaseScope.run(database, callback);
}

export function getDatabase(): DatabaseLike {
  const database = databaseScope.getStore();
  if (!database) throw new Error('Database access requires a Durable Object request scope.');
  return database;
}

export async function getDatabaseAsync(): Promise<DatabaseLike> {
  return getDatabase();
}

function sqlBinding(value: unknown): string | number | null | ArrayBuffer {
  if (value === null || typeof value === 'string' || typeof value === 'number' || value instanceof ArrayBuffer) {
    return value;
  }
  throw new TypeError('Unsupported SQLite binding.');
}

export function createDurableDatabase(storage: DurableStorageLike): DatabaseLike {
  return {
    exec(sql) { storage.sql.exec(sql).toArray(); },
    prepare(sql) {
      const rows = (params: unknown[]) => storage.sql.exec(sql, ...params.map(sqlBinding)).toArray();
      return {
        all(...params) { return rows(params); },
        get(...params) { return rows(params)[0]; },
        run(...params) {
          rows(params);
          const result = storage.sql.exec('SELECT changes() AS changes').toArray()[0];
          return { changes: Number(result?.['changes'] ?? 0) };
        },
      };
    },
    transactionSync(callback) { return storage.transactionSync(callback); },
  };
}
