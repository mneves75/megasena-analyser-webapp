// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { startRetentionScheduler } from '@/lib/retention';

/**
 * Characterisation of audit/log retention: the two prune CLIs run under Bun
 * against a temporary database, and the Bun server's retention schedulers.
 */

type Table = 'audit_logs' | 'log_events';

// Adapter: the only place that names the retention module's API.
const startScheduler = (table: Table, retentionDays: number, intervalMs: number): (() => void) =>
  startRetentionScheduler(table, retentionDays, intervalMs);

const REPO = process.cwd();
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

const CLI = {
  audit_logs: { script: 'audit:prune', prefix: 'audit', defaultDays: 400 },
  log_events: { script: 'log:prune', prefix: 'log', defaultDays: 30 },
} as const;

describe('prune CLIs (bun run audit:prune / log:prune)', () => {
  let directory: string;
  let template: string;
  let counter = 0;

  const { AUDIT_RETENTION_DAYS: _audit, LOG_RETENTION_DAYS: _log, ...inherited } = process.env;
  const baseEnv = { ...inherited, VITEST: '', VITEST_FORCE_FILE_DB: '1', NODE_ENV: 'test' };

  function bun(args: string[], database: string, extra: Record<string, string> = {}) {
    return spawnSync('bun', args, {
      cwd: REPO,
      env: { ...baseEnv, DATABASE_PATH: database, ...extra },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  /** A migrated database holding seeded rows `<id>` aged in days. */
  function database(table: Table, rows: Record<string, number>): string {
    const file = path.join(directory, `case-${++counter}.db`);
    fs.copyFileSync(template, file);
    const db = new DatabaseSync(file);
    try {
      const insert = table === 'audit_logs'
        ? db.prepare("INSERT INTO audit_logs (id, timestamp, event) VALUES (?, ?, 'seed.row')")
        : db.prepare("INSERT INTO log_events (id, timestamp, level, event) VALUES (?, ?, 'info', 'seed.row')");
      for (const [id, age] of Object.entries(rows)) insert.run(id, daysAgo(age));
    } finally {
      db.close();
    }
    return file;
  }

  function seededIds(file: string, table: Table): string[] {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const rows = db.prepare(`SELECT id FROM ${table} WHERE event = 'seed.row' ORDER BY id`).all() as { id: string }[];
      return rows.map(row => row.id);
    } finally {
      db.close();
    }
  }

  function retentionEvents(file: string, prefix: string): string[] {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      const rows = db.prepare('SELECT event FROM log_events WHERE event LIKE ? ORDER BY rowid').all(`${prefix}.retention_%`) as { event: string }[];
      return rows.map(row => row.event);
    } finally {
      db.close();
    }
  }

  function prune(table: Table, file: string, args: string[] = [], extra: Record<string, string> = {}) {
    return bun(['run', CLI[table].script, '--', ...args], file, extra);
  }

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-prune-'));
    template = path.join(directory, 'template.db');
    const migrated = bun(['-e', "import { runMigrations, closeDatabase } from './lib/db.ts'; runMigrations(); closeDatabase();"], template);
    expect(migrated.status, migrated.stderr).toBe(0);
  }, 60_000);

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  describe.each(['audit_logs', 'log_events'] as const)('%s', (table) => {
    const { prefix, defaultDays } = CLI[table];

    it('a dry run deletes nothing and records its events', () => {
      const file = database(table, { old: defaultDays + 1, recent: defaultDays - 1 });
      const result = prune(table, file, ['--dry-run']);
      expect(result.status, result.stderr).toBe(0);
      expect(seededIds(file, table)).toEqual(['old', 'recent']);
      expect(retentionEvents(file, prefix)).toEqual([`${prefix}.retention_started`, `${prefix}.retention_dry_run`]);
    }, 30_000);

    it(`a real run deletes only rows older than the ${defaultDays}-day default and records its events`, () => {
      const file = database(table, { old: defaultDays + 1, recent: defaultDays - 1 });
      const result = prune(table, file);
      expect(result.status, result.stderr).toBe(0);
      expect(seededIds(file, table)).toEqual(['recent']);
      expect(retentionEvents(file, prefix)).toEqual([`${prefix}.retention_started`, `${prefix}.retention_applied`]);
    }, 30_000);

    it('--days sets the cutoff', () => {
      const file = database(table, { old: 6, recent: 4 });
      const result = prune(table, file, ['--days', '5']);
      expect(result.status, result.stderr).toBe(0);
      expect(seededIds(file, table)).toEqual(['recent']);
    }, 30_000);

    it('--before sets an absolute cutoff', () => {
      const file = database(table, { old: 3, recent: 1 });
      const result = prune(table, file, ['--before', daysAgo(2)]);
      expect(result.status, result.stderr).toBe(0);
      expect(seededIds(file, table)).toEqual(['recent']);
    }, 30_000);

    it.each([
      ['a non-positive --days', ['--days', '0']],
      ['a missing --days value', ['--days']],
      ['an invalid --before', ['--before', 'not-a-date']],
      ['--help', ['--help']],
    ])('exits 1 and deletes nothing on %s', (_label, args) => {
      const file = database(table, { old: defaultDays + 1 });
      const result = prune(table, file, args);
      expect(result.status).toBe(1);
      expect(seededIds(file, table)).toEqual(['old']);
    }, 30_000);

    it('exits 1 when the retention query fails', () => {
      const file = path.join(directory, `empty-${table}.db`);
      const result = prune(table, file);
      expect(result.status).toBe(1);
    }, 30_000);
  });

  it('audit:prune honours AUDIT_RETENTION_DAYS', () => {
    const file = database('audit_logs', { old: 11, recent: 9 });
    const result = prune('audit_logs', file, [], { AUDIT_RETENTION_DAYS: '10' });
    expect(result.status, result.stderr).toBe(0);
    expect(seededIds(file, 'audit_logs')).toEqual(['recent']);
  }, 30_000);

  it('audit:prune falls back to 400 days when AUDIT_RETENTION_DAYS is not a positive number', () => {
    const file = database('audit_logs', { old: 401, recent: 399 });
    const result = prune('audit_logs', file, [], { AUDIT_RETENTION_DAYS: '0' });
    expect(result.status, result.stderr).toBe(0);
    expect(seededIds(file, 'audit_logs')).toEqual(['recent']);
  }, 30_000);

  it('log:prune ignores LOG_RETENTION_DAYS', () => {
    const file = database('log_events', { old: 31, recent: 5 });
    const result = prune('log_events', file, [], { LOG_RETENTION_DAYS: '1' });
    expect(result.status, result.stderr).toBe(0);
    expect(seededIds(file, 'log_events')).toEqual(['recent']);
  }, 30_000);
});

describe('retention schedulers (Bun server)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([['audit_logs', 'audit'], ['log_events', 'log']] as const)(
    '%s runs at startup and on each interval, and skips a tick while a run is in flight',
    async (table, prefix) => {
      vi.useFakeTimers();
      const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const stop = startScheduler(table, 30, 1000);

      expect(info).toHaveBeenCalledWith(`${prefix}.retention_applied`, expect.objectContaining({ reason: 'startup', retentionDays: 30 }));
      // The startup run has not settled yet, so this tick is skipped.
      vi.advanceTimersByTime(1000);
      expect(warn).toHaveBeenCalledWith(`${prefix}.retention_skipped`, { reason: 'in_flight', nextReason: 'interval' });
      expect(info).not.toHaveBeenCalledWith(`${prefix}.retention_applied`, expect.objectContaining({ reason: 'interval' }));

      await vi.advanceTimersByTimeAsync(1000);
      expect(info).toHaveBeenCalledWith(`${prefix}.retention_applied`, expect.objectContaining({ reason: 'interval' }));

      stop();
      info.mockClear();
      await vi.advanceTimersByTimeAsync(5000);
      expect(info).not.toHaveBeenCalled();
    }
  );
});
