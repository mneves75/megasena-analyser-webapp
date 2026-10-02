import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import publicSeed from '../../db/seed/draws.json';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'megasena-persistence-test-')));
const compiled = await build({
  entryPoints: ['tests/cloudflare/database-persistence-entry.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers', 'node:*'],
  alias: { '@/lib/db': path.resolve('lib/cloudflare/database.ts') },
  plugins: [{ name: 'database-runtime', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)db(?:\.ts)?$/ }, args => {
      const resolved = args.path.startsWith('@/') ? path.resolve(args.path.slice(2)) : path.resolve(args.resolveDir, args.path);
      return resolved.replace(/\.ts$/, '') === path.resolve('lib/db') ? { path: path.resolve('lib/cloudflare/database.ts') } : undefined;
    });
    builder.onResolve({ filter: /\.sql\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'sql' }));
    builder.onLoad({ filter: /.*/, namespace: 'sql' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
const options = { ...convertV4MiniflareOptions({ workers: [{ name: 'persistence-test', modules: true, script: compiled.outputFiles[0]!.text,
  compatibilityDate: '2026-10-02', compatibilityFlags: ['nodejs_compat'], bindings: { ENVIRONMENT: 'development', BOOTSTRAP_PUBLIC_SEED: '1' },
  durableObjects: { DATA: { className: 'MegaSenaData', useSQLite: true } } }] }), resourcePersistencePath: path.join(directory, 'storage') };
let firstStatus: { draws: number; auditRows: number; logRows: number };
const first = new Miniflare(options);
try {
  const initial = await first.dispatchFetch('https://example.com/initialize');
  assert(initial.ok, 'initialize persistent fixture');
  const health = await first.dispatchFetch('https://example.com/api/health');
  assert(health.status === 200 && health.headers.get('x-ratelimit-remaining') === '99', 'first durable rate-limit request');
  firstStatus = await (await first.dispatchFetch('https://example.com/status')).json() as typeof firstStatus;
  assert(firstStatus.draws === publicSeed.length + 1 && firstStatus.auditRows === 1 && firstStatus.logRows >= 2, 'initial draws/audit/log persisted');
} finally { await first.dispose(); }
// A new runtime process opens the same exclusive persisted storage.
const second = new Miniflare(options);
try {
  const restored = await (await second.dispatchFetch('https://example.com/status')).json() as typeof firstStatus;
  assert(restored.draws === firstStatus!.draws && restored.auditRows === firstStatus!.auditRows && restored.logRows === firstStatus!.logRows, 'data survives runtime restart');
  const health = await second.dispatchFetch('https://example.com/api/health');
  assert(health.status === 200 && health.headers.get('x-ratelimit-remaining') === '98', 'rate-limit counter survives restart');
  const final = await (await second.dispatchFetch('https://example.com/status')).json() as typeof firstStatus;
  assert(final.auditRows === 2 && final.draws === publicSeed.length + 1, 'restarted audit and draws');
  const evidence = { pass: true, runtimeRestart: true, draws: final.draws, auditRows: final.auditRows, logRows: final.logRows, retainedRateLimitRemaining: 98 };
  await mkdir('.scratch/cloudflare-database', { recursive: true });
  await writeFile('.scratch/cloudflare-database/persistence-runtime-result.json', JSON.stringify(evidence));
  console.log(JSON.stringify(evidence));
} finally { await second.dispose(); }
