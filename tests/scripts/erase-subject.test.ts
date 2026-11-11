// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pseudonymizeClient } from '@/lib/security/pseudonymize';
import { rateLimitSubject } from '@/lib/security/http';

/**
 * `bun run privacy:subject` under Bun against a temporary database: two clients,
 * rows in two 30-day salt windows, in both audit_logs and log_events.
 */

const REPO = process.cwd();
const SECRET = 'public-erase-subject-test-secret-0123456789';
const CLIENT_A = '203.0.113.7';
const CLIENT_A_V6 = '2001:db8:1:2::5';
const CLIENT_B = '198.51.100.9';
// Salt windows 2 and 3 after the 2026-01-01 epoch.
const WINDOW_ONE = '2026-03-05T10:00:00.000Z';
const WINDOW_TWO = '2026-04-10T10:00:00.000Z';
const RANGE = ['--from', '2026-03-01', '--to', '2026-04-30'];
const HASH = /^hmac-sha256:v1:\d+:[0-9a-f]{64}$/;

const hashAt = (address: string, iso: string) =>
  pseudonymizeClient(rateLimitSubject(address), SECRET, new Uint8Array(0), Date.parse(iso));

describe('privacy:subject', () => {
  let directory: string;
  let template: string;
  let counter = 0;
  const { IP_HASH_SECRET: _secret, ...inherited } = process.env;
  const baseEnv = { ...inherited, VITEST: '', VITEST_FORCE_FILE_DB: '1', NODE_ENV: 'test' };

  function bun(args: string[], database: string, extra: Record<string, string> = { IP_HASH_SECRET: SECRET }) {
    return spawnSync('bun', args, {
      cwd: REPO,
      env: { ...baseEnv, DATABASE_PATH: database, ...extra },
      encoding: 'utf8',
      timeout: 30_000,
    });
  }

  const subject = (database: string, args: string[], extra?: Record<string, string>) =>
    bun(['run', 'privacy:subject', '--', ...args], database, extra);

  /** A migrated database with A's and B's rows in both windows. */
  function database(): string {
    const file = path.join(directory, `case-${++counter}.db`);
    fs.copyFileSync(template, file);
    const db = new DatabaseSync(file);
    try {
      const audit = db.prepare("INSERT INTO audit_logs (id, timestamp, event, request_id, client_id_hash) VALUES (?, ?, 'api.health', ?, ?)");
      const log = db.prepare('INSERT INTO log_events (id, timestamp, level, event, request_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)');
      const rows: [string, string, string][] = [
        ['a1', WINDOW_ONE, CLIENT_A],
        ['a2', WINDOW_TWO, CLIENT_A],
        // Same IPv6 /64 as CLIENT_A_V6: the subject is the network, not the address.
        ['a3', WINDOW_TWO, '2001:db8:1:2::abcd'],
        ['b1', WINDOW_ONE, CLIENT_B],
        ['b2', WINDOW_TWO, CLIENT_B],
      ];
      for (const [id, timestamp, address] of rows) {
        const clientId = hashAt(address, timestamp);
        audit.run(`audit-${id}`, timestamp, `request-${id}`, clientId);
        log.run(`warn-${id}`, timestamp, 'warn', 'api.rate_limit_exceeded', `request-${id}`, JSON.stringify({ clientId }));
        // No client id in this row; it belongs to the subject through its request id.
        log.run(`done-${id}`, timestamp, 'info', 'api.request_completed', `request-${id}`, null);
      }
    } finally {
      db.close();
    }
    return file;
  }

  function ids(file: string, table: 'audit_logs' | 'log_events'): string[] {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      return (db.prepare(`SELECT id FROM ${table} WHERE request_id LIKE 'request-%' ORDER BY id`).all() as { id: string }[]).map(row => row.id);
    } finally {
      db.close();
    }
  }

  const ALL_AUDIT = ['audit-a1', 'audit-a2', 'audit-a3', 'audit-b1', 'audit-b2'];
  const ALL_LOGS = ['done-a1', 'done-a2', 'done-a3', 'done-b1', 'done-b2', 'warn-a1', 'warn-a2', 'warn-a3', 'warn-b1', 'warn-b2'];

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'megasena-erase-'));
    template = path.join(directory, 'template.db');
    const migrated = bun(['-e', "import { runMigrations, closeDatabase } from './lib/db.ts'; runMigrations(); closeDatabase();"], template);
    expect(migrated.status, migrated.stderr).toBe(0);
  }, 60_000);

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('erases only client A rows, in both tables and both salt windows, printing only counts', () => {
    const file = database();
    const result = subject(file, ['--ip', `${CLIENT_A},${CLIENT_A_V6}`, ...RANGE, '--erase']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ mode: 'erase', dryRun: false, auditLogs: 3, logEvents: 6 });
    // stderr holds Bun's echo of the command line, which the operator typed.
    expect(result.stdout).not.toContain(CLIENT_A);
    expect(result.stdout + result.stderr).not.toContain(SECRET);
    expect(ids(file, 'audit_logs')).toEqual(['audit-b1', 'audit-b2']);
    expect(ids(file, 'log_events')).toEqual(['done-b1', 'done-b2', 'warn-b1', 'warn-b2']);
  }, 30_000);

  it('a dry run prints the counts and deletes nothing', () => {
    const file = database();
    const result = subject(file, ['--ip', `${CLIENT_A},${CLIENT_A_V6}`, ...RANGE, '--erase', '--dry-run']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ mode: 'erase', dryRun: true, auditLogs: 3, logEvents: 6 });
    expect(ids(file, 'audit_logs')).toEqual(ALL_AUDIT);
    expect(ids(file, 'log_events')).toEqual(ALL_LOGS);
  }, 30_000);

  it('exports exactly client A rows', () => {
    const file = database();
    const result = subject(file, ['--ip', CLIENT_A, ...RANGE, '--export']);
    expect(result.status, result.stderr).toBe(0);
    const exported = JSON.parse(result.stdout) as { auditLogs: { id: string }[]; logEvents: { id: string }[] };
    expect(exported.auditLogs.map(row => row.id).sort()).toEqual(['audit-a1', 'audit-a2']);
    expect(exported.logEvents.map(row => row.id).sort()).toEqual(['done-a1', 'done-a2', 'warn-a1', 'warn-a2']);
    expect(ids(file, 'audit_logs')).toEqual(ALL_AUDIT);
  }, 30_000);

  it('writes a Worker query batch holding only hex hashes, without touching the local database', () => {
    const file = database();
    const out = path.join(directory, `batch-${counter}.json`);
    const result = subject(file, ['--ip', `${CLIENT_A},${CLIENT_A_V6}`, ...RANGE, '--erase', '--sql-out', out]);
    expect(result.status, result.stderr).toBe(0);
    const text = fs.readFileSync(out, 'utf8');
    expect(text).not.toContain(CLIENT_A);
    expect(text).not.toContain('2001:db8');
    const batch = JSON.parse(text) as { sql: string; params: unknown[] }[];
    expect(batch.length).toBeGreaterThan(0);
    for (const query of batch) {
      expect(query.sql).toMatch(/^DELETE FROM (audit_logs|log_events) /);
      // Every parameter is either the JSON list of hashes or a bound of the period.
      const range = query.params.slice(-2);
      expect(range).toEqual(['2026-03-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z']);
      for (const list of query.params.slice(0, -2)) {
        const hashes = JSON.parse(String(list)) as string[];
        expect(hashes.length).toBeGreaterThan(0);
        expect(hashes.every(hash => HASH.test(hash))).toBe(true);
      }
    }
    expect(ids(file, 'audit_logs')).toEqual(ALL_AUDIT);
  }, 30_000);

  /** A rate-limited request to an unknown route: a warning carrying the client id, a completion log, no audit row. */
  function addUnknownRouteRejections(file: string): void {
    const db = new DatabaseSync(file);
    try {
      const log = db.prepare('INSERT INTO log_events (id, timestamp, level, event, request_id, metadata_json) VALUES (?, ?, ?, ?, ?, ?)');
      for (const [id, address] of [['ua', CLIENT_A], ['ub', CLIENT_B]] as const) {
        const clientId = hashAt(address, WINDOW_ONE);
        log.run(`warn-${id}`, WINDOW_ONE, 'warn', 'api.rate_limit_exceeded', `request-${id}`, JSON.stringify({ route: '/api/missing', clientId }));
        log.run(`done-${id}`, WINDOW_ONE, 'info', 'api.request_completed', `request-${id}`, JSON.stringify({ route: '/api/missing', status: 429 }));
      }
    } finally {
      db.close();
    }
  }

  it('follows the request id of the subject own log rows when no audit row exists', () => {
    const exportFile = database();
    addUnknownRouteRejections(exportFile);
    const exported = subject(exportFile, ['--ip', CLIENT_A, ...RANGE, '--export']);
    expect(exported.status, exported.stderr).toBe(0);
    const rows = JSON.parse(exported.stdout) as { logEvents: { id: string }[] };
    expect(rows.logEvents.map(row => row.id).sort()).toEqual(['done-a1', 'done-a2', 'done-ua', 'warn-a1', 'warn-a2', 'warn-ua']);

    const eraseFile = database();
    addUnknownRouteRejections(eraseFile);
    const erased = subject(eraseFile, ['--ip', CLIENT_A, ...RANGE, '--erase']);
    expect(erased.status, erased.stderr).toBe(0);
    expect(JSON.parse(erased.stdout)).toEqual({ mode: 'erase', dryRun: false, auditLogs: 2, logEvents: 6 });
    expect(ids(eraseFile, 'log_events')).toEqual(['done-a3', 'done-b1', 'done-b2', 'done-ub', 'warn-a3', 'warn-b1', 'warn-b2', 'warn-ub']);
  }, 30_000);

  it('includes the salt window before the first one: a request that straddled the boundary', () => {
    // 2026-04-01 starts salt window 3; the hash was taken when the request began, in window 2.
    const started = '2026-03-31T23:59:59.900Z';
    const stamped = '2026-04-01T00:00:00.500Z';
    const straddle = (file: string) => {
      const db = new DatabaseSync(file);
      try {
        const audit = db.prepare("INSERT INTO audit_logs (id, timestamp, event, request_id, client_id_hash) VALUES (?, ?, 'api.health', ?, ?)");
        for (const [id, address] of [['sa', CLIENT_A], ['sb', CLIENT_B]] as const) {
          audit.run(`audit-${id}`, stamped, `request-${id}`, hashAt(address, started));
        }
      } finally {
        db.close();
      }
    };
    const range = ['--from', '2026-04-01', '--to', '2026-04-30'];

    const exportFile = database();
    straddle(exportFile);
    const exported = subject(exportFile, ['--ip', CLIENT_A, ...range, '--export']);
    expect(exported.status, exported.stderr).toBe(0);
    expect((JSON.parse(exported.stdout) as { auditLogs: { id: string }[] }).auditLogs.map(row => row.id).sort()).toEqual(['audit-a2', 'audit-sa']);

    const eraseFile = database();
    straddle(eraseFile);
    const erased = subject(eraseFile, ['--ip', CLIENT_A, ...range, '--erase']);
    expect(erased.status, erased.stderr).toBe(0);
    expect(ids(eraseFile, 'audit_logs')).toEqual(['audit-a1', 'audit-a3', 'audit-b1', 'audit-b2', 'audit-sb']);
  }, 30_000);

  it.each([
    ['an invalid IP', ['--ip', '203.0.113.300', '--erase'], { IP_HASH_SECRET: SECRET }, /--ip/],
    ['a missing secret', ['--ip', CLIENT_A, '--erase'], {}, /IP_HASH_SECRET/],
    ['both modes', ['--ip', CLIENT_A, '--erase', '--export'], { IP_HASH_SECRET: SECRET }, /exactly one of --export or --erase/],
    ['an inverted range', ['--ip', CLIENT_A, '--from', '2026-04-30', '--to', '2026-03-01', '--export'], { IP_HASH_SECRET: SECRET }, /--from/],
    ['an invalid date', ['--ip', CLIENT_A, '--from', '2026-02-30', '--export'], { IP_HASH_SECRET: SECRET }, /--from/],
  ])('fails with a clear message on %s', (_name, args, extra, message) => {
    const file = database();
    const result = subject(file, args, extra);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(message);
    expect(ids(file, 'audit_logs')).toEqual(ALL_AUDIT);
  }, 30_000);
});
