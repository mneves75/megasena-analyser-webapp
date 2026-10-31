// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';
import config from '../../cloudflare/staging-off/cloudflare.config';
import worker, * as workerModule from '../../cloudflare/staging-off/worker';
import siteDomains from '../../lib/site-domains.json';

afterEach(() => vi.unstubAllEnvs());

describe('staging-off Worker', () => {
  it.each([
    ['GET', '/'],
    ['HEAD', '/robots.txt'],
    ['GET', '/api/health'],
    ['POST', '/api/refresh'],
    ['DELETE', '/concurso/1?reset=1'],
  ])('returns only an uncached retirement response for %s %s', async (method, pathname) => {
    const response = worker.fetch(new Request(`https://example.com${pathname}`, { method }));
    expect(response.status).toBe(410);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await response.text()).toBe('Ambiente de staging desativado.\n');
  });

  it('exports no application or background handlers', () => {
    expect(Object.keys(workerModule)).toEqual(['default']);
    expect(Object.keys(worker)).toEqual(['fetch']);
  });

  it('bundles only the off Worker without application or storage imports', async () => {
    const entrypoint = fileURLToPath(new URL('../../cloudflare/staging-off/worker.ts', import.meta.url));
    const bundle = await build({ entryPoints: [entrypoint], bundle: true, write: false, metafile: true, format: 'esm', platform: 'neutral' });
    expect(Object.keys(bundle.metafile.inputs)).toEqual(['cloudflare/staging-off/worker.ts']);
    expect(Object.values(bundle.metafile.outputs)).toEqual([
      expect.objectContaining({ exports: ['default'], imports: [] }),
    ]);
  });
});

describe('staging-off deployment boundary', () => {
  it.each(['production', 'staging', 'development', '', 'STAGING-OFF'])('rejects mode %j even with an explicit account', mode => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0'.repeat(32));
    expect(() => config({ mode, isPreview: false })).toThrow('staging-off');
  });

  it.each([undefined, '', '   '])('rejects missing or blank explicit account %j', account => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', account);
    expect(() => config({ mode: 'staging-off', isPreview: false })).toThrow('CLOUDFLARE_ACCOUNT_ID');
  });

  it('targets only the existing staging Worker and deletes its database export', () => {
    const accountId = '0'.repeat(32);
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', accountId);
    const resolved = config({ mode: 'staging-off', isPreview: false });
    expect(resolved).toEqual({
      accountId,
      worker: {
        name: 'megasena-analyser-staging',
        domains: [`staging.${siteDomains.primaryDomain}`],
        entrypoint: './worker.ts',
        compatibilityDate: '2026-10-02',
        env: { IP_HASH_SECRET: { type: 'secret' } },
        exports: { MegaSenaData: { type: 'durable-object', state: 'deleted' } },
        triggers: [],
        observability: { enabled: true },
      },
    });
  });

  it('anchors Vite to the isolated unit with public asset copying disabled', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '0'.repeat(32));
    const root = fileURLToPath(new URL('../../cloudflare/staging-off/', import.meta.url));
    const loaded = await loadConfigFromFile({ command: 'build', mode: 'staging-off' }, `${root}vite.config.ts`);
    expect(loaded?.config.root).toBe(root);
    expect(loaded?.config.publicDir).toBe(false);
    expect(loaded?.dependencies).not.toContain(fileURLToPath(new URL('../../vite.config.ts', import.meta.url)));
  });
});
