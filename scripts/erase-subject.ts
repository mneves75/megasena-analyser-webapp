#!/usr/bin/env bun
/**
 * Per-subject access and erasure (LGPD Art. 18, II, IV and V) over audit_logs
 * and log_events. The titular states the IP address(es) and the period; this
 * computes the subject's `client_id_hash` for every 30-day salt window in that
 * period, and the one just before it, exactly as the request path does (rateLimitSubject, then
 * pseudonymizeClient), and selects:
 *   - audit_logs rows carrying one of those hashes;
 *   - log_events rows carrying one in metadata `clientId`, or sharing a
 *     request id with one of those audit rows or of those log rows.
 *
 * --export prints the rows as JSON. --erase deletes them in one transaction on
 * the Bun database (DATABASE_PATH) and prints only counts; --dry-run counts
 * without deleting. --sql-out writes the same statements as a
 * `cf durable-objects namespaces query --queries @<file>` batch for the Worker
 * database instead of touching the local one; its parameters are hashes and
 * dates only, never an address.
 *
 * IP_HASH_SECRET comes from the environment, never an argument, and is never printed.
 */

import fs from 'node:fs';
import { isIP } from 'node:net';
import { closeDatabase, getDatabase } from '@/lib/db';
import { withDatabaseTransaction } from '@/lib/db-transaction';
import { rateLimitSubject } from '@/lib/security/http';
import { pseudonymizeClient } from '@/lib/security/pseudonymize';

const USAGE =
  'Usage: bun run privacy:subject -- --ip <addr>[,<addr>...] [--from YYYY-MM-DD] [--to YYYY-MM-DD]\n' +
  '         (--export | --erase) [--sql-out <file>] [--dry-run]';
const DAY_MS = 86_400_000;
// The audit retention horizon (lib/retention.ts): no older row can exist.
const DEFAULT_HORIZON_DAYS = 400;

type Mode = 'export' | 'erase';

interface SubjectRequest {
  subjects: string[];
  fromMs: number;
  toExclusiveMs: number;
  mode: Mode;
  dryRun: boolean;
  sqlOut?: string;
}

function parseDay(flag: string, value: string | undefined): number {
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : Number.NaN;
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(`${flag} must be a valid date (YYYY-MM-DD)`);
  }
  return parsed;
}

function parseArgs(argv: string[], now: number): SubjectRequest {
  let ips: string[] | undefined;
  let from: number | undefined;
  let to: number | undefined;
  const modes = new Set<Mode>();
  let dryRun = false;
  let sqlOut: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const value = argv[index + 1];
    switch (token) {
      case '--ip':
        ips = (value ?? '').split(',').map(address => address.trim());
        if (ips.some(address => isIP(address) === 0)) throw new Error('--ip takes IPv4 or IPv6 addresses, comma-separated');
        index++;
        break;
      case '--from': from = parseDay('--from', value); index++; break;
      case '--to': to = parseDay('--to', value); index++; break;
      case '--export': modes.add('export'); break;
      case '--erase': modes.add('erase'); break;
      case '--dry-run': dryRun = true; break;
      case '--sql-out':
        if (!value) throw new Error('--sql-out needs a file path');
        sqlOut = value;
        index++;
        break;
      default:
        throw new Error(`Unknown argument ${String(token)}\n${USAGE}`);
    }
  }

  if (!ips) throw new Error(`--ip is required\n${USAGE}`);
  if (modes.size !== 1) throw new Error(`Choose exactly one of --export or --erase\n${USAGE}`);
  const [mode] = [...modes] as [Mode];
  if (dryRun && mode !== 'erase') throw new Error('--dry-run applies only to --erase');
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  const fromMs = from ?? today - DEFAULT_HORIZON_DAYS * DAY_MS;
  const toMs = to ?? today;
  if (fromMs > toMs) throw new Error('--from must not be after --to');
  return { subjects: [...new Set(ips.map(rateLimitSubject))], fromMs, toExclusiveMs: toMs + DAY_MS, mode, dryRun, ...(sqlOut ? { sqlOut } : {}) };
}

/**
 * The subject's pseudonyms in every salt window the period touches (one per day,
 * deduplicated), plus the window in force just before the period: the hash is
 * taken when a request starts and its rows are stamped later, so a request that
 * straddles a window boundary leaves the previous window's hash on rows inside
 * the next one.
 */
function subjectHashes(subjects: string[], secret: string, fromMs: number, toExclusiveMs: number): string[] {
  const instants = [fromMs - 1];
  for (let day = fromMs; day < toExclusiveMs; day += DAY_MS) instants.push(day);
  const hashes = new Set<string>();
  for (const instant of instants) {
    for (const subject of subjects) hashes.add(pseudonymizeClient(subject, secret, new Uint8Array(0), instant));
  }
  return [...hashes];
}

// Hashes travel as one JSON array parameter; the SQL text is fixed.
const RANGE = 'timestamp >= ? AND timestamp < ?';
const AUDIT_WHERE = `client_id_hash IN (SELECT value FROM json_each(?)) AND ${RANGE}`;
const LOG_CLIENT = `CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.clientId') END IN (SELECT value FROM json_each(?))`;
// A rate-limited unknown route writes a warning with the client id and a completion
// log, but no audit row: the request id is followed from both tables.
const LOG_WHERE = `(${LOG_CLIENT}
  OR request_id IN (SELECT request_id FROM audit_logs WHERE client_id_hash IN (SELECT value FROM json_each(?)) AND request_id IS NOT NULL)
  OR request_id IN (SELECT request_id FROM log_events WHERE ${LOG_CLIENT} AND request_id IS NOT NULL))
  AND ${RANGE}`;

interface Query { sql: string; params: string[] }

function queries(request: SubjectRequest, hashes: string[]): { logs: (select: string) => Query; audit: (select: string) => Query } {
  const list = JSON.stringify(hashes);
  const range = [new Date(request.fromMs).toISOString(), new Date(request.toExclusiveMs).toISOString()];
  return {
    logs: select => ({ sql: `${select} log_events WHERE ${LOG_WHERE}`, params: [list, list, list, ...range] }),
    audit: select => ({ sql: `${select} audit_logs WHERE ${AUDIT_WHERE}`, params: [list, ...range] }),
  };
}

function main(): void {
  const request = parseArgs(process.argv.slice(2), Date.now());
  const secret = process.env['IP_HASH_SECRET']?.trim() ?? '';
  if (secret.length < 32) throw new Error('IP_HASH_SECRET must be set in the environment (at least 32 characters)');
  const { logs, audit } = queries(request, subjectHashes(request.subjects, secret, request.fromMs, request.toExclusiveMs));

  // log_events first: its request-id match reads the audit rows being erased.
  const statement = request.mode === 'export' ? 'SELECT * FROM' : request.dryRun ? 'SELECT COUNT(*) AS count FROM' : 'DELETE FROM';
  if (request.sqlOut) {
    const batch = [logs(statement), audit(statement)];
    fs.writeFileSync(request.sqlOut, `${JSON.stringify(batch, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ mode: request.mode, dryRun: request.dryRun, queries: batch.length }));
    return;
  }

  const db = getDatabase();
  try {
    if (request.mode === 'export') {
      const run = (query: Query) => db.prepare(`${query.sql} ORDER BY timestamp`).all(...query.params);
      console.log(JSON.stringify({ auditLogs: run(audit('SELECT * FROM')), logEvents: run(logs('SELECT * FROM')) }, null, 2));
      return;
    }
    const count = (query: Query) => (db.prepare(query.sql).get(...query.params) as { count: number }).count;
    const counts = withDatabaseTransaction(db, () => {
      const result = { auditLogs: count(audit('SELECT COUNT(*) AS count FROM')), logEvents: count(logs('SELECT COUNT(*) AS count FROM')) };
      if (!request.dryRun) {
        for (const query of [logs('DELETE FROM'), audit('DELETE FROM')]) db.prepare(query.sql).run(...query.params);
      }
      return result;
    });
    console.log(JSON.stringify({ mode: 'erase', dryRun: request.dryRun, ...counts }));
  } finally {
    closeDatabase();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
