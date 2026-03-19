import type { Server } from 'bun';

const TRUST_PROXY_HEADERS_ENV = 'TRUST_PROXY_HEADERS';

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

function firstForwardedIp(req: Request): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');

  const ip = forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || cfConnectingIp?.trim();
  return ip && ip.length > 0 ? ip : null;
}

export function resolveClientIp(
  req: Request,
  server: RequestIpResolver,
  trustProxyHeaders: boolean = shouldTrustProxyHeaders()
): string | null {
  const socketAddress = server.requestIP(req)?.address ?? null;
  if (!trustProxyHeaders) {
    return socketAddress;
  }

  return firstForwardedIp(req) ?? socketAddress;
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
