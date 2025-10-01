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
const inMemoryDb = isVitest && typeof Bun === 'undefined' ? new InMemoryDatabase() : null;

// Ensure db directory exists
ensureDirectory(DB_DIR);

export function getDatabase(): BunDatabase {
  if (inMemoryDb) {
    if (db === null || (db === inMemoryDb && inMemoryDb.closed)) {
      inMemoryDb.initialize();
      db = inMemoryDb as unknown as BunDatabase;
    }
    return db;
  }

  if (typeof Bun === 'undefined') {
    throw new Error(
      'Database requires Bun runtime. This application must be run with Bun, not Node.js.\n' +
      'Install Bun: https://bun.sh\n' +
      'Run with: bun run dev'
    );
  }

  if (!db) {
    // Dynamic import of bun:sqlite (only works in Bun runtime)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('bun:sqlite');
    db = new Database(DB_PATH) as BunDatabase;
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
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

  // Get list of applied migrations
  const appliedRows = database
    .prepare('SELECT name FROM migrations')
    .all() as Array<{ name: string }>;
  const appliedMigrations = appliedRows.map((row) => row.name);

  // Get list of migration files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn('No migrations directory found');
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file)) {
      logger.migration(file, 'start');
      const migrationPath = path.join(MIGRATIONS_DIR, file);
      const migration = fs.readFileSync(migrationPath, 'utf-8');

      try {
        database.exec(migration);
        database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        logger.migration(file, 'success');
      } catch (error) {
        logger.migration(file, 'error');
        throw error;
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
