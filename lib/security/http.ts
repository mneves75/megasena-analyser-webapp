import type { Server } from 'bun';
import { isIP } from 'node:net';

const TRUST_PROXY_HEADERS_ENV = 'TRUST_PROXY_HEADERS';
const TRUSTED_PROXY_IPS_ENV = 'TRUSTED_PROXY_IPS';
const TRUSTED_CLIENT_IP_HEADER_ENV = 'TRUSTED_CLIENT_IP_HEADER';

/**
 * Headers consulted, in order, for the real client address once the socket peer
 * is a trusted proxy.
 *
 * SECURITY CONTRACT: every header in this list must be REWRITTEN by the public
 * edge on each request. A header the edge merely forwards is client-controlled,
 * and since it becomes the rate-limit key and the audited client hash, a client
 * that can reach the origin directly would get a fresh bucket per request. The
 * edge in front of this deployment rewrites the `x-*` pair but not
 * `cf-connecting-ip`, which Cloudflare sets and only Cloudflare should set — so
 * a deployment whose origin is reachable outside Cloudflare MUST pin a single
 * header with `TRUSTED_CLIENT_IP_HEADER` (or firewall the origin). See
 * docs/SECURITY.md.
 */
const DEFAULT_CLIENT_IP_HEADERS = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'] as const;

function configuredClientIpHeaders(): readonly string[] {
  const configured = (process.env[TRUSTED_CLIENT_IP_HEADER_ENV] ?? '').trim().toLowerCase();
  return configured.length > 0 ? [configured] : DEFAULT_CLIENT_IP_HEADERS;
}

export class RequestBodyTooLargeError extends Error {
  readonly maxBytes: number;
  readonly actualBytes: number;

  constructor(maxBytes: number, actualBytes: number) {
    super(`Request body exceeded limit of ${maxBytes} bytes`);
    this.name = 'RequestBodyTooLargeError';
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

export type RequestIpResolver = Pick<Server, 'requestIP'>;

function shouldTrustProxyHeaders(): boolean {
  return process.env[TRUST_PROXY_HEADERS_ENV] === 'true';
}

function configuredTrustedProxyIps(): Set<string> {
  return new Set(
    (process.env[TRUSTED_PROXY_IPS_ENV] ?? '')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean)
  );
}

function normalizeSocketAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
}

export function isTrustedProxyPeer(address: string | null): boolean {
  if (!address) {
    return false;
  }

  const normalized = normalizeSocketAddress(address);
  if (normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost') {
    return true;
  }

  return configuredTrustedProxyIps().has(normalized) || configuredTrustedProxyIps().has(address);
}

function normalizeForwardedIp(value: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 128 || isIP(candidate) === 0) {
    return null;
  }

  return candidate;
}

function readClientIpHeader(req: Request, header: string): string | null {
  const raw = req.headers.get(header);
  if (raw === null) {
    return null;
  }

  // x-forwarded-for is a list; the left-most entry is the original client.
  const candidate = header === 'x-forwarded-for' ? (raw.split(',')[0] ?? null) : raw;
  return normalizeForwardedIp(candidate);
}

function trustedForwardedIp(req: Request): string | null {
  for (const header of configuredClientIpHeaders()) {
    const address = readClientIpHeader(req, header);
    if (address !== null) {
      return address;
    }
  }

  return null;
}

export function resolveClientIp(
  req: Request,
  server: RequestIpResolver,
  trustProxyHeaders: boolean = shouldTrustProxyHeaders()
): string | null {
  const socketAddress = server.requestIP(req)?.address ?? null;
  if (!trustProxyHeaders || !isTrustedProxyPeer(socketAddress)) {
    return socketAddress;
  }

  return trustedForwardedIp(req) ?? socketAddress;
}

export function isSecureRequest(
  req: Request,
  url: URL,
  server: RequestIpResolver,
  trustProxyHeaders: boolean = shouldTrustProxyHeaders()
): boolean {
  if (url.protocol === 'https:') {
    return true;
  }

  const socketAddress = server.requestIP(req)?.address ?? null;
  if (!trustProxyHeaders || !isTrustedProxyPeer(socketAddress)) {
    return false;
  }

  return req.headers.get('x-forwarded-proto')?.trim().toLowerCase() === 'https';
}

export function isJsonContentType(req: Request): boolean {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  return contentType === 'application/json' || contentType?.endsWith('+json') === true;
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export async function readJsonBodyWithLimit<T>(req: Request, maxBytes: number): Promise<T> {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const declaredLength = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes, declaredLength);
    }
  }

  const reader = req.body?.getReader();
  if (!reader) {
    throw new SyntaxError('Request body is empty');
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestBodyTooLargeError(maxBytes, totalBytes);
    }

    chunks.push(value);
  }

  const payload = new TextDecoder().decode(concatChunks(chunks, totalBytes));
  return JSON.parse(payload) as T;
}
