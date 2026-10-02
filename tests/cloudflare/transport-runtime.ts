import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const bundle = await build({ entryPoints: ['tests/cloudflare/transport-entry.ts'], bundle: true,
  write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers', 'node:*'] });
const runtime = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-10-02',
  compatibilityFlags: ['nodejs_compat'], durableObjects: { DATA: { className: 'TransportData', useSQLite: true } },
}));
try {
  const response = await runtime.dispatchFetch('https://example.com/');
  console.log(await response.text());
  if (!response.ok) throw new Error(`RPC transport verification failed: ${response.status}`);
} finally { await runtime.dispose(); }
