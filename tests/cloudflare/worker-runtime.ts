import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../../cloudflare.config';

const originVariables = ['CLOUDFLARE_STAGING_ALLOWED_ORIGINS', 'CLOUDFLARE_PRODUCTION_ALLOWED_ORIGINS'] as const;
const originalOrigins = originVariables.map(name => process.env[name]);
const retentionVariables = ['CLOUDFLARE_STAGING_AUDIT_RETENTION_DAYS', 'CLOUDFLARE_STAGING_LOG_RETENTION_DAYS', 'CLOUDFLARE_PRODUCTION_AUDIT_RETENTION_DAYS', 'CLOUDFLARE_PRODUCTION_LOG_RETENTION_DAYS'] as const;
const originalRetention = retentionVariables.map(name => process.env[name]);
const originalCustomDomains = process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS;
try {
  delete process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS;
  for (const name of originVariables) delete process.env[name];
  for (const name of retentionVariables) delete process.env[name];
  const staging = config({ mode: 'staging', isPreview: false }).worker;
  const production = config({ mode: 'production', isPreview: false }).worker;
  assert(!staging.domains?.length && !production.domains?.length, 'ordinary deployments cannot cut over DNS');
  process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS = '1';
  assert(JSON.stringify(config({ mode: 'staging', isPreview: false }).worker.domains) === JSON.stringify(['staging.megasena-analyzer.com.br']), 'explicit staging cutover binds only staging');
  assert(JSON.stringify(config({ mode: 'production', isPreview: false }).worker.domains) === JSON.stringify([
    'megasena-analyzer.com.br', 'www.megasena-analyzer.com.br', 'megasena-analyzer.com',
    'www.megasena-analyzer.com', 'megasena-analyzer.online', 'www.megasena-analyzer.online',
  ]), 'explicit production cutover includes canonical and all existing aliases');
  delete process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS;
  assert(staging.env.DEPLOYMENT_STAGE.value === 'staging' && staging.env.ENVIRONMENT.value === 'production', 'staging policy is separate from security environment');
  assert(staging.env.ALLOWED_ORIGINS?.value === '', 'staging starts with no cross-origin grants');
  assert(production.env.DEPLOYMENT_STAGE.value === 'production' && production.env.ALLOWED_ORIGINS === undefined, 'production delegates the canonical-origin default to the API');
  assert(staging.env.IP_HASH_SECRET.type === 'secret' && production.env.IP_HASH_SECRET.type === 'secret', 'required secret remains declared');
  for (const target of [staging, production]) {
    const daily = target.env['DAILY_REFRESH_ENABLED' as keyof typeof target.env];
    assert(daily && 'value' in daily && daily.value === '1', 'every deployed target enables the durable daily scheduler');
    assert(!target.triggers?.some(trigger => trigger.type === 'scheduled'), 'daily alarm is the sole recurring scheduler');
  }
  assert(staging.env.AUDIT_RETENTION_DAYS?.value === '400' && production.env.LOG_RETENTION_DAYS?.value === '30', 'default retention bindings preserve existing policy');
  process.env[retentionVariables[0]] = '365';
  process.env[retentionVariables[1]] = '14';
  process.env[retentionVariables[2]] = '730';
  process.env[retentionVariables[3]] = '90';
  for (const [mode, auditDays, logDays] of [['staging', '365', '14'], ['production', '730', '90']] as const) {
    const configured = config({ mode, isPreview: false }).worker;
    assert(configured.env.AUDIT_RETENTION_DAYS?.value === auditDays && configured.env.LOG_RETENTION_DAYS?.value === logDays, `${mode} preserves its own retention settings`);
  }
  for (const mode of ['staging', 'production']) {
    process.env[mode === 'production' ? originVariables[1] : originVariables[0]] = 'https://example.com';
    assert(config({ mode, isPreview: false }).worker.env.ALLOWED_ORIGINS?.value === 'https://example.com', `${mode} honors explicit operator origins`);
  }
} finally {
  if (originalCustomDomains === undefined) delete process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS;
  else process.env.CLOUDFLARE_BIND_CUSTOM_DOMAINS = originalCustomDomains;
  retentionVariables.forEach((name, index) => {
    const previous = originalRetention[index];
    if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
  });
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
    const fixtureWorkers = [{
      name: 'worker-boundary-test', modules: true, script: bundle.outputFiles[0]!.text,
      compatibilityDate: '2026-10-02', compatibilityFlags: ['nodejs_compat'],
      durableObjects: { DATA: { className: 'MegaSenaData', useSQLite: true } },
      bindings: { ENVIRONMENT: 'production', ...(stage ? { DEPLOYMENT_STAGE: stage } : {}) },
    }];
    const runtime = new Miniflare(convertV4MiniflareOptions({ https: true, workers: fixtureWorkers }));
    const aliasRuntime = new Miniflare(convertV4MiniflareOptions({ workers: fixtureWorkers }));
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
      const appWorker = await aliasRuntime.getWorker();
      for (const hostname of ['www.megasena-analyzer.com.br', 'megasena-analyzer.com', 'www.megasena-analyzer.com', 'megasena-analyzer.online', 'www.megasena-analyzer.online']) {
        const response = await appWorker.fetch(`https://${hostname}/resultados?utm_source=chatgpt.com`, { redirect: 'manual' });
        evidence.push({ stage: stage ?? 'missing', hostname, status: response.status, location: response.headers.get('Location') });
        assert(response.status === (stage === 'production' ? 301 : 200), `${stage} alias redirect is production-only`);
        assert(response.headers.get('Location') === (stage === 'production' ? 'https://megasena-analyzer.com.br/resultados?utm_source=chatgpt.com' : null), 'alias redirect preserves path/query and uses fixed canonical origin');
        assert(response.headers.get('Strict-Transport-Security') !== null, 'alias response retains HTTPS HSTS');
      }
      const spoofed = await appWorker.fetch('https://unrelated.example/resultados', { headers: { 'X-Forwarded-Host': 'megasena-analyzer.com' } });
      evidence.push({ stage: stage ?? 'missing', control: 'forwarded-host', status: spoofed.status, location: spoofed.headers.get('Location') });
      assert(spoofed.status === 200 && !spoofed.headers.has('Location'), 'forwarded host headers cannot activate alias redirects');
      if (stage === 'production') {
        const deceptivePath = await appWorker.fetch('https://megasena-analyzer.com//unrelated.example/path?q=1', { redirect: 'manual' });
        evidence.push({ stage, control: 'double-slash-path', status: deceptivePath.status, location: deceptivePath.headers.get('Location') });
        assert(deceptivePath.headers.get('Location') === 'https://megasena-analyzer.com.br//unrelated.example/path?q=1', 'double-slash paths cannot become redirect authorities');
      }
    } finally { await runtime.dispose(); await aliasRuntime.dispose(); }
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
