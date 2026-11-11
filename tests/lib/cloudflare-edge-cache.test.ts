import { describe, expect, it, vi } from 'vitest';
import { isDeterministicRoute, withDrawsEdgeCache, type EdgeCache } from '@/lib/cloudflare/edge-cache';
import { APP_INFO } from '@/lib/constants';
import { gzipSync } from 'node:zlib';

// Real clients send a User-Agent; HTML requests without one bypass the cache.
const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36';
function clientRequest(input: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', BROWSER_UA);
  return new Request(input, { ...init, headers });
}

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
    const request = () => clientRequest('https://example.com/concurso/3000/opengraph-image');

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
    await withDrawsEdgeCache(clientRequest('https://example.com/sitemap.xml'), image('xml', 'public, max-age=600'), deps);
    await flush();
    const [stored] = [...cache.entries.values()];
    expect(stored?.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('invalidates by itself when a new contest changes the draws revision', async () => {
    const { deps, state, flush } = setup('3065');
    let body = 'contest-3065';
    const render = vi.fn(async () => new Response(body, { headers: { 'Cache-Control': 'public, max-age=600' } }));
    const request = () => clientRequest('https://example.com/sitemap.xml');

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
    const request = () => clientRequest('https://example.com/llms.txt');
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
        await withDrawsEdgeCache(clientRequest(url), image('public', 'public, max-age=600'), deps);
        await flush();
      }
      vi.clearAllMocks();
      // Presence alone is enough to bypass, even if a proxy leaves an empty header.
      for (const value of ['test-value', '']) {
        const response = await withDrawsEdgeCache(clientRequest(url, { headers: { [header]: value } }), personalized, deps);
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
    const request = () => clientRequest('https://example.com/concurso/3000/opengraph-image');
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
    const result = await withDrawsEdgeCache(clientRequest('https://example.com/llms.txt'), async () => response, deps);
    await flush();
    expect(await result.text()).toContain('Zmlyc3Q=');
    expect(cache.entries.size).toBe(0);
  });

  it.each(['/opengraph-image', '/sitemap.xml', '/llms.txt'])(
    '%s ignores query strings so cache-busting parameters cannot multiply entries', async (path) => {
      const { cache, deps, flush } = setup();
      const render = image();
      await withDrawsEdgeCache(clientRequest(`https://example.com${path}?a=1`), render, deps);
      await flush();
      const hit = await withDrawsEdgeCache(clientRequest(`https://example.com${path}?b=2`), render, deps);
      expect(render).toHaveBeenCalledTimes(1);
      expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
      expect(await hit.text()).toBe('png-1');
      expect(cache.entries.size).toBe(1);
    }
  );

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
      const result = await withDrawsEdgeCache(clientRequest('https://example.com/sitemap.xml'), async () => response, deps);
      await flush();
      expect(result.status).toBe(response.status);
      expect(result.headers.has('X-Megasena-Cache')).toBe(false);
      expect(cache.entries.size).toBe(0);
    }
  });

  it('bypasses non-GET methods, other routes and an unknown draws revision', async () => {
    for (const [request, version] of [
      [clientRequest('https://example.com/sitemap.xml', { method: 'HEAD' }), '3065'],
      [clientRequest('https://example.com/concurso/3000'), '3065'],
      [clientRequest('https://example.com/sitemap.xml'), null],
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
    await withDrawsEdgeCache(clientRequest('https://example.com/dashboard/generator'), image(), deps);
    expect(deps.drawsVersion).not.toHaveBeenCalled();
  });

  it('falls back to rendering when the cache or revision lookup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { deps } = setup();
      const render = image();
      deps.cache.match = async () => { throw new Error('cache unavailable'); };
      const viaCacheFailure = await withDrawsEdgeCache(clientRequest('https://example.com/sitemap.xml'), render, deps);
      deps.drawsVersion.mockRejectedValueOnce(new Error('rpc failed'));
      const viaVersionFailure = await withDrawsEdgeCache(clientRequest('https://example.com/sitemap.xml'), render, deps);
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
// Complete pages carry the marker rendered by app/_components/edge-cacheable.tsx.
const MARKER_HTML = '<div hidden="" data-edge-cache="complete"></div>';
const HTML_BODY = `<!doctype html><html lang="pt-BR"><head><style nonce="${STORED_NONCE}">body{margin:0}</style></head><body>${MARKER_HTML}<h1>Concurso 3000</h1><script nonce="${STORED_NONCE}">self.__next_f.push([1, '${STORED_NONCE}', {"nonce":"${STORED_NONCE}"}]);</script><p>${STORED_NONCE}</p></body></html>`;
// What a fallback, a streamed error boundary or a loading shell looks like: no marker.
const DEGRADED_HTML_BODY = HTML_BODY.replace(MARKER_HTML, '');
// RSC rendered the marker but SSR did not: only its JSON-escaped flight form is present.
const FLIGHT_ONLY_HTML_BODY = DEGRADED_HTML_BODY.replace(
  '</body>',
  `<script nonce="${STORED_NONCE}">self.__next_f.push([1,"0:[\\"$\\",\\"div\\",null,{\\"hidden\\":true,\\"data-edge-cache\\":\\"complete\\"}]"])</script></body>`
);
// Two markers mean two renders in one body (e.g. concatenated documents): not one complete page.
const DOUBLE_MARKER_HTML_BODY = HTML_BODY.replace('</body>', `${MARKER_HTML}</body>`);
const PAGE_ROUTES = ['/', '/dashboard', '/dashboard/statistics', '/resultados', '/numeros', '/mega-da-virada'];
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
  it('streams a MISS to the visitor before the page finishes and stores it once complete', async () => {
    const { cache, deps, flush } = setup();
    const [head, tail] = [HTML_BODY.slice(0, HTML_BODY.indexOf(MARKER_HTML)), HTML_BODY.slice(HTML_BODY.indexOf(MARKER_HTML))];
    const encoder = new TextEncoder();
    let finish!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(head));
        finish = () => { controller.enqueue(encoder.encode(tail)); controller.close(); };
      },
    });
    const render = vi.fn(async () => new Response(body, { headers: HTML_HEADERS }));

    // Resolves while the render is still pending: the loading shell reaches the visitor first.
    const miss = await withDrawsEdgeCache(clientRequest('https://example.com/dashboard/statistics'), render, deps);
    const reader = miss.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe(head);
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(miss.headers.get('Cache-Control')).toBe('no-store');
    expect(cache.entries.size).toBe(0);

    finish();
    while (!(await reader.read()).done) { /* drain */ }
    await flush();
    expect(cache.entries.size).toBe(1);
  });

  it('renders one HTML variant: metadata goes in <head> for browsers and crawlers alike', async () => {
    const { default: config } = await import('../../next.config.js');
    for (const userAgent of [BROWSER_UA, 'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'curl/8.7.1']) {
      expect(config.htmlLimitedBots?.test(userAgent), userAgent).toBe(true);
    }
  });

  it('bypasses HTML reads and writes when the request has no User-Agent', async () => {
    const { cache, deps, flush } = setup();
    for (const userAgent of [null, '']) {
      const headers = userAgent === null ? undefined : { 'User-Agent': userAgent };
      const render = html();
      const response = await withDrawsEdgeCache(new Request('https://example.com/dashboard', { headers }), render, deps);
      await flush();
      expect(render).toHaveBeenCalledTimes(1);
      expect(response.headers.has('X-Megasena-Cache')).toBe(false);
    }
    expect(cache.entries.size).toBe(0);
    expect(deps.drawsVersion).not.toHaveBeenCalled();
  });

  it('prevents downstream reuse of a nonce when origin Cache-Control is absent', async () => {
    const { deps, flush } = setup();
    const headers = new Headers(HTML_HEADERS);
    headers.delete('Cache-Control');
    const render = vi.fn(async () => new Response(HTML_BODY, { headers }));
    const request = () => clientRequest('https://example.com/concurso/3000');
    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(request(), render, deps);
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(miss.headers.get('Cache-Control')).toBe('no-store');
    expect(hit.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each(['/concurso/1', '/concurso/999999', '/numeros/1', '/numeros/60', '/resultados/1996', '/resultados/2100'])(
    'caches canonical archive route %s and keeps MISS output unchanged', async (path) => {
      const { cache, deps, flush } = setup();
      const render = html();
      const request = () => clientRequest(`https://example.com${path}`);
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
    const request = () => clientRequest('https://example.com/concurso/3000');
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
    const request = () => clientRequest('https://example.com/concurso/3000');
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
    const request = () => clientRequest('https://example.com/numeros/10');
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

  it('keys queryless HTML by path, build and revision', async () => {
    const { cache, deps, flush } = setup();
    const render = html();
    await withDrawsEdgeCache(clientRequest('https://example.com/resultados/2025'), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(clientRequest('https://example.com/resultados/2025'), render, deps);
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    const miss = await withDrawsEdgeCache(clientRequest('https://example.com/resultados/2025'), render, { ...deps, buildVersion: 'next-build' });
    await flush();
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(render).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(2);
  });

  it.each(['/concurso/3005', '/numeros/10', '/resultados/2025'])(
    'renders each query navigation state at %s without reading or writing the HTML cache', async (path) => {
      for (const warm of [false, true]) {
        const { cache, deps, flush } = setup();
        const base = `https://example.com${path}`;
        if (warm) {
          await withDrawsEdgeCache(clientRequest(base), html(), deps);
          await flush();
        }
        deps.drawsVersion.mockClear();
        const match = vi.spyOn(cache, 'match');
        const put = vi.spyOn(cache, 'put');
        // Mirrors the navigation payload serialized by vinext's buildHeadInjectionHtml.
        const render = vi.fn(async (url: URL) => new Response(`${HTML_BODY}<script nonce="${STORED_NONCE}">self.bootstrap=${JSON.stringify({
          nav: { pathname: url.pathname, searchParams: [...url.searchParams.entries()] },
        })};</script>`, { headers: HTML_HEADERS }));
        const results = [];
        for (const query of ['?qa=first', '?qa=second', '?qa=', '?qa', '?=empty-key', '?=', '?&']) {
          const url = new URL(base + query);
          const response = await withDrawsEdgeCache(clientRequest(url), () => render(url), deps);
          await flush();
          results.push({
            body: await response.text(), cacheStatus: response.headers.get('X-Megasena-Cache'),
            nav: { pathname: url.pathname, searchParams: [...url.searchParams.entries()] },
          });
        }
        for (const result of results) expect(result.body).toContain(JSON.stringify({ nav: result.nav }));
        for (const result of results) expect(result.cacheStatus).toBeNull();
        expect(render).toHaveBeenCalledTimes(results.length);
        expect(deps.drawsVersion).not.toHaveBeenCalled();
        expect(match).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
        expect(cache.entries.size).toBe(warm ? 1 : 0);
      }
    }
  );

  it.each(['Cookie', 'Authorization', 'rsc', 'next-router-prefetch', 'next-router-state-tree',
    'next-router-segment-prefetch', 'next-url', 'x-vinext-rsc-render-mode', 'x-vinext-interception-context',
    'next-action', 'x-rsc-action', 'x-nextjs-data', 'x-middleware-prefetch', 'Range', 'If-None-Match'])(
    'bypasses HTML cache reads and writes when %s is present, including empty values', async (header) => {
      const { cache, deps, flush } = setup();
      const match = vi.spyOn(cache, 'match');
      const put = vi.spyOn(cache, 'put');
      const url = 'https://example.com/concurso/3000';
      const render = html();
      for (const warm of [false, true]) {
        if (warm) {
          await withDrawsEdgeCache(clientRequest(url), html(), deps);
          await flush();
        }
        vi.clearAllMocks();
        for (const value of ['', '1']) {
          const response = await withDrawsEdgeCache(clientRequest(url, { headers: { [header]: value } }), render, deps);
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
    await withDrawsEdgeCache(clientRequest('https://example.com/concurso/3000'), render, deps);
    await flush();
    vi.clearAllMocks();
    const match = vi.spyOn(cache, 'match');
    const response = await withDrawsEdgeCache(clientRequest(`https://example.com/concurso/3000${query}`), render, deps);
    expect(response.headers.has('X-Megasena-Cache')).toBe(false);
    expect(render).toHaveBeenCalledTimes(1);
    expect(match).not.toHaveBeenCalled();
    expect(deps.drawsVersion).not.toHaveBeenCalled();
    expect(cache.entries.size).toBe(1);
  });

  it.each(['/dashboard/generator', '/numeros/', '/resultados/', '/dashboard/', '/mega-da-virada/', '/Dashboard', '/Numeros', '/about', '/index.html', '//', '/concurso/abc', '/concurso/0', '/concurso/01', '/concurso/1000000', '/concurso/3000/', '/concurso/3000/extra', '/numeros/0', '/numeros/61', '/numeros/01', '/resultados/1995', '/resultados/2101', '/resultados/02025', '/concurso/1.5', '/numeros/-1'])(
    'never caches HTML at non-archive or invalid path %s', async (path) => {
      const { cache, deps, flush } = setup();
      const render = html();
      for (let i = 0; i < 2; i++) {
        const response = await withDrawsEdgeCache(clientRequest(`https://example.com${path}`), render, deps);
        expect(response.headers.has('X-Megasena-Cache')).toBe(false);
      }
      await flush();
      expect(render).toHaveBeenCalledTimes(2);
      expect(cache.entries.size).toBe(0);
      expect(deps.drawsVersion).not.toHaveBeenCalled();
    }
  );

  it.each(PAGE_ROUTES)('caches the complete page %s and gives each HIT a fresh nonce', async (path) => {
    const { cache, deps, flush } = setup();
    const render = html();
    const request = () => clientRequest(`https://example.com${path}`);
    const miss = await withDrawsEdgeCache(request(), render, deps);
    await flush();
    expect(miss.headers.get('X-Megasena-Cache')).toBe('MISS');
    expect(await miss.text()).toBe(HTML_BODY);
    expect(cache.entries.size).toBe(1);
    const hits = [await withDrawsEdgeCache(request(), render, deps), await withDrawsEdgeCache(request(), render, deps)];
    const nonces = [];
    for (const hit of hits) {
      expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
      expect(hit.headers.get('Cache-Control')).toBe('no-store');
      const nonce = nonceOf(hit)!;
      expect(nonce).not.toBe(STORED_NONCE);
      expect(hit.headers.get('X-Nonce')).toBe(nonce);
      expect(await hit.text()).toBe(HTML_BODY.replaceAll(STORED_NONCE, nonce));
      nonces.push(nonce);
    }
    expect(nonces[0]).not.toBe(nonces[1]);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it.each([...PAGE_ROUTES, '/concurso/3000', '/numeros/10', '/resultados/2025'])(
    'never stores %s without exactly one completeness marker: every request renders and reports MISS', async (path) => {
      for (const body of [DEGRADED_HTML_BODY, FLIGHT_ONLY_HTML_BODY, DOUBLE_MARKER_HTML_BODY]) {
        const { cache, deps, flush } = setup();
        const put = vi.spyOn(cache, 'put');
        const render = vi.fn(async () => new Response(body, { headers: HTML_HEADERS }));
        for (let pass = 0; pass < 3; pass++) {
          const response = await withDrawsEdgeCache(clientRequest(`https://example.com${path}`), render, deps);
          await flush();
          expect(response.status).toBe(200);
          expect(response.headers.get('X-Megasena-Cache')).toBe('MISS');
          expect(response.headers.get('Cache-Control')).toBe('no-store');
          // The degraded page still reaches the reader unchanged, with its own nonce.
          expect(nonceOf(response)).toBe(STORED_NONCE);
          expect(await response.text()).toBe(body);
        }
        expect(render).toHaveBeenCalledTimes(3);
        expect(put).not.toHaveBeenCalled();
        expect(cache.entries.size).toBe(0);
      }
    }
  );

  it.each(['/?x=1', '/dashboard?_rsc=1', '/dashboard/statistics?tab=1', '/resultados?utm_source=x', '/numeros?&', '/mega-da-virada?_rsc'])(
    'bypasses reads and writes for the page request %s', async (target) => {
      for (const warm of [false, true]) {
        const { cache, deps, flush } = setup();
        const url = new URL(`https://example.com${target}`);
        if (warm) {
          await withDrawsEdgeCache(clientRequest(`${url.origin}${url.pathname}`), html(), deps);
          await flush();
        }
        deps.drawsVersion.mockClear();
        const match = vi.spyOn(cache, 'match');
        const put = vi.spyOn(cache, 'put');
        const render = html();
        const response = await withDrawsEdgeCache(clientRequest(url), render, deps);
        await flush();
        expect(response.headers.has('X-Megasena-Cache')).toBe(false);
        expect(render).toHaveBeenCalledTimes(1);
        expect(deps.drawsVersion).not.toHaveBeenCalled();
        expect(match).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
        expect(cache.entries.size).toBe(warm ? 1 : 0);
      }
    }
  );

  it.each(['Cookie', 'Authorization', 'rsc', 'next-router-state-tree', 'x-vinext-rsc-render-mode', 'Range', 'If-Modified-Since'])(
    'bypasses page HTML at / when %s is present', async (header) => {
      const { cache, deps, flush } = setup();
      const put = vi.spyOn(cache, 'put');
      const response = await withDrawsEdgeCache(clientRequest('https://example.com/', { headers: { [header]: '1' } }), html(), deps);
      await flush();
      expect(response.headers.has('X-Megasena-Cache')).toBe(false);
      expect(deps.drawsVersion).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );

  it.each(['HEAD', 'POST'])('bypasses HTML cache for %s requests', async (method) => {
    const { cache, deps, flush } = setup();
    await withDrawsEdgeCache(clientRequest('https://example.com/concurso/3000', { method }), html(), deps);
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
      const result = await withDrawsEdgeCache(clientRequest('https://example.com/concurso/3000'), async () => response, deps);
      await flush();
      expect(result).toBe(response);
      expect(cache.entries.size).toBe(0);
    }
  });

  it('leaves compressed HTML untouched and outside the nonce-rewriting cache', async () => {
    const { cache, deps, flush } = setup();
    const body = new Uint8Array(gzipSync(HTML_BODY));
    const render = vi.fn(async () => new Response(body, { headers: { ...HTML_HEADERS, 'Content-Encoding': 'gzip' } }));
    for (let pass = 0; pass < 2; pass++) {
      const response = await withDrawsEdgeCache(clientRequest('https://example.com/concurso/3000'), render, deps);
      await flush();
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
      expect(response.headers.get('Content-Encoding')).toBe('gzip');
      expect(response.headers.has('X-Megasena-Cache')).toBe(false);
    }
    expect(cache.entries.size).toBe(0);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('removes stale representation headers after rewriting an HTML nonce', async () => {
    const { deps, flush } = setup();
    const representationHeaders = {
      'Content-Length': String(new TextEncoder().encode(HTML_BODY).length),
      ETag: '"original"', 'Last-Modified': 'Mon, 26 Oct 2026 06:00:00 GMT',
      'Content-MD5': 'original-digest', Digest: 'sha-256=original', 'Content-Digest': 'sha-256=:original:',
    };
    const render = vi.fn(async () => new Response(HTML_BODY, { headers: { ...HTML_HEADERS, ...representationHeaders } }));
    const request = () => clientRequest('https://example.com/concurso/3000');
    await withDrawsEdgeCache(request(), render, deps);
    await flush();
    const hit = await withDrawsEdgeCache(request(), render, deps);
    expect(hit.headers.get('X-Megasena-Cache')).toBe('HIT');
    for (const header of Object.keys(representationHeaders)) expect(hit.headers.has(header), header).toBe(false);
    expect(await hit.text()).toBe(HTML_BODY.replaceAll(STORED_NONCE, nonceOf(hit)!));
  });

  it.each(['*', 'Accept-Language', 'X-Custom-Variant'])('does not cache an unkeyed Vary: %s variant', async (vary) => {
    const { cache, deps, flush } = setup();
    const render = vi.fn(async () => new Response(HTML_BODY, { headers: { ...HTML_HEADERS, Vary: vary } }));
    for (let pass = 0; pass < 2; pass++) {
      const response = await withDrawsEdgeCache(clientRequest('https://example.com/concurso/3000'), render, deps);
      await flush();
      expect(response.headers.has('X-Megasena-Cache')).toBe(false);
    }
    expect(cache.entries.size).toBe(0);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('caches ordinary HTML with only the bypassed framework and encoding Vary selectors', async () => {
    const { deps, flush } = setup();
    const render = vi.fn(async () => new Response(HTML_BODY, { headers: {
      ...HTML_HEADERS, Vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url, X-Vinext-Rsc-Render-Mode, Accept-Encoding',
    } }));
    const request = () => clientRequest('https://example.com/concurso/3000');
    await withDrawsEdgeCache(request(), render, deps);
    await flush();
    expect((await withDrawsEdgeCache(request(), render, deps)).headers.get('X-Megasena-Cache')).toBe('HIT');
    expect(render).toHaveBeenCalledTimes(1);
  });
});
