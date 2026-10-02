import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../../cloudflare.config';

const originVariables = ['CLOUDFLARE_STAGING_ALLOWED_ORIGINS', 'CLOUDFLARE_PRODUCTION_ALLOWED_ORIGINS'] as const;
const originalOrigins = originVariables.map(name => process.env[name]);
try {
  for (const name of originVariables) delete process.env[name];
  const staging = config({ mode: 'staging', isPreview: false }).worker;
  const production = config({ mode: 'production', isPreview: false }).worker;
  assert(staging.env.DEPLOYMENT_STAGE.value === 'staging' && staging.env.ENVIRONMENT.value === 'production', 'staging policy is separate from security environment');
  assert(staging.env.ALLOWED_ORIGINS?.value === '', 'staging starts with no cross-origin grants');
  assert(production.env.DEPLOYMENT_STAGE.value === 'production' && production.env.ALLOWED_ORIGINS === undefined, 'production delegates the canonical-origin default to the API');
  assert(staging.env.IP_HASH_SECRET.type === 'secret' && production.env.IP_HASH_SECRET.type === 'secret', 'required secret remains declared');
  for (const mode of ['staging', 'production']) {
    process.env[mode === 'production' ? originVariables[1] : originVariables[0]] = 'https://example.com';
    assert(config({ mode, isPreview: false }).worker.env.ALLOWED_ORIGINS?.value === 'https://example.com', `${mode} honors explicit operator origins`);
  }
} finally {
  originVariables.forEach((name, index) => {
    const previous = originalOrigins[index];
    if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
  });
}

// Exercise the real Worker routing boundary in workerd. Frontend/database stubs
// isolate crawler policy; their full runtime behavior has separate acceptance gates.
const bundle = await build({
  entryPoints: ['cloudflare/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral',
  external: ['cloudflare:workers', 'node:*'],
  alias: { 'vinext/server/app-router-entry': path.resolve('tests/cloudflare/worker-runtime-app.ts') },
  plugins: [{ name: 'worker-boundary-data-fixture', setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)data-object(?:\.ts)?$/ }, args => {
      if (path.resolve(args.resolveDir, args.path).replace(/\.ts$/, '') === path.resolve('cloudflare/data-object')) {
        return { path: path.resolve('tests/cloudflare/worker-runtime-data.ts') };
      }
      return undefined;
    });
  } }],
});

const directory = path.resolve('.scratch/cloudflare-worker');
await mkdir(directory, { recursive: true });
const evidence: Record<string, unknown>[] = [];
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  for (const stage of ['staging', 'production', undefined, 'unknown']) {
    const runtime = new Miniflare(convertV4MiniflareOptions({ https: true, workers: [{
      name: 'worker-boundary-test', modules: true, script: bundle.outputFiles[0]!.text,
      compatibilityDate: '2026-10-02', compatibilityFlags: ['nodejs_compat'],
      durableObjects: { DATA: { className: 'MegaSenaData', useSQLite: true } },
      bindings: { ENVIRONMENT: 'production', ...(stage ? { DEPLOYMENT_STAGE: stage } : {}) },
    }] }));
    try {
      const fixtureUrl = await runtime.ready;
      assert(fixtureUrl.hostname === '127.0.0.1', 'TLS fixture must remain on loopback');
      for (const route of ['/', '/api/health', '/missing', '/sitemap.xml', '/robots.txt']) {
        // Trust only this process-owned loopback fixture's self-signed TLS certificate.
        const response = await fetch(new URL(route, fixtureUrl), { tls: { rejectUnauthorized: false } });
        const body = await response.text();
        const tag = response.headers.get('X-Robots-Tag');
        const expectedStatus = route === '/missing' ? 404 : 200;
        evidence.push({ stage: stage ?? 'missing', route, status: response.status, robotsTag: tag, ...(route === '/robots.txt' ? { robots: body } : {}) });
        assert(response.status === expectedStatus, `${stage ?? 'missing'} ${route}: preserve status`);
        assert(response.headers.get('Strict-Transport-Security') === 'max-age=31536000; includeSubDomains; preload', `${stage ?? 'missing'} ${route}: HTTPS HSTS at the Worker boundary`);
        assert(stage === 'production' ? tag === null : tag?.includes('noindex'), `${stage ?? 'missing'} ${route}: crawler indexing header`);
        if (route === '/robots.txt') {
          if (stage === 'production') {
            assert(body.includes('Allow: /') && body.includes('Disallow: /api/') && body.includes('Sitemap:'), 'production crawler policy preserved');
          } else {
            assert(body === 'User-agent: *\nDisallow: /\n', `${stage ?? 'missing'} robots blocks every route and advertises no sitemap`);
          }
        } else {
          assert(response.headers.get('Cache-Control') === 'no-store', 'preserve upstream cache policy');
          assert(response.headers.get('Content-Security-Policy') !== null, 'preserve upstream CSP');
        }
      }
    } finally { await runtime.dispose(); }
  }
  const insecureRuntime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-10-02',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: { DATA: { className: 'MegaSenaData', useSQLite: true } },
    bindings: { ENVIRONMENT: 'production', DEPLOYMENT_STAGE: 'production' },
  }));
  try {
    const insecure = await insecureRuntime.dispatchFetch('http://example.com/', { headers: { 'X-Forwarded-Proto': 'https' } });
    assert(insecure.headers.get('Strict-Transport-Security') === null, 'an untrusted forwarded header cannot assert HTTPS');
  } finally { await insecureRuntime.dispose(); }
  await writeFile(path.join(directory, 'runtime-result.json'), JSON.stringify({ pass: true, checks: evidence }, null, 2));
  console.log(JSON.stringify({ pass: true, requests: evidence.length, stages: ['staging', 'production', 'missing', 'unknown'] }));
} catch (error) {
  await writeFile(path.join(directory, 'runtime-result.json'), JSON.stringify({ pass: false, error: String(error), checks: evidence }, null, 2));
  throw error;
}
