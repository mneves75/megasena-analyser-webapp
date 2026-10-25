import path from 'path';
import fs from 'fs';
import { logger } from './logger';
import { resolveDatabasePath } from './db-path';

const REPO_DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = resolveDatabasePath();
const DB_DIR = path.dirname(DB_PATH);
// SQLite exposes application_id as a signed 32-bit integer.
const APPLICATION_ID = 0xA17E6D42 | 0;

// Primary migrations location (may be overwritten by Docker volume mount)
const PRIMARY_MIGRATIONS_DIR = path.join(REPO_DB_DIR, 'migrations');
// Backup migrations location (in Docker, survives volume mount)
const BACKUP_MIGRATIONS_DIR = path.join(process.cwd(), 'migrations-source');

// In Docker the image-owned backup is canonical because /app/db may be a stale
// persistent volume containing an older migration set.
function resolveMigrationsDir(): string {
  if (fs.existsSync(BACKUP_MIGRATIONS_DIR)) {
    const files = fs.readdirSync(BACKUP_MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
    if (files.length > 0) {
      logger.info('db.using_backup_migrations', { path: BACKUP_MIGRATIONS_DIR });
      return BACKUP_MIGRATIONS_DIR;
    }
  }
  if (fs.existsSync(PRIMARY_MIGRATIONS_DIR)) {
    const files = fs.readdirSync(PRIMARY_MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
    if (files.length > 0) {
      return PRIMARY_MIGRATIONS_DIR;
    }
  }
  return PRIMARY_MIGRATIONS_DIR; // Fallback for error handling
}

const MIGRATIONS_DIR = resolveMigrationsDir();

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

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function verifyAuditSchema(database: BunDatabase): void {
  const auditColumns = database
    .prepare('PRAGMA table_info(audit_logs)')
    .all() as Array<{ name: string }>;

  if (auditColumns.length === 0) {
    logger.error('db.audit_schema_missing', {
      migration: '004_audit_logs.sql',
    });
    throw new Error('Audit log schema missing after migrations.');
  }

  if (auditColumns.some((column) => column.name === 'deleted_at')) {
    logger.error('db.audit_schema_soft_delete_present', {
      migration: '006_remove_deleted_at.sql',
    });
    throw new Error('Audit log schema still includes deleted_at after migrations.');
  }
}

function verifyLogSchema(database: BunDatabase): void {
  const logColumns = database
    .prepare('PRAGMA table_info(log_events)')
    .all() as Array<{ name: string }>;

  if (logColumns.length === 0) {
    logger.error('db.log_schema_missing', {
      migration: '005_log_events.sql',
    });
    throw new Error('Log events schema missing after migrations.');
  }

  if (logColumns.some((column) => column.name === 'deleted_at')) {
    logger.error('db.log_schema_soft_delete_present', {
      migration: '006_remove_deleted_at.sql',
    });
    throw new Error('Log events schema still includes deleted_at after migrations.');
  }
}

let db: BunDatabase | null = null;
// Vitest runs on Node: each database is a fresh in-memory SQLite carrying the real migrations.
const useMemoryDb = Boolean(process.env['VITEST']) && process.env['VITEST_FORCE_FILE_DB'] !== '1';

// Ensure db directory exists
ensureDirectory(DB_DIR);

/**
 * Get database instance (synchronous). Opens it lazily on first use to avoid
 * Next.js static analysis issues.
 */
export function getDatabase(): BunDatabase {
  if (!db) {
    db = initializeDatabase();
    if (useMemoryDb) runMigrations();
  }
  return db;
}

function initializeDatabase(): BunDatabase {
  // This application is designed to run with Bun runtime only
  // If not running with Bun, the bun:sqlite import will fail appropriately
  let database: BunDatabase | undefined;
  try {
    if (useMemoryDb) {
      const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
      database = new DatabaseSync(':memory:') as unknown as BunDatabase;
    } else {
      const { Database } = require('bun:sqlite');
      database = new Database(DB_PATH) as BunDatabase;
    }
    database.exec('PRAGMA busy_timeout = 5000');
    database.exec('PRAGMA journal_mode = WAL');
    database.exec('PRAGMA synchronous = NORMAL');
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA temp_store = MEMORY');
    database.exec('PRAGMA cache_size = -8000');
    database.exec('PRAGMA wal_autocheckpoint = 1000');
    database.exec('PRAGMA journal_size_limit = 5242880');
    database.exec('PRAGMA trusted_schema = OFF');
    const identity = database.prepare('PRAGMA application_id').get() as { application_id: number };
    if (identity.application_id === 0) {
      database.exec(`PRAGMA application_id = ${APPLICATION_ID}`);
    } else if (identity.application_id !== APPLICATION_ID) {
      throw new Error('Database belongs to a different application.');
    }
    return database;
  } catch (error) {
    database?.close();
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
    logger.error('db.migrations_dir_missing');
    throw new Error('Migrations directory missing; cannot verify database schema.');
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
            .prepare(`
              INSERT INTO migrations (name, status, error_message)
              VALUES (?, 'success', NULL)
              ON CONFLICT(name) DO UPDATE SET
                status = 'success',
                error_message = NULL,
                applied_at = CURRENT_TIMESTAMP
            `)
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
            .prepare(`
              INSERT INTO migrations (name, status, error_message)
              VALUES (?, 'failed', ?)
              ON CONFLICT(name) DO UPDATE SET
                status = 'failed',
                error_message = excluded.error_message,
                applied_at = CURRENT_TIMESTAMP
            `)
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

  verifyAuditSchema(database);
  verifyLogSchema(database);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
