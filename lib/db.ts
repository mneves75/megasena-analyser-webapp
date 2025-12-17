import path from 'path';
import fs from 'fs';
import { logger } from './logger';

const DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'mega-sena.db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

// Type for Bun's Database
type PreparedStatement = {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

type BunDatabase = {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  close(): void;
};

type NumberFrequencyRow = {
  number: number;
  frequency: number;
  last_drawn_contest: number | null;
  last_drawn_date: string | null;
  updated_at: string | null;
};

type DrawRow = {
  contest_number: number;
  draw_date: string;
  numbers: [number, number, number, number, number, number];
  prize_sena: number;
  prize_quina: number;
  winners_sena: number;
  accumulated: number;
};

type AuditLogRow = {
  id: string;
  timestamp: string;
  event: string;
  request_id: string | null;
  route: string | null;
  method: string | null;
  status_code: number | null;
  success: 0 | 1;
  duration_ms: number | null;
  client_id_hash: string | null;
  user_agent: string | null;
  metadata_json: string | null;
  deleted_at: string | null;
};

type CountResult = { count: number };

type AvgResult = { avg: number | null };

type LastDrawResult = { contest_number: number; draw_date: string } | undefined;

type PatternResult = { occurrences: number; last_seen: string | null };

const isVitest = typeof process !== 'undefined' && Boolean(process.env?.VITEST);

class InMemoryStatement implements PreparedStatement {
  constructor(private readonly db: InMemoryDatabase, private readonly sql: string) {}

  private ensureOpen(): void {
    if (this.db.closed) {
      throw new Error('Database is closed');
    }
  }

  run(...params: unknown[]): unknown {
    this.ensureOpen();
    return this.db.executeRun(this.sql, params);
  }

  get(...params: unknown[]): unknown {
    this.ensureOpen();
    return this.db.executeGet(this.sql, params);
  }

  all(...params: unknown[]): unknown[] {
    this.ensureOpen();
    return this.db.executeAll(this.sql, params);
  }
}

class InMemoryDatabase implements BunDatabase {
  numberFrequency: Map<number, NumberFrequencyRow> = new Map();
  draws: DrawRow[] = [];
  auditLogs: AuditLogRow[] = [];
  closed = false;

  exec(_sql: string): void {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    // Schema statements are no-op in tests.
  }

  prepare(sql: string): PreparedStatement {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    return new InMemoryStatement(this, sql);
  }

  close(): void {
    this.closed = true;
  }

  initialize(): void {
    this.closed = false;
    this.numberFrequency.clear();
    this.draws = [];
    this.auditLogs = [];
  }

  executeRun(rawSql: string, params: unknown[]): unknown {
    const sql = normalizeSql(rawSql);

    if (sql.startsWith('delete from draws')) {
      this.draws = [];
      return null;
    }

    if (sql.startsWith('delete from number_frequency')) {
      this.numberFrequency.clear();
      return null;
    }

    if (sql.startsWith('update number_frequency set frequency = 0')) {
      for (const row of this.numberFrequency.values()) {
        row.frequency = 0;
        row.last_drawn_contest = null;
        row.last_drawn_date = null;
        row.updated_at = currentTimestamp();
      }
      return null;
    }

    const directFrequencyUpdate = sql.match(/^update number_frequency set frequency = ([0-9]+) where number = ([0-9]+)/);
    if (directFrequencyUpdate) {
      const [, frequencyValue, numberValue] = directFrequencyUpdate;
      const row = this.getOrCreateFrequencyRow(Number(numberValue));
      row.frequency = Number(frequencyValue);
      row.updated_at = currentTimestamp();
      return null;
    }

    if (sql.startsWith('insert into number_frequency')) {
      const number = Number(params[0]);
      const frequency = params.length > 1 ? Number(params[1]) : 0;
      this.numberFrequency.set(number, {
        number,
        frequency,
        last_drawn_contest: null,
        last_drawn_date: null,
        updated_at: currentTimestamp(),
      });
      return null;
    }

    if (sql.startsWith('insert into draws')) {
      const columnValues = parseDrawInsert(rawSql, params);

      const getValue = (key: string): unknown => columnValues[key];
      const contestNumber = toNumberValue(getValue('contest_number'));
      const drawDateValue = getValue('draw_date');

      if (contestNumber === null || typeof drawDateValue === 'undefined') {
        throw new Error('Missing required draw fields');
      }

      const numbers = [1, 2, 3, 4, 5, 6].map((index) =>
        toNumberValue(getValue(`number_${index}`), 0)
      ) as [number, number, number, number, number, number];

      this.draws.push({
        contest_number: contestNumber,
        draw_date: String(drawDateValue),
        numbers,
        prize_sena: toNumberValue(getValue('prize_sena')),
        prize_quina: toNumberValue(getValue('prize_quina')),
        winners_sena: toNumberValue(getValue('winners_sena')),
        accumulated: toNumberValue(getValue('accumulated')),
      });
      return null;
    }

    if (sql.startsWith('update number_frequency set frequency = ?')) {
      const [frequency, lastContest, lastDate, number] = params;
      const row = this.getOrCreateFrequencyRow(Number(number));
      row.frequency = Number(frequency);
      row.last_drawn_contest = lastContest === null ? null : Number(lastContest);
      row.last_drawn_date = typeof lastDate === 'string' ? lastDate : lastDate === null ? null : String(lastDate);
      row.updated_at = currentTimestamp();
      return null;
    }

    if (sql.startsWith('insert into migrations')) {
      // Ignore migrations bookkeeping in-memory.
      return null;
    }

    if (sql.startsWith('insert into audit_logs')) {
      const [
        id,
        timestamp,
        event,
        requestId,
        route,
        method,
        statusCode,
        success,
        durationMs,
        clientIdHash,
        userAgent,
        metadataJson,
      ] = params;

      this.auditLogs.push({
        id: String(id),
        timestamp: String(timestamp),
        event: String(event),
        request_id: requestId === null || typeof requestId === 'undefined' ? null : String(requestId),
        route: route === null || typeof route === 'undefined' ? null : String(route),
        method: method === null || typeof method === 'undefined' ? null : String(method),
        status_code: statusCode === null || typeof statusCode === 'undefined' ? null : Number(statusCode),
        success: Number(success) === 0 ? 0 : 1,
        duration_ms: durationMs === null || typeof durationMs === 'undefined' ? null : Number(durationMs),
        client_id_hash:
          clientIdHash === null || typeof clientIdHash === 'undefined' ? null : String(clientIdHash),
        user_agent: userAgent === null || typeof userAgent === 'undefined' ? null : String(userAgent),
        metadata_json:
          metadataJson === null || typeof metadataJson === 'undefined' ? null : String(metadataJson),
        deleted_at: null,
      });

      return null;
    }

    if (sql.startsWith('update audit_logs set deleted_at = ?')) {
      const [deletedAtRaw, cutoffRaw] = params;
      const deletedAt = String(deletedAtRaw);
      const cutoff = String(cutoffRaw);

      let changes = 0;
      for (const row of this.auditLogs) {
        if (row.deleted_at === null && row.timestamp < cutoff) {
          row.deleted_at = deletedAt;
          changes++;
        }
      }

      return { changes };
    }

    return null;
  }

  executeGet(rawSql: string, params: unknown[]): unknown {
    const sql = normalizeSql(rawSql);

    if (sql.startsWith('select count(*) as count from draws where number_')) {
      const column = getNumberColumn(sql);
      const target = Number(params[0]);
      const count = this.draws.filter((draw) => draw.numbers[column - 1] === target).length;
      return ({ count } satisfies CountResult);
    }

    if (sql.startsWith('select contest_number, draw_date from draws where number_')) {
      const column = getNumberColumn(sql);
      const target = Number(params[0]);
      const latest = this.draws
        .filter((draw) => draw.numbers[column - 1] === target)
        .sort((a, b) => b.contest_number - a.contest_number)[0];
      if (!latest) {
        return undefined;
      }
      return ({ contest_number: latest.contest_number, draw_date: latest.draw_date } satisfies LastDrawResult);
    }

    if (sql.startsWith('select count(*) as count from draws')) {
      if (sql.includes('where accumulated = 1')) {
        const count = this.draws.filter((draw) => draw.accumulated === 1).length;
        return ({ count } satisfies CountResult);
      }
      return ({ count: this.draws.length } satisfies CountResult);
    }

    if (sql.startsWith('select count(*) as count from audit_logs')) {
      const activeOnly = sql.includes('where deleted_at is null');
      const count = activeOnly
        ? this.auditLogs.filter((row) => row.deleted_at === null).length
        : this.auditLogs.length;
      return ({ count } satisfies CountResult);
    }

    if (sql.startsWith('select avg(prize_sena) as avg from draws')) {
      const filtered = this.draws.filter((draw) => draw.prize_sena > 0);
      const avg = filtered.length > 0 ? filtered.reduce((sum, draw) => sum + draw.prize_sena, 0) / filtered.length : null;
      return ({ avg } satisfies AvgResult);
    }

    if (sql.startsWith('select avg(prize_quina) as avg from draws')) {
      const filtered = this.draws.filter((draw) => draw.prize_quina > 0);
      const avg = filtered.length > 0 ? filtered.reduce((sum, draw) => sum + draw.prize_quina, 0) / filtered.length : null;
      return ({ avg } satisfies AvgResult);
    }

    if (sql.startsWith('select contest_number, draw_date from draws order by contest_number desc limit 1')) {
      if (this.draws.length === 0) {
        return undefined;
      }
      const latest = [...this.draws].sort((a, b) => b.contest_number - a.contest_number)[0];
      return ({ contest_number: latest.contest_number, draw_date: latest.draw_date } satisfies LastDrawResult);
    }

    if (sql.includes('number_2 = number_1 + 1')) {
      const occurrences = this.draws.filter((draw) => hasConsecutiveNumbers(draw.numbers)).length;
      const last = this.draws
        .filter((draw) => hasConsecutiveNumbers(draw.numbers))
        .sort((a, b) => b.contest_number - a.contest_number)[0];
      const result: PatternResult = { occurrences, last_seen: last?.draw_date ?? null };
      return result;
    }

    if (sql.includes('number_1 % 2 = 0 and number_2 % 2 = 0')) {
      const occurrences = this.draws.filter((draw) => draw.numbers.every((n) => n % 2 === 0)).length;
      const last = this.draws
        .filter((draw) => draw.numbers.every((n) => n % 2 === 0))
        .sort((a, b) => b.contest_number - a.contest_number)[0];
      const result: PatternResult = { occurrences, last_seen: last?.draw_date ?? null };
      return result;
    }

    return undefined;
  }

  executeAll(rawSql: string, params: unknown[]): unknown[] {
    const sql = normalizeSql(rawSql);

    if (sql.startsWith('select number, frequency, last_drawn_contest as lastdrawncontest')) {
      const sorted = [...this.numberFrequency.values()].sort((a, b) => b.frequency - a.frequency || a.number - b.number);
      return sorted.map((row) => ({
        number: row.number,
        frequency: row.frequency,
        lastDrawnContest: row.last_drawn_contest,
        lastDrawnDate: row.last_drawn_date,
      }));
    }

    if (sql.startsWith('select number from number_frequency order by frequency desc')) {
      const limit = Number(params[0]);
      return this.shuffleByFrequency('desc', limit).map((row) => ({ number: row.number }));
    }

    if (sql.startsWith('select number from number_frequency order by frequency asc')) {
      const limit = Number(params[0]);
      return this.shuffleByFrequency('asc', limit).map((row) => ({ number: row.number }));
    }

    if (sql.startsWith('select contest_number as contestnumber')) {
      const limit = Number(params[0]);
      return [...this.draws]
        .sort((a, b) => b.contest_number - a.contest_number)
        .slice(0, limit)
        .map((draw) => ({
          contestNumber: draw.contest_number,
          drawDate: draw.draw_date,
          number_1: draw.numbers[0],
          number_2: draw.numbers[1],
          number_3: draw.numbers[2],
          number_4: draw.numbers[3],
          number_5: draw.numbers[4],
          number_6: draw.numbers[5],
          prizeSena: draw.prize_sena,
          accumulated: draw.accumulated,
        }));
    }

    if (sql.startsWith('select name from migrations')) {
      return [];
    }

    if (sql.startsWith('select') && sql.includes('from audit_logs')) {
      let rows = [...this.auditLogs];
      if (sql.includes('where deleted_at is null')) {
        rows = rows.filter((row) => row.deleted_at === null);
      }

      if (sql.includes('order by timestamp desc')) {
        rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      }

      if (sql.includes('limit ?')) {
        const limit = Number(params[0]);
        rows = rows.slice(0, limit);
      }

      return rows;
    }

    return [];
  }

  private getOrCreateFrequencyRow(number: number): NumberFrequencyRow {
    if (!this.numberFrequency.has(number)) {
      this.numberFrequency.set(number, {
        number,
        frequency: 0,
        last_drawn_contest: null,
        last_drawn_date: null,
        updated_at: currentTimestamp(),
      });
    }
    return this.numberFrequency.get(number)!;
  }

  private shuffleByFrequency(order: 'asc' | 'desc', limit: number): NumberFrequencyRow[] {
    const sorted = [...this.numberFrequency.values()].sort((a, b) => {
      const diff = order === 'desc' ? b.frequency - a.frequency : a.frequency - b.frequency;
      if (diff !== 0) {
        return diff;
      }
      return Math.random() - 0.5;
    });
    return sorted.slice(0, limit);
  }
}

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

let db: BunDatabase | null = null;
let initPromise: Promise<BunDatabase> | null = null;
const inMemoryDb = isVitest && typeof Bun === 'undefined' ? new InMemoryDatabase() : null;

// Ensure db directory exists
ensureDirectory(DB_DIR);

/**
 * Get database instance (synchronous)
 * For use in synchronous contexts where database is already initialized
 * @throws Error if database is not yet initialized
 */
export function getDatabase(): BunDatabase {
  if (inMemoryDb) {
    if (db === null || (db === inMemoryDb && inMemoryDb.closed)) {
      inMemoryDb.initialize();
      db = inMemoryDb as unknown as BunDatabase;
    }
    return db;
  }

  // Note: This application is designed to run with Bun runtime only
  // The bun:sqlite module is only available in Bun runtime

  if (!db) {
    // Initialize database lazily to avoid Next.js static analysis issues
    db = initializeDatabase();
  }
  return db;
}

/**
 * Get database instance (asynchronous with race condition protection)
 * Use this in async contexts to ensure safe concurrent initialization
 * @returns Promise resolving to database instance
 */
export async function getDatabaseAsync(): Promise<BunDatabase> {
  if (db) {
    return db;
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    if (inMemoryDb) {
      inMemoryDb.initialize();
      db = inMemoryDb as unknown as BunDatabase;
      initPromise = null;
      return db;
    }

    db = initializeDatabase();
    initPromise = null;
    return db;
  })();

  return initPromise;
}

function initializeDatabase(): BunDatabase {
  // This application is designed to run with Bun runtime only
  // If not running with Bun, the bun:sqlite import will fail appropriately
  try {
    const { Database } = require('bun:sqlite');
    const database = new Database(DB_PATH) as BunDatabase;
    database.exec('PRAGMA journal_mode = WAL');
    database.exec('PRAGMA foreign_keys = ON');
    return database;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('bun:sqlite') || error.message.includes('Cannot find module'))) {
      throw new Error(
        'Database requires Bun runtime. This application must be run with Bun, not Node.js.\n' +
        'Install Bun: https://bun.sh\n' +
        'Run with: bun run dev\n' +
        'Original error: ' + error.message
      );
    }
    throw error;
  }
}

export function runMigrations(): void {
  if (inMemoryDb) {
    inMemoryDb.initialize();
    for (let number = 1; number <= 60; number++) {
      inMemoryDb.numberFrequency.set(number, {
        number,
        frequency: 0,
        last_drawn_contest: null,
        last_drawn_date: null,
        updated_at: currentTimestamp(),
      });
    }
    // Ensure shared reference stays in sync for subsequent calls
    db = inMemoryDb as unknown as BunDatabase;
    return;
  }

  const database = getDatabase();

  // Create migrations table if it doesn't exist
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if the status column exists and add it if not (for legacy database upgrade)
  try {
    const tableInfo = database
      .prepare("PRAGMA table_info(migrations)")
      .all() as Array<{ name: string }>;
    const hasStatusColumn = tableInfo.some((col) => col.name === 'status');

    if (!hasStatusColumn) {
      logger.info('db.migrations_table_schema_upgrade', {
        columnsAdded: ['status', 'error_message'],
      });
      database.exec(`
        ALTER TABLE migrations ADD COLUMN status TEXT DEFAULT 'success';
      `);
      database.exec(`
        ALTER TABLE migrations ADD COLUMN error_message TEXT;
      `);
    }
  } catch (error) {
    logger.error('db.migrations_table_schema_check_failed', error);
    throw error;
  }

  // Get list of applied successful migrations
  const appliedRows = database
    .prepare("SELECT name FROM migrations WHERE status = 'success'")
    .all() as Array<{ name: string }>;
  const appliedMigrations = appliedRows.map((row) => row.name);

  // Get list of migration files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn('db.migrations_dir_missing');
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Apply pending migrations with transaction support
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file)) {
      logger.migration(file, 'start');
      const migrationPath = path.join(MIGRATIONS_DIR, file);
      const migration = fs.readFileSync(migrationPath, 'utf-8');

      try {
        // Begin transaction for atomic migration
        database.exec('BEGIN IMMEDIATE TRANSACTION');
        
        try {
          // Execute migration
          database.exec(migration);
          
          // Record successful migration
          database
            .prepare("INSERT INTO migrations (name, status) VALUES (?, 'success')")
            .run(file);
          
          // Commit transaction
          database.exec('COMMIT');
          logger.migration(file, 'success');
        } catch (innerError) {
          // Rollback transaction on error
          database.exec('ROLLBACK');
          
          // Record failed migration
          const errorMessage = innerError instanceof Error ? innerError.message : 'Unknown error';
          database
            .prepare("INSERT INTO migrations (name, status, error_message) VALUES (?, 'failed', ?)")
            .run(file, errorMessage);
          
          throw innerError;
        }
      } catch (error) {
        logger.migration(file, 'error');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Migration ${file} failed: ${errorMessage}`);
      }
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function getNumberColumn(sql: string): number {
  const match = sql.match(/number_(\d)/);
  return match ? Number(match[1]) : 1;
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function parseDrawInsert(sql: string, params: unknown[]): Record<string, unknown> {
  const columnsMatch = sql.match(/insert\s+into\s+draws\s*\(([^)]+)\)/i);
  if (!columnsMatch) {
    throw new Error('Unable to parse draw insertion columns');
  }

  const columns = columnsMatch[1]
    .split(',')
    .map((col) => col.trim().toLowerCase());

  const valuesSectionMatch = sql.match(/values\s*\((.*)\)/is);
  if (!valuesSectionMatch) {
    throw new Error('Unable to parse draw insertion values');
  }

  const valuesSection = valuesSectionMatch[1];
  const rawValues = splitSqlValues(valuesSection);
  const columnValues: Record<string, unknown> = {};
  let paramIndex = 0;

  columns.forEach((column, index) => {
    const token = rawValues[index];
    if (!token) {
      columnValues[column] = params[paramIndex++] ?? null;
      return;
    }

    const trimmed = token.trim();
    if (trimmed === '?') {
      columnValues[column] = params[paramIndex++] ?? null;
    } else {
      columnValues[column] = parseSqlValue(trimmed);
    }
  });

  return columnValues;
}

function splitSqlValues(valuesSection: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < valuesSection.length; i++) {
    const char = valuesSection[i];
    if (char === "'" && (i === 0 || valuesSection[i - 1] !== '\\')) {
      inString = !inString;
      current += char;
    } else if (char === ',' && !inString) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    values.push(current.trim());
  }

  return values;
}

function parseSqlValue(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.toLowerCase() === 'null') {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return trimmed;
}

function hasConsecutiveNumbers(numbers: [number, number, number, number, number, number]): boolean {
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === numbers[i - 1] + 1) {
      return true;
    }
  }
  return false;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (value === null || typeof value === 'undefined') {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? fallback : numeric;
}
