/**
 * Worker-side Cache API layer for public routes whose output is a pure function
 * of the stored draws. HTML pages are excluded on purpose: they carry a
 * per-request CSP nonce, and replaying a nonce would defeat it.
 */
export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface DrawsEdgeCacheDependencies {
  cache: EdgeCache;
  /** Release identity; a deploy that changes a renderer must not reuse old entries. */
  buildVersion: string;
  /** Draws revision from the data object; bumps on every new or corrected contest. */
  drawsVersion: () => Promise<string | null>;
  waitUntil: (promise: Promise<unknown>) => void;
}

// Social images per contest and for the site, plus the crawler indexes. None of
// them read cookies, headers or query parameters.
const DETERMINISTIC_ROUTE = /^\/(?:(?:concurso\/[1-9]\d{0,5}\/)?(?:opengraph|twitter)-image|sitemap\.xml|llms\.txt)$/;
// Upper bound for the stored copy; the revision in the key handles invalidation.
const EDGE_TTL_SECONDS = 86400;
const ORIGINAL_CACHE_CONTROL = 'X-Megasena-Origin-Cache-Control';
const CSP_NONCE = /'nonce-([^']+)'/;

export function isDeterministicRoute(url: URL): boolean {
  return DETERMINISTIC_ROUTE.test(url.pathname);
}

function isSharedCacheable(response: Response): boolean {
  const cacheControl = response.headers.get('Cache-Control')?.toLowerCase() ?? '';
  return response.status === 200
    && /\bpublic\b/.test(cacheControl)
    && !/\b(?:private|no-store)\b/.test(cacheControl)
    && !response.headers.has('Set-Cookie');
}

function cspNonce(headers: Headers): string | null {
  return CSP_NONCE.exec(headers.get('Content-Security-Policy') ?? '')?.[1] ?? null;
}

// Same shape as proxy.ts: 16 random bytes, base64.
function freshNonce(): string {
  let binary = '';
  crypto.getRandomValues(new Uint8Array(16)).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function withCacheStatus(response: Response, status: 'HIT' | 'MISS', cacheControl: string | null): Response {
  const headers = new Headers(response.headers);
  const nonce = status === 'HIT' ? cspNonce(headers) : null;
  if (nonce) {
    // The stored nonce was public once; a replayed value would stop being per-request.
    const replacement = freshNonce();
    for (const [name, value] of [...headers]) {
      if (value.includes(nonce)) headers.set(name, value.replaceAll(nonce, replacement));
    }
  }
  headers.delete(ORIGINAL_CACHE_CONTROL);
  if (cacheControl === null) headers.delete('Cache-Control');
  else headers.set('Cache-Control', cacheControl);
  headers.set('X-Megasena-Cache', status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function withDrawsEdgeCache(
  request: Request,
  render: () => Promise<Response>,
  { cache, buildVersion, drawsVersion, waitUntil }: DrawsEdgeCacheDependencies
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !isDeterministicRoute(url)) return render();

  let key: Request;
  try {
    const version = await drawsVersion();
    if (version === null) return render();
    // Path only: these routes ignore the query, so arbitrary parameters cannot add entries.
    const search = new URLSearchParams({ build: buildVersion, draws: version });
    key = new Request(`${url.origin}${url.pathname}?${search}`);
    const cached = await cache.match(key);
    if (cached) return withCacheStatus(cached, 'HIT', cached.headers.get(ORIGINAL_CACHE_CONTROL));
  } catch (error) {
    console.warn('edge_cache.lookup_failed', error instanceof Error ? error.message : String(error));
    return render();
  }

  const response = await render();
  if (!isSharedCacheable(response)) return response;

  const body = await response.arrayBuffer();
  const cacheControl = response.headers.get('Cache-Control');
  const nonce = cspNonce(response.headers);
  // A body that references its nonce (HTML) cannot be rewritten safely, so it is never stored.
  // UTF-8 decoding keeps ASCII runs intact even inside binary data.
  if (nonce && new TextDecoder().decode(body).includes(nonce)) {
    return new Response(body, response);
  }
  const stored = new Headers(response.headers);
  stored.set(ORIGINAL_CACHE_CONTROL, cacheControl ?? '');
  stored.set('Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}`);
  waitUntil(cache.put(key, new Response(body.slice(0), { status: 200, headers: stored })).catch((error: unknown) => {
    console.warn('edge_cache.store_failed', error instanceof Error ? error.message : String(error));
  }));
  return withCacheStatus(new Response(body, response), 'MISS', cacheControl);
}
