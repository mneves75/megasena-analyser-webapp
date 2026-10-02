export interface DatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  transactionSync?<T>(callback: () => T): T;
}

let savepointSequence = 0;

/** Both Bun savepoints and DO transactionSync preserve nested rollback semantics. */
export function withDatabaseTransaction<T>(database: DatabaseLike, callback: () => T): T {
  if (callback.constructor.name === 'AsyncFunction') {
    throw new Error('Database transaction callbacks must be synchronous.');
  }
  const execute = (): T => {
    const result = callback();
    if (result !== null && (typeof result === 'object' || typeof result === 'function') &&
        'then' in result && typeof result.then === 'function') {
      throw new Error('Database transaction callbacks must be synchronous.');
    }
    return result;
  };
  if (database.transactionSync) return database.transactionSync(execute);
  const savepoint = `database_transaction_${++savepointSequence}`;
  database.exec(`SAVEPOINT ${savepoint}`);
  try {
    const result = execute();
    database.exec(`RELEASE ${savepoint}`);
    return result;
  } catch (error) {
    database.exec(`ROLLBACK TO ${savepoint}`);
    database.exec(`RELEASE ${savepoint}`);
    throw error;
  }
}
