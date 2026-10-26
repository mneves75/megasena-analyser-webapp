/**
 * Worker-side Cache API layer for public routes whose output is a pure function
 * of the stored draws. Archive HTML gets a fresh CSP nonce throughout its
 * headers and body on every HIT; the stored policy is never exposed to clients.
 */
import { FIRST_DRAW_YEAR, LAST_ACCEPTED_YEAR, MAX_CONTEST_NUMBER } from '../api/archive-contract';

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
const HTML_ARCHIVE_ROUTE = /^\/(concurso|numeros|resultados)\/([1-9]\d{0,5})$/;
// Upper bound for the stored copy; the revision in the key handles invalidation.
const EDGE_TTL_SECONDS = 86400;
const ORIGINAL_CACHE_CONTROL = 'X-Megasena-Origin-Cache-Control';
const CSP_NONCE = /'nonce-([^']+)'/;
const FRAMEWORK_HEADER = /^(?:rsc$|next-|x-(?:vinext-|nextjs-|middleware-|rsc-))/i;

export function isDeterministicRoute(url: URL): boolean {
  return DETERMINISTIC_ROUTE.test(url.pathname);
}

function isHtmlArchiveRoute(url: URL): boolean {
  const match = HTML_ARCHIVE_ROUTE.exec(url.pathname);
  if (!match) return false;
  const value = Number(match[2]);
  if (match[1] === 'resultados') return value >= FIRST_DRAW_YEAR && value <= LAST_ACCEPTED_YEAR;
  return value <= (match[1] === 'numeros' ? 60 : MAX_CONTEST_NUMBER);
}

function isHtmlResponse(response: Response): boolean {
  return /^text\/html(?:;|$)/i.test(response.headers.get('Content-Type') ?? '');
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

async function withCacheStatus(response: Response, status: 'HIT' | 'MISS', cacheControl: string | null): Promise<Response> {
  const headers = new Headers(response.headers);
  const nonce = status === 'HIT' ? cspNonce(headers) : null;
  let body: BodyInit | null = response.body;
  if (nonce) {
    // The stored nonce was public once; a replayed value would stop being per-request.
    const replacement = freshNonce();
    for (const [name, value] of [...headers]) {
      if (value.includes(nonce)) headers.set(name, value.replaceAll(nonce, replacement));
    }
    if (isHtmlResponse(response)) {
      body = (await response.text()).replaceAll(nonce, replacement);
      for (const name of ['Content-Length', 'ETag', 'Last-Modified', 'Content-MD5', 'Digest', 'Content-Digest']) headers.delete(name);
    }
  }
  headers.delete(ORIGINAL_CACHE_CONTROL);
  // Only the private Cache API copy may reuse HTML with its stored nonce.
  if (isHtmlResponse(response) && !/\bno-store\b/i.test(cacheControl ?? '')) headers.set('Cache-Control', 'no-store');
  else if (cacheControl === null) headers.delete('Cache-Control');
  else headers.set('Cache-Control', cacheControl);
  headers.set('X-Megasena-Cache', status);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

export async function withDrawsEdgeCache(
  request: Request,
  render: () => Promise<Response>,
  { cache, buildVersion, drawsVersion, waitUntil }: DrawsEdgeCacheDependencies
): Promise<Response> {
  const url = new URL(request.url);
  const htmlArchive = isHtmlArchiveRoute(url);
  if (request.method !== 'GET' || (!htmlArchive && !isDeterministicRoute(url))
    || (htmlArchive && url.search !== '')
    || request.headers.has('Authorization') || request.headers.has('Cookie')
    || [...request.headers.keys()].some(name => FRAMEWORK_HEADER.test(name) || /^(?:range$|if-)/i.test(name))
    || url.searchParams.has('_rsc')) return render();

  let key: Request;
  try {
    const version = await drawsVersion();
    if (version === null) return render();
    // HTML is queryless here; deterministic image/index routes ignore query parameters.
    const search = new URLSearchParams({ build: buildVersion, draws: version });
    key = new Request(`${url.origin}${url.pathname}?${search}`);
    const cached = await cache.match(key);
    if (cached) return await withCacheStatus(cached, 'HIT', cached.headers.get(ORIGINAL_CACHE_CONTROL));
  } catch (error) {
    console.warn('edge_cache.lookup_failed', error instanceof Error ? error.message : String(error));
    return render();
  }

  const response = await render();
  const vary = response.headers.get('Vary')?.split(',').map(name => name.trim()).filter(Boolean) ?? [];
  if (vary.some(name => !FRAMEWORK_HEADER.test(name) && name.toLowerCase() !== 'accept-encoding')) return response;
  const nonce = cspNonce(response.headers);
  if (htmlArchive) {
    // Only this allowlist may override no-store for the internal Cache API copy.
    if (response.status !== 200 || response.headers.has('Set-Cookie') || !isHtmlResponse(response) || !nonce
      || response.headers.has('Content-Encoding') || /\bno-transform\b/i.test(response.headers.get('Cache-Control') ?? '')) return response;
  } else if (!isSharedCacheable(response)) return response;

  const body = await response.arrayBuffer();
  const cacheControl = response.headers.get('Cache-Control');
  // Other routes retain their original policy: only archive HTML supports body rewriting.
  // UTF-8 decoding keeps ASCII runs intact even inside binary data.
  if (!htmlArchive && nonce && new TextDecoder().decode(body).includes(nonce)) {
    return new Response(body, response);
  }
  const stored = new Headers(response.headers);
  if (cacheControl === null) stored.delete(ORIGINAL_CACHE_CONTROL);
  else stored.set(ORIGINAL_CACHE_CONTROL, cacheControl);
  stored.set('Cache-Control', `public, max-age=${EDGE_TTL_SECONDS}`);
  waitUntil(cache.put(key, new Response(body.slice(0), { status: 200, headers: stored })).catch((error: unknown) => {
    console.warn('edge_cache.store_failed', error instanceof Error ? error.message : String(error));
  }));
  return withCacheStatus(new Response(body, response), 'MISS', cacheControl);
}
