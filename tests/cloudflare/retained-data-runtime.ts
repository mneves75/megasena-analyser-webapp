import { Database } from 'bun:sqlite';
import { mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareRetainedData, verifyRetainedData, checkImportResults } from '../../scripts/cloudflare-retained-data';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'megasena-retained-test-')));
const snapshot = path.join(directory, 'source.snapshot.sqlite');
const source = new Database(snapshot);
for (const name of (await readdir('db/migrations')).filter(name => name.endsWith('.sql')).sort()) source.exec(await readFile(path.join('db/migrations', name), 'utf8'));
source.exec("INSERT INTO audit_logs(id,timestamp,event,metadata_json) VALUES('audit-1','2026-10-02T00:00:00Z','api.test','{\"quote\":\"x''y\"}'); INSERT INTO log_events(id,timestamp,level,event,error_json) VALUES('log-1','2026-10-02T00:00:00Z','info','test',NULL); INSERT INTO user_bets(id,bet_numbers,notes) VALUES(1,'[1,2,3,4,5,6]','source bet')");
source.close();
const additional = new Database(snapshot);
additional.exec("INSERT INTO audit_logs(id,timestamp,event) VALUES('audit-0','2026-10-02T00:00:00Z','api.test')");
const extraAudit = additional.prepare('INSERT INTO audit_logs(id,timestamp,event) VALUES (?, ?, ?)');
for (let index = 1; index <= 999; index++) extraAudit.run(`bulk-${String(index).padStart(4, '0')}`, '2026-10-02T00:00:00Z', 'test');
additional.close();
const bundle = path.join(directory, 'bundle');
const prepared = await prepareRetainedData(snapshot, bundle, 1000);
const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'));
assert(manifest.tables.user_bets.idMapping === 'target_id = -source_id', 'deterministic ID mapping');
const target = new Database(':memory:');
for (const name of (await readdir('db/migrations')).filter(name => name.endsWith('.sql')).sort()) target.exec(await readFile(path.join('db/migrations', name), 'utf8'));
target.exec("INSERT INTO user_bets(id,bet_numbers,notes) VALUES(1,'[7,8,9,10,11,12]','new target bet')");
const files = manifest.imports as Array<{ file: string }>;
const execute = async (filename: string) => {
  const queries = JSON.parse(await readFile(path.join(bundle, filename), 'utf8')) as Array<{ sql: string; params?: (string | number | null)[] }>;
  for (const query of queries) target.prepare(query.sql).run(...query.params ?? []);
};
// Interrupted after one atomic row; repeat all batches safely.
await execute(files[0]!.file);
for (const file of files) await execute(file.file);
for (const file of files) await execute(file.file);
assert((target.prepare('SELECT COUNT(*) AS count FROM audit_logs').get() as { count: number }).count === 1001, 'repeated audit batch');
assert((target.prepare('SELECT notes FROM user_bets WHERE id=-1').get() as { notes: string }).notes === 'source bet', 'imported bet preserved');
assert((target.prepare('SELECT notes FROM user_bets WHERE id=1').get() as { notes: string }).notes === 'new target bet', 'new bet preserved');
target.exec("UPDATE audit_logs SET event='divergent' WHERE id='audit-1'");
target.exec("DELETE FROM audit_logs WHERE id='audit-0'");
let conflict = false;
try { for (const file of files) await execute(file.file); } catch { conflict = true; }
assert(conflict && (target.prepare("SELECT event FROM audit_logs WHERE id='audit-1'").get() as { event: string }).event === 'divergent', 'conflict abort preserves target');
assert(!target.prepare("SELECT id FROM audit_logs WHERE id='audit-0'").get(), 'batch rollback after earlier insert');
target.exec("UPDATE audit_logs SET event='api.test' WHERE id='audit-1'");
for (const file of files) await execute(file.file);
const responses = path.join(directory, 'responses');
await (await import('node:fs/promises')).mkdir(responses);
for (const item of manifest.imports as Array<{ file: string }>) {
  const queries = JSON.parse(await readFile(path.join(bundle, item.file), 'utf8')) as unknown[];
  await writeFile(path.join(responses, `response-${item.file}`), JSON.stringify({ success: true, result: { results: queries.map(() => ({ columns: [], rows: [], meta: {} })) } }));
  if (item.file === manifest.imports[0].file) await checkImportResults(bundle, responses, prepared.manifestSha256, item.file);
}
await checkImportResults(bundle, responses, prepared.manifestSha256);
await writeFile(path.join(responses, `response-${manifest.imports[0].file}`), JSON.stringify({ success: true, result: { error: 'collision', results: [] } }));
let partialRejected = false;
try { await checkImportResults(bundle, responses, prepared.manifestSha256); } catch { partialRejected = true; }
assert(partialRejected, 'API success envelope with partial query error must fail');
for (const item of manifest.verification as Array<{ file: string; response: string }>) {
  const queries = JSON.parse(await readFile(path.join(bundle, item.file), 'utf8')) as Array<{ sql: string; params: (string | number | null)[] }>;
  const results = queries.map(query => {
    const rows = target.prepare(query.sql).all(...query.params) as Record<string, unknown>[];
    const columns = rows.length ? Object.keys(rows[0]!) : [];
    return { columns, rows: rows.map(row => columns.map(column => row[column])), meta: { rows_read: rows.length, rows_written: 0 } };
  });
  await writeFile(path.join(responses, item.response), JSON.stringify({ success: true, result: { results } }));
}
await verifyRetainedData(bundle, responses, prepared.manifestSha256);
const alteredManifest = { ...manifest, source: { ...manifest.source, name: 'changed.snapshot.sqlite' } };
await writeFile(path.join(bundle, 'manifest.json'), JSON.stringify(alteredManifest));
let changedManifestRejected = false;
try { await verifyRetainedData(bundle, responses, prepared.manifestSha256); } catch { changedManifestRejected = true; }
assert(changedManifestRejected, 'trusted manifest hash detects altered manifest');
await writeFile(path.join(bundle, 'manifest.json'), JSON.stringify(manifest, null, 2));
const responseFile = path.join(responses, manifest.verification[0].response);
const changed = JSON.parse(await readFile(responseFile, 'utf8'));
changed.result.results[0].rows[0][2] = 'tampered';
await writeFile(responseFile, JSON.stringify(changed));
let rejected = false;
try { await verifyRetainedData(bundle, responses, prepared.manifestSha256); } catch { rejected = true; }
assert(rejected, 'full content hash detects changed payload');
target.close();
const imports = await Promise.all(manifest.imports.map(async (item: { file: string }) => JSON.parse(await readFile(path.join(bundle, item.file), 'utf8'))));
const verification = await Promise.all(manifest.verification.map(async (item: { file: string; response: string }) => ({ response: item.response, queries: JSON.parse(await readFile(path.join(bundle, item.file), 'utf8')) })));
const migrations = await Promise.all((await readdir('db/migrations')).filter(name => name.endsWith('.sql')).sort().map(name => readFile(path.join('db/migrations', name), 'utf8')));
const compiled = await build({ entryPoints: ['tests/cloudflare/retained-data-worker-entry.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] });
const runtime = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'retained-test', modules: true, script: compiled.outputFiles[0]!.text,
  compatibilityDate: '2026-10-02', durableObjects: { DATA: { className: 'RetainedDataTest', useSQLite: true } }, bindings: { FIXTURE: { imports, verification, migrations } } }] }));
try {
  const response = await runtime.dispatchFetch('https://example.com/verify');
  const result = await response.json() as { pass: boolean; error?: string; responses: { response: string; result: unknown }[] };
  assert(response.ok && result.pass, `workerd: ${result.error}`);
  for (const item of result.responses) await writeFile(path.join(responses, item.response), JSON.stringify({ success: true, result: item.result }));
  await verifyRetainedData(bundle, responses, prepared.manifestSha256);
} finally { await runtime.dispose(); }
const evidence = { pass: true, sourceRows: 1003, thousandRowBatches: true, idempotent: true, interruptedResume: true, conflictingId: true, atomicBatchRollback: true, positiveBetPreserved: true, fullContentHash: true, trustedManifestHash: true, workerd: true };
await (await import('node:fs/promises')).mkdir('.scratch/cloudflare-database', { recursive: true });
await writeFile('.scratch/cloudflare-database/retained-runtime-result.json', JSON.stringify(evidence));
console.log(JSON.stringify(evidence));
