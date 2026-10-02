import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Database } from 'bun:sqlite';
import { withDatabaseTransaction } from '../../lib/db-transaction';

const localDatabase = new Database(':memory:');
try {
  localDatabase.exec('CREATE TABLE test_transactions (id INTEGER PRIMARY KEY)');
  withDatabaseTransaction(localDatabase, () => localDatabase.prepare('INSERT INTO test_transactions VALUES (1)').run());
  if ((localDatabase.prepare('SELECT COUNT(*) AS count FROM test_transactions').get() as { count: number }).count !== 1) throw new Error('Native Bun transaction callback did not execute.');
  try {
    withDatabaseTransaction(localDatabase, () => {
      withDatabaseTransaction(localDatabase, () => localDatabase.prepare('INSERT INTO test_transactions VALUES (2)').run());
      throw new Error('outer failure');
    });
  } catch { /* Expected outer failure. */ }
  if ((localDatabase.prepare('SELECT COUNT(*) AS count FROM test_transactions').get() as { count: number }).count !== 1) throw new Error('Native Bun nested transaction rollback failed.');
} finally { localDatabase.close(); }

const directory = path.resolve('.scratch/cloudflare-database');
await mkdir(directory, { recursive: true });
const bundle = await build({
  entryPoints: ['tests/cloudflare/database-runtime-entry.ts'],
  bundle: true, write: false, format: 'esm', platform: 'neutral',
  external: ['cloudflare:workers', 'node:*'],
  alias: { '@/lib/db': path.resolve('lib/cloudflare/database.ts') },
  plugins: [{
    name: 'sql-migrations',
    setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)db(?:\.ts)?$/ }, args => {
        const resolved = args.path.startsWith('@/') ? path.resolve(args.path.slice(2)) : path.resolve(args.resolveDir, args.path);
        if (resolved.replace(/\.ts$/, '') === path.resolve('lib/db')) return { path: path.resolve('lib/cloudflare/database.ts') };
        return undefined;
      });
      builder.onResolve({ filter: /\.sql\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.replace('?raw', '')), namespace: 'sql' }));
      builder.onLoad({ filter: /.*/, namespace: 'sql' }, async args => ({ contents: await (await import('node:fs/promises')).readFile(args.path, 'utf8'), loader: 'text' }));
    },
  }],
});
const runtime = new Miniflare(convertV4MiniflareOptions({
  workers: [{
    name: 'database-test', modules: true, script: bundle.outputFiles[0]!.text,
    compatibilityDate: '2026-10-02', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { DATA: { className: 'TestData', useSQLite: true }, SEEDED: { className: 'MegaSenaData', useSQLite: true }, RETRY: { className: 'TestRetryData', useSQLite: true }, RETENTION: { className: 'TestConfiguredRetention', useSQLite: true }, DISABLED_RETENTION: { className: 'TestDisabledRetention', useSQLite: true } },
    bindings: { ENVIRONMENT: 'development', BOOTSTRAP_PUBLIC_SEED: '1' },
    outboundService: async () => new Response('CAIXA failure control', { status: 400 }),
  }],
}));
try {
  const response = await runtime.dispatchFetch('https://example.com/verify');
  const evidence = await response.text();
  await (await import('node:fs/promises')).writeFile(path.join(directory, 'runtime-result.json'), evidence);
  console.log(evidence);
  if (!response.ok) throw new Error(`workerd database verification failed: HTTP ${response.status}`);
} finally {
  await runtime.dispose();
}
