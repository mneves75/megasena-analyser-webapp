import { describe, expect, it, vi } from 'vitest';
import { isDeterministicRoute, withDrawsEdgeCache, type EdgeCache } from '@/lib/cloudflare/edge-cache';

class MemoryCache implements EdgeCache {
  readonly entries = new Map<string, Response>();
  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone();
  }
  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response);
  }
}

function setup(version: string | null = '3065') {
  const cache = new MemoryCache();
  const pending: Promise<unknown>[] = [];
  const state = { version };
  const deps = {
    cache,
    buildVersion: '1.17.1',
    drawsVersion: vi.fn(async () => state.version),
    waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
  };
  const flush = () => Promise.all(pending.splice(0));
  return { cache, deps, state, flush };
}

const image = (body = 'png-1', cacheControl = 'public, max-age=0, must-revalidate') =>
  vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': cacheControl } }));

describe('Worker edge cache for deterministic draw-derived routes', () => {
  it('matches only public, draw-derived, request-independent routes', () => {
    for (const path of ['/concurso/3000/opengraph-image', '/concurso/1/twitter-image', '/opengraph-image', '/twitter-image', '/sitemap.xml', '/llms.txt']) {
      expect(isDeterministicRoute(new URL(`https://example.com${path}`)), path).toBe(true);
    }
    for (const path of ['/', '/concurso/3000', '/dashboard/statistics', '/api/draws', '/concurso/01/opengraph-image', '/concurso/x/opengraph-image', '/sitemap.xml/extra']) {
      expect(isDeterministicRoute(new URL(`https://example.com${path}`)), path).toBe(false);
    }
  });

  it('renders once on a miss and serves later requests from the cache', async () => {
    const { deps, flush } = setup();
    const render = image();
    const request = () => new Request('https://example.com/concurso/3000/opengraph-image');

    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(request(), render, deps);

    expect(render).toHaveBeenCalledTimes(1);
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(await miss.text()).toBe('png-1');
    expect(await hit.text()).toBe('png-1');
    // Clients keep the application's own policy; only the stored copy gets an edge TTL.
    expect(hit.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
    expect(hit.headers.get('Content-Type')).toBe('image/png');
  });

  it('stores the copy with a bounded edge TTL', async () => {
    const { cache, deps, flush } = setup();
    await withDrawsEdgeCache(new Request('https://example.com/sitemap.xml'), image('xml', 'public, max-age=600'), deps);
    await flush();
    const [stored] = [...cache.entries.values()];
    expect(stored?.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('invalidates by itself when a new contest changes the draws revision', async () => {
    const { deps, state, flush } = setup('3065');
    let body = 'contest-3065';
    const render = vi.fn(async () => new Response(body, { headers: { 'Cache-Control': 'public, max-age=600' } }));
    const request = () => new Request('https://example.com/sitemap.xml');

    await withDrawsEdgeCache(request(), render, deps);
    await flush();
    state.version = '3066';
    body = 'contest-3066';
    const fresh = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const cached = await withDrawsEdgeCache(request(), render, deps);

    expect(render).toHaveBeenCalledTimes(2);
    expect(fresh.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(await fresh.text()).toBe('contest-3066');
    expect(await cached.text()).toBe('contest-3066');
  });

  it('separates releases so a deploy never serves output from the previous renderer', async () => {
    const { deps, flush } = setup();
    const request = () => new Request('https://example.com/llms.txt');
    await withDrawsEdgeCache(request(), image('old', 'public, max-age=600'), deps);
    await flush();
    const renderNew = image('new', 'public, max-age=600');
    const afterDeploy = await withDrawsEdgeCache(request(), renderNew, { ...deps, buildVersion: '1.17.2' });
    expect(renderNew).toHaveBeenCalledTimes(1);
    expect(await afterDeploy.text()).toBe('new');
  });

  it('never replays a CSP nonce: each response carries a fresh one', async () => {
    const { deps, flush } = setup();
    const csp = "script-src 'self' 'nonce-Zmlyc3Q=' 'strict-dynamic'; style-src 'self' 'nonce-Zmlyc3Q='";
    const render = vi.fn(async () => new Response('png', {
      headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Content-Security-Policy': csp },
    }));
    const request = () => new Request('https://example.com/concurso/3000/opengraph-image');
    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const first = await withDrawsEdgeCache(request(), render, deps);
    const second = await withDrawsEdgeCache(request(), render, deps);

    expect(miss.headers.get('Content-Security-Policy')).toBe(csp);
    const nonces = [first, second].map(response => {
      const policy = response.headers.get('Content-Security-Policy') ?? '';
      const found = [...policy.matchAll(/'nonce-([^']+)'/g)].map(match => match[1]);
      expect(found).toHaveLength(2);
      expect(new Set(found).size).toBe(1);
      expect(policy.replaceAll(found[0]!, 'N')).toBe(csp.replaceAll('Zmlyc3Q=', 'N'));
      return found[0];
    });
    expect(nonces[0]).not.toBe('Zmlyc3Q=');
    expect(nonces[1]).not.toBe(nonces[0]);
  });

  it('does not store a body that embeds its CSP nonce', async () => {
    const { cache, deps, flush } = setup();
    const response = new Response('<script nonce="Zmlyc3Q="></script>', {
      headers: { 'Cache-Control': 'public, max-age=600', 'Content-Security-Policy': "script-src 'nonce-Zmlyc3Q='" },
    });
    const result = await withDrawsEdgeCache(new Request('https://example.com/llms.txt'), async () => response, deps);
    await flush();
    expect(await result.text()).toContain('Zmlyc3Q=');
    expect(cache.entries.size).toBe(0);
  });

  it('ignores query strings so cache-busting parameters cannot multiply entries', async () => {
    const { cache, deps, flush } = setup();
    const render = image();
    await withDrawsEdgeCache(new Request('https://example.com/opengraph-image?a=1'), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(new Request('https://example.com/opengraph-image?b=2'), render, deps);
    expect(render).toHaveBeenCalledTimes(1);
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(cache.entries.size).toBe(1);
  });

  it('never stores private, no-store, cookie-bearing or unsuccessful responses', async () => {
    const responses = [
      new Response('x', { headers: { 'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate' } }),
      new Response('x', { headers: { 'Cache-Control': 'no-store' } }),
      new Response('x'),
      new Response('x', { headers: { 'Cache-Control': 'public, max-age=600', 'Set-Cookie': 'a=b' } }),
      new Response('x', { status: 404, headers: { 'Cache-Control': 'public, max-age=600' } }),
      new Response('x', { status: 500, headers: { 'Cache-Control': 'public, max-age=600' } }),
    ];
    for (const response of responses) {
      const { cache, deps, flush } = setup();
      const result = await withDrawsEdgeCache(new Request('https://example.com/sitemap.xml'), async () => response, deps);
      await flush();
      expect(result.status).toBe(response.status);
      expect(result.headers.has('X-Megasena-Cache')).toBe(false);
      expect(cache.entries.size).toBe(0);
    }
  });

  it('bypasses non-GET methods, other routes and an unknown draws revision', async () => {
    for (const [request, version] of [
      [new Request('https://example.com/sitemap.xml', { method: 'HEAD' }), '3065'],
      [new Request('https://example.com/concurso/3000'), '3065'],
      [new Request('https://example.com/sitemap.xml'), null],
    ] as const) {
      const { cache, deps, flush } = setup(version);
      const render = image();
      await withDrawsEdgeCache(request, render, deps);
      await withDrawsEdgeCache(request.clone(), render, deps);
      await flush();
      expect(render).toHaveBeenCalledTimes(2);
      expect(cache.entries.size).toBe(0);
    }
  });

  it('does not consult the data revision for routes that are never cached', async () => {
    const { deps } = setup();
    await withDrawsEdgeCache(new Request('https://example.com/dashboard'), image(), deps);
    expect(deps.drawsVersion).not.toHaveBeenCalled();
  });

  it('falls back to rendering when the cache or revision lookup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { deps } = setup();
      const render = image();
      deps.cache.match = async () => { throw new Error('cache unavailable'); };
      const viaCacheFailure = await withDrawsEdgeCache(new Request('https://example.com/sitemap.xml'), render, deps);
      deps.drawsVersion.mockRejectedValueOnce(new Error('rpc failed'));
      const viaVersionFailure = await withDrawsEdgeCache(new Request('https://example.com/sitemap.xml'), render, deps);
      expect(viaCacheFailure.status).toBe(200);
      expect(viaVersionFailure.status).toBe(200);
      expect(render).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});
