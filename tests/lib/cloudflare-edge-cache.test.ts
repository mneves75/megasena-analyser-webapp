import { describe, expect, it, vi } from 'vitest';
import { isDeterministicRoute, withDrawsEdgeCache, type EdgeCache } from '@/lib/cloudflare/edge-cache';
import { APP_INFO } from '@/lib/constants';

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
    buildVersion: APP_INFO.VERSION,
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
    const { cache, deps, flush } = setup();
    const request = () => new Request('https://example.com/llms.txt');
    await withDrawsEdgeCache(request(), image('old', 'public, max-age=600'), deps);
    await flush();
    const renderNew = image('new', 'public, max-age=600');
    const nextBuild = `${deps.buildVersion}-next`;
    const afterDeploy = await withDrawsEdgeCache(request(), renderNew, { ...deps, buildVersion: nextBuild });
    await flush();
    expect(renderNew).toHaveBeenCalledTimes(1);
    expect(await afterDeploy.text()).toBe('new');
    const keys = [...cache.entries.keys()].map(key => new URL(key));
    expect(keys.map(key => key.searchParams.get('build'))).toEqual([APP_INFO.VERSION, nextBuild]);
    expect(keys.map(key => key.searchParams.get('draws'))).toEqual(['3065', '3065']);
  });

  it.each(['Authorization', 'Cookie'])('bypasses cache reads and writes for requests carrying %s', async (header) => {
    const { cache, deps, flush } = setup();
    const match = vi.spyOn(cache, 'match');
    const put = vi.spyOn(cache, 'put');
    const url = 'https://example.com/llms.txt';
    const personalized = image('personalized', 'public, max-age=600');

    // A private request must neither populate an empty cache nor read a warm one.
    for (const warm of [false, true]) {
      if (warm) {
        await withDrawsEdgeCache(new Request(url), image('public', 'public, max-age=600'), deps);
        await flush();
      }
      vi.clearAllMocks();
      // Presence alone is enough to bypass, even if a proxy leaves an empty header.
      for (const value of ['test-value', '']) {
        const response = await withDrawsEdgeCache(new Request(url, { headers: { [header]: value } }), personalized, deps);
        await flush();
        expect(await response.text()).toBe('personalized');
        expect(response.headers.has('X-Megasena-Cache')).toBe(false);
      }
      expect(personalized).toHaveBeenCalledTimes(2);
      expect(deps.drawsVersion).not.toHaveBeenCalled();
      expect(match).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
      expect(cache.entries.size).toBe(warm ? 1 : 0);
    }
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

const STORED_NONCE = 'MDEyMzQ1Njc4OWFiY2RlZg==';
const HTML_BODY = `<!doctype html><html lang="pt-BR"><head><style nonce="${STORED_NONCE}">body{margin:0}</style></head><body><h1>Concurso 3000</h1><script nonce="${STORED_NONCE}">self.__next_f.push([1, '${STORED_NONCE}', {"nonce":"${STORED_NONCE}"}]);</script><p>${STORED_NONCE}</p></body></html>`;
const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': `script-src 'nonce-${STORED_NONCE}' 'strict-dynamic'; style-src 'nonce-${STORED_NONCE}'`,
  'Content-Security-Policy-Report-Only': `script-src 'nonce-${STORED_NONCE}'`,
  'X-Nonce': STORED_NONCE,
  'X-Test-Repeated-Nonce': `${STORED_NONCE} ${STORED_NONCE}`,
};
const html = () => vi.fn(async () => new Response(HTML_BODY, { headers: HTML_HEADERS }));
const nonceOf = (response: Response) => /'nonce-([^']+)'/.exec(response.headers.get('Content-Security-Policy') ?? '')?.[1];

describe('Worker edge cache for archive HTML', () => {
  it('preserves an absent origin Cache-Control header on both MISS and HIT', async () => {
    const { deps, flush } = setup();
    const headers = new Headers(HTML_HEADERS);
    headers.delete('Cache-Control');
    const render = vi.fn(async () => new Response(HTML_BODY, { headers }));
    const request = () => new Request('https://example.com/concurso/3000');
    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(request(), render, deps);
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(miss.headers.has('Cache-Control')).toBe(false);
    expect(hit.headers.has('Cache-Control')).toBe(false);
  });

  it.each(['/concurso/1', '/concurso/999999', '/numeros/1', '/numeros/60', '/resultados/1996', '/resultados/2100'])(
    'caches canonical archive route %s and keeps MISS output unchanged', async (path) => {
      const { cache, deps, flush } = setup();
      const render = html();
      const request = () => new Request(`https://example.com${path}`);
      const miss = await withDrawsEdgeCache(request(), render, deps);
      await flush();
      expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
      for (const [name, value] of Object.entries(HTML_HEADERS)) expect(miss.headers.get(name)).toBe(value);
      expect(await miss.text()).toBe(HTML_BODY);
      const hit = await withDrawsEdgeCache(request(), render, deps);
      expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
      expect(hit.headers.get('Cache-Control')).toBe('no-store');
      expect(hit.headers.has('X-Megasena-Origin-Cache-Control')).toBe(false);
      expect(render).toHaveBeenCalledTimes(1);
      const stored = [...cache.entries.values()][0]!;
      expect(stored.headers.get('Cache-Control')).toBe('public, max-age=86400');
      expect(stored.headers.get('X-Megasena-Origin-Cache-Control')).toBe('no-store');
      expect(await stored.clone().text()).toBe(HTML_BODY);
    }
  );

  it('gives two HTML HITs distinct fresh nonces, different from the stored nonce', async () => {
    const { deps, flush } = setup();
    const render = html();
    const request = () => new Request('https://example.com/concurso/3000');
    await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const first = await withDrawsEdgeCache(request(), render, deps);
    const second = await withDrawsEdgeCache(request(), render, deps);
    expect(first.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(second.headers.get('X-Megasena-Cache')).toBe('HIT');
    const nonces = [nonceOf(first), nonceOf(second)];
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(nonce).not.toBe(STORED_NONCE);
    }
    expect(nonces[0]).not.toBe(nonces[1]);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('replaces every stored nonce in every header and throughout the HTML, including inline RSC text', async () => {
    const { deps, flush } = setup();
    const request = () => new Request('https://example.com/concurso/3000');
    await withDrawsEdgeCache(request(), html(), deps);
    await flush();
    const hit = await withDrawsEdgeCache(request(), html(), deps);
    const nonce = nonceOf(hit)!;
    expect(nonce).not.toBe(STORED_NONCE);
    for (const [name, value] of Object.entries(HTML_HEADERS)) {
      expect(hit.headers.get(name)).toBe(value.replaceAll(STORED_NONCE, nonce));
    }
    expect([...hit.headers.values()].join('\n')).not.toContain(STORED_NONCE);
    const body = await hit.text();
    expect(body).toBe(HTML_BODY.replaceAll(STORED_NONCE, nonce));
    expect(body).not.toContain(STORED_NONCE);
    expect(body).toContain(`<script nonce="${nonce}">`);
  });

  it('misses and re-renders HTML when a new contest changes drawsVersion', async () => {
    const { cache, deps, state, flush } = setup('3065');
    const render = vi.fn(async () => new Response(`${HTML_BODY}<p>Último concurso ${state.version}</p>`, { headers: HTML_HEADERS }));
    const request = () => new Request('https://example.com/numeros/10');
    await withDrawsEdgeCache(request(), render, deps);
    await flush();
    expect((await withDrawsEdgeCache(request(), render, deps)).headers.get('X-Megasena-Cache')).toBe('HIT');
    state.version = '3066';
    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(await miss.text()).toContain('Último concurso 3066');
    const hit = await withDrawsEdgeCache(request(), render, deps);
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(await hit.text()).toContain('Último concurso 3066');
    expect(render).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(2);
  });

  it('keys HTML by path, build and revision while ignoring query strings', async () => {
    const { cache, deps, flush } = setup();
    const render = html();
    await withDrawsEdgeCache(new Request('https://example.com/resultados/2025?a=1'), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(new Request('https://example.com/resultados/2025?b=2'), render, deps);
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    const miss = await withDrawsEdgeCache(new Request('https://example.com/resultados/2025'), render, { ...deps, buildVersion: 'next-build' });
    await flush();
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(render).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(2);
  });

  it.each(['Cookie', 'Authorization', 'rsc', 'next-router-prefetch', 'next-router-state-tree'])(
    'bypasses HTML cache reads and writes when %s is present, including empty values', async (header) => {
      const { cache, deps, flush } = setup();
      const match = vi.spyOn(cache, 'match');
      const put = vi.spyOn(cache, 'put');
      const url = 'https://example.com/concurso/3000';
      const render = html();
      for (const warm of [false, true]) {
        if (warm) {
          await withDrawsEdgeCache(new Request(url), html(), deps);
          await flush();
        }
        vi.clearAllMocks();
        for (const value of ['', '1']) {
          const response = await withDrawsEdgeCache(new Request(url, { headers: { [header]: value } }), render, deps);
          await flush();
          expect(await response.text()).toBe(HTML_BODY);
          expect(response.headers.has('X-Megasena-Cache')).toBe(false);
        }
        expect(render).toHaveBeenCalledTimes(2);
        expect(deps.drawsVersion).not.toHaveBeenCalled();
        expect(match).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
        expect(cache.entries.size).toBe(warm ? 1 : 0);
      }
    }
  );

  it.each(['?_rsc=payload', '?_rsc=', '?_rsc'])('bypasses HTML cache for RSC query %s', async (query) => {
    const { cache, deps, flush } = setup();
    const render = html();
    await withDrawsEdgeCache(new Request('https://example.com/concurso/3000'), render, deps);
    await flush();
    vi.clearAllMocks();
    const match = vi.spyOn(cache, 'match');
    const response = await withDrawsEdgeCache(new Request(`https://example.com/concurso/3000${query}`), render, deps);
    expect(response.headers.has('X-Megasena-Cache')).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
    expect(match).not.toHaveBeenCalled();
    expect(deps.drawsVersion).not.toHaveBeenCalled();
    expect(cache.entries.size).toBe(1);
  });

  it.each(['/', '/resultados', '/numeros', '/concurso/abc', '/concurso/0', '/concurso/01', '/concurso/1000000', '/concurso/3000/', '/concurso/3000/extra', '/numeros/0', '/numeros/61', '/numeros/01', '/resultados/1995', '/resultados/2101', '/resultados/02025', '/concurso/1.5', '/numeros/-1'])(
    'never caches HTML at non-archive or invalid path %s', async (path) => {
      const { cache, deps, flush } = setup();
      const render = html();
      for (let i = 0; i < 2; i++) {
        const response = await withDrawsEdgeCache(new Request(`https://example.com${path}`), render, deps);
        expect(response.headers.has('X-Megasena-Cache')).toBe(false);
      }
      await flush();
      expect(render).toHaveBeenCalledTimes(2);
      expect(cache.entries.size).toBe(0);
      expect(deps.drawsVersion).not.toHaveBeenCalled();
    }
  );

  it.each(['HEAD', 'POST'])('bypasses HTML cache for %s requests', async (method) => {
    const { cache, deps, flush } = setup();
    await withDrawsEdgeCache(new Request('https://example.com/concurso/3000', { method }), html(), deps);
    await flush();
    expect(cache.entries.size).toBe(0);
    expect(deps.drawsVersion).not.toHaveBeenCalled();
  });

  it('does not store HTML without a CSP nonce, non-HTML, Set-Cookie or non-200 responses', async () => {
    for (const response of [
      new Response(HTML_BODY, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } }),
      new Response(HTML_BODY, { headers: { ...HTML_HEADERS, 'Content-Security-Policy': "default-src 'none'" } }),
      new Response(HTML_BODY, { headers: { ...HTML_HEADERS, 'Content-Security-Policy': "script-src 'nonce-'" } }),
      new Response('rsc', { headers: { ...HTML_HEADERS, 'Content-Type': 'text/x-component' } }),
      new Response(HTML_BODY, { headers: { ...HTML_HEADERS, 'Set-Cookie': 'a=b' } }),
      ...[301, 404, 500].map(status => new Response(HTML_BODY, { status, headers: HTML_HEADERS })),
    ]) {
      const { cache, deps, flush } = setup();
      const result = await withDrawsEdgeCache(new Request('https://example.com/concurso/3000'), async () => response, deps);
      await flush();
      expect(result).toBe(response);
      expect(cache.entries.size).toBe(0);
    }
  });
});
