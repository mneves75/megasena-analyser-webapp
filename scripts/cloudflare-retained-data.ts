#!/usr/bin/env bun
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Value = string | number | null;
export interface PrivateQuery { sql: string; params: Value[] }

const tables = {
  audit_logs: ['id', 'timestamp', 'event', 'request_id', 'route', 'method', 'status_code', 'success', 'duration_ms', 'client_id_hash', 'user_agent', 'metadata_json'],
  log_events: ['id', 'timestamp', 'level', 'event', 'request_id', 'session_id', 'user_id', 'route', 'user_agent', 'launch_stage', 'duration_ms', 'status_code', 'metadata_json', 'error_json'],
  user_bets: ['id', 'bet_numbers', 'bet_date', 'contest_number', 'strategy', 'cost', 'result', 'hits', 'prize_won', 'notes'],
} as const;
type Table = keyof typeof tables;
interface Artifact { file: string; sha256: string }
interface VerificationArtifact extends Artifact { table: Table; response: string; ids: Value[] }
interface TableManifest { columns: readonly string[]; count: number; rows: { id: Value; sha256: string }[]; idMapping: string }
interface Manifest {
  version: 1;
  source: { name: string; sha256: string };
  tables: Record<Table, TableManifest>;
  imports: Artifact[];
  verification: VerificationArtifact[];
}

function hash(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
function rowHash(row: Value[]): string { return hash(JSON.stringify(row)); }
function quote(name: string): string { return `"${name.replaceAll('"', '""')}"`; }
function key(value: Value): string { return JSON.stringify(value); }

async function rejectSymlinks(filename: string): Promise<void> {
  let current = path.resolve(filename);
  while (current !== path.dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('Symlink paths are not permitted.'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    current = path.dirname(current);
  }
}

async function privateWrite(directory: string, filename: string, contents: string): Promise<Artifact> {
  await writeFile(path.join(directory, filename), contents, { mode: 0o600, flag: 'wx' });
  return { file: filename, sha256: hash(contents) };
}

function retainedInsert(table: Table, rows: Value[][]): PrivateQuery {
  const columns = tables[table];
  const identical = columns.map(column => `${quote(table)}.${quote(column)} IS excluded.${quote(column)}`).join(' AND ');
  // Exact repeats are no-ops; a divergent collision raises SQLite's JSON error atomically.
  return { sql: `INSERT INTO ${quote(table)} (${columns.map(quote).join(',')})
SELECT ${columns.map((_, index) => `json_extract(value, '$[${index}]')`).join(',')} FROM json_each(?) WHERE 1
ON CONFLICT(id) DO UPDATE SET id = json('migration conflict') WHERE NOT (${identical})`, params: [JSON.stringify(rows)] };
}

export async function prepareRetainedData(snapshot: string, output: string, batchSize = 1000): Promise<{ manifestSha256: string; counts: Record<Table, number> }> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('Batch size must be 1–1000.');
  await rejectSymlinks(snapshot);
  if (!snapshot.endsWith('.snapshot.sqlite') || !(await lstat(snapshot)).isFile()) throw new Error('Input must be a regular *.snapshot.sqlite VACUUM INTO snapshot.');
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try { await lstat(snapshot + suffix); throw new Error('Snapshot has journal companions; refuse a potentially active database.'); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  }
  const sourceHash = hash(await readFile(snapshot));
  const database = new Database(snapshot, { readonly: true });
  const data = {} as Record<Table, Value[][]>;
  try {
    const integrity = database.prepare('PRAGMA integrity_check').all() as Record<string, unknown>[];
    if (integrity.length !== 1 || integrity[0]?.['integrity_check'] !== 'ok') throw new Error('Snapshot integrity check failed.');
    const sourceTables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    for (const sourceTable of sourceTables) {
      const foreignKeys = database.prepare(`PRAGMA foreign_key_list(${quote(sourceTable.name)})`).all() as { table: string }[];
      if (foreignKeys.some(foreignKey => foreignKey.table === 'user_bets') || (sourceTable.name === 'user_bets' && foreignKeys.length > 0)) {
        throw new Error('user_bets foreign keys require a reviewed identifier migration.');
      }
    }
    for (const table of Object.keys(tables) as Table[]) {
      const columns = tables[table];
      const actual = database.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[];
      if (JSON.stringify(actual.map(column => column.name)) !== JSON.stringify(columns)) throw new Error(`Unsupported ${table} snapshot schema.`);
      const records = database.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} ORDER BY id`).all() as Record<string, unknown>[];
      data[table] = records.map(record => {
        const row = columns.map(column => {
          const value = record[column];
          if (value !== null && typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) throw new Error(`Unsupported ${table} SQLite value.`);
          return value as Value;
        });
        if (table === 'user_bets') {
          if (typeof row[0] !== 'number' || !Number.isSafeInteger(row[0]) || row[0] <= 0) throw new Error('Source user_bets IDs must be positive safe integers.');
          row[0] = -row[0];
        } else if (typeof row[0] !== 'string' || row[0].length === 0) throw new Error('Source audit/log IDs must be nonempty strings.');
        if (Buffer.byteLength(JSON.stringify(row)) > 64000) throw new Error('Retained row exceeds the reviewed migration size limit.');
        return row;
      });
    }
  } finally { database.close(); }
  if (hash(await readFile(snapshot)) !== sourceHash) throw new Error('Snapshot changed during export.');
  await rejectSymlinks(output);
  await mkdir(output, { mode: 0o700 });
  const manifest: Manifest = { version: 1, source: { name: path.basename(snapshot), sha256: sourceHash }, tables: {} as Record<Table, TableManifest>, imports: [], verification: [] };
  for (const table of Object.keys(tables) as Table[]) {
    const rows = data[table];
    manifest.tables[table] = { columns: tables[table], count: rows.length, rows: rows.map(row => ({ id: row[0]!, sha256: rowHash(row) })), idMapping: table === 'user_bets' ? 'target_id = -source_id' : 'unchanged' };
    let batchNumber = 0;
    for (let offset = 0; offset < rows.length;) {
      const batch: Value[][] = [];
      let bytes = 2;
      while (offset < rows.length && batch.length < batchSize) {
        const row = rows[offset]!;
        const rowBytes = Buffer.byteLength(JSON.stringify(row)) + 1;
        if (batch.length > 0 && bytes + rowBytes > 1024 * 1024) break;
        batch.push(row); bytes += rowBytes; offset++;
      }
      const name = `${table}-${String(++batchNumber).padStart(6, '0')}`;
      manifest.imports.push(await privateWrite(output, `import-${name}.json`, JSON.stringify([retainedInsert(table, batch)])));
      const ids = batch.map(row => row[0]!);
      const queries: PrivateQuery[] = [{ sql: `SELECT ${tables[table].map(quote).join(',')} FROM ${quote(table)} WHERE id IN (SELECT value FROM json_each(?))`, params: [JSON.stringify(ids)] }];
      manifest.verification.push({ ...await privateWrite(output, `verify-${name}.json`, JSON.stringify(queries)), table, ids, response: `response-${name}.json` });
    }
  }
  const written = await privateWrite(output, 'manifest.json', JSON.stringify(manifest, null, 2));
  return { manifestSha256: written.sha256, counts: Object.fromEntries((Object.keys(tables) as Table[]).map(table => [table, data[table].length])) as Record<Table, number> };
}

async function readManifest(bundle: string, expectedSha256: string, onlyFile?: string): Promise<Manifest> {
  await rejectSymlinks(bundle);
  const filename = path.join(bundle, 'manifest.json');
  await rejectSymlinks(filename);
  const content = await readFile(filename, 'utf8');
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || hash(content) !== expectedSha256) throw new Error('Trusted manifest checksum mismatch.');
  const manifest = JSON.parse(content) as Manifest;
  if (manifest.version !== 1 || !manifest.tables || !Array.isArray(manifest.imports) || !Array.isArray(manifest.verification)) throw new Error('Invalid retained-data manifest.');
  for (const artifact of [...manifest.imports, ...manifest.verification]) {
    if (path.basename(artifact.file) !== artifact.file || !artifact.file.endsWith('.json')) throw new Error('Invalid bundle artifact path.');
    if (onlyFile && artifact.file !== onlyFile) continue;
    await rejectSymlinks(path.join(bundle, artifact.file));
    if (hash(await readFile(path.join(bundle, artifact.file))) !== artifact.sha256) throw new Error('Bundle artifact checksum mismatch.');
  }
  return manifest;
}

export async function verifyRetainedData(bundle: string, responses: string, expectedManifestSha256: string): Promise<Record<Table, number>> {
  const manifest = await readManifest(bundle, expectedManifestSha256);
  const seen = Object.fromEntries((Object.keys(tables) as Table[]).map(table => [table, new Set<string>()])) as Record<Table, Set<string>>;
  const expected = Object.fromEntries((Object.keys(tables) as Table[]).map(table => [table,
    new Map(manifest.tables[table].rows.map(row => [key(row.id), row.sha256])),
  ])) as Record<Table, Map<string, string>>;
  for (const item of manifest.verification) {
    if (!(item.table in tables) || path.basename(item.response) !== item.response) throw new Error('Invalid verification target.');
    const filename = path.join(responses, item.response);
    await rejectSymlinks(filename);
    const raw = JSON.parse(await readFile(filename, 'utf8')) as { success?: boolean; result?: unknown; results?: unknown; error?: unknown };
    if (raw.success === false) throw new Error('Cloudflare query returned an API failure.');
    const result = (raw.result ?? raw) as { error?: unknown; results?: { columns: string[]; rows: Value[][] }[] };
    if (result.error !== undefined || !Array.isArray(result.results) || result.results.length !== 1) throw new Error('Cloudflare query failed or returned partial results.');
    const query = result.results[0]!;
    if (JSON.stringify(query.columns) !== JSON.stringify(tables[item.table]) || !Array.isArray(query.rows) || query.rows.length !== item.ids.length) throw new Error('Verification columns/count mismatch.');
    const batchIds = new Set(item.ids.map(key));
    for (const row of query.rows) {
      const id = key(row[0]!);
      if (seen[item.table].has(id) || !batchIds.has(id) || rowHash(row) !== expected[item.table].get(id)) throw new Error('Imported record content or identity mismatch.');
      seen[item.table].add(id);
    }
  }
  const counts = {} as Record<Table, number>;
  for (const table of Object.keys(tables) as Table[]) {
    if (seen[table].size !== manifest.tables[table].count) throw new Error('Not all source records were verified.');
    counts[table] = seen[table].size;
  }
  return counts;
}

export async function checkImportResults(bundle: string, responses: string, expectedManifestSha256: string, onlyFile?: string): Promise<number> {
  const manifest = await readManifest(bundle, expectedManifestSha256, onlyFile);
  if (onlyFile && !manifest.imports.some(item => item.file === onlyFile)) throw new Error('Unknown import artifact.');
  let executed = 0;
  for (const item of manifest.imports) {
    if (onlyFile && item.file !== onlyFile) continue;
    const filename = path.join(responses, `response-${item.file}`);
    await rejectSymlinks(filename);
    const raw = JSON.parse(await readFile(filename, 'utf8')) as { success?: boolean; result?: unknown };
    const result = (raw.result ?? raw) as { error?: unknown; results?: unknown[] };
    const queries = JSON.parse(await readFile(path.join(bundle, item.file), 'utf8')) as unknown[];
    if (raw.success === false || result.error !== undefined || !Array.isArray(result.results) || result.results.length !== queries.length) {
      throw new Error('Import API failure or incomplete execution; stop and resolve before replay.');
    }
    executed += result.results.length;
  }
  return executed;
}

if (import.meta.main) {
  const [command, first, second, expectedHash, onlyFile] = process.argv.slice(2);
  if (!first || !second || !['prepare', 'verify', 'check-import'].includes(command ?? '') || (command !== 'prepare' && !expectedHash)) throw new Error('Usage: bun run scripts/cloudflare-retained-data.ts prepare <file.snapshot.sqlite> <new-private-directory> | verify/check-import <bundle-directory> <response-directory> <trusted-manifest-sha256>');
  const result = command === 'prepare' ? await prepareRetainedData(first, second) : command === 'verify' ? { verified: await verifyRetainedData(first, second, expectedHash!) } : { executed: await checkImportResults(first, second, expectedHash!, onlyFile) };
  console.log(JSON.stringify(result));
}
