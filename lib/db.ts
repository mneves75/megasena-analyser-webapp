import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'db');
const DB_PATH = path.join(DB_DIR, 'mega-sena.db');
const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

// Ensure db directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
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

  // Get list of applied migrations
  const appliedRows = database
    .prepare('SELECT name FROM migrations')
    .all() as Array<{ name: string }>;
  const appliedMigrations = appliedRows.map((row) => row.name);

  // Get list of migration files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found');
    return;
  }

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of migrationFiles) {
    if (!appliedMigrations.includes(file)) {
      console.log(`Applying migration: ${file}`);
      const migrationPath = path.join(MIGRATIONS_DIR, file);
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      
      database.exec(migration);
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      
      console.log(`✓ Migration ${file} applied successfully`);
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Initialize database on module load in development
if (process.env.NODE_ENV !== 'production') {
  runMigrations();
}

