import type { Server } from 'bun';
import { isIP } from 'node:net';

const TRUST_PROXY_HEADERS_ENV = 'TRUST_PROXY_HEADERS';
const TRUSTED_PROXY_IPS_ENV = 'TRUSTED_PROXY_IPS';

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

function firstForwardedForIp(req: Request): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  return normalizeForwardedIp(forwardedFor?.split(',')[0] ?? null);
}

function trustedForwardedIp(req: Request): string | null {
  return (
    normalizeForwardedIp(req.headers.get('cf-connecting-ip')) ??
    normalizeForwardedIp(req.headers.get('x-real-ip')) ??
    firstForwardedForIp(req)
  );
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
