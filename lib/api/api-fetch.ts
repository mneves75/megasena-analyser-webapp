import { logger } from '@/lib/logger';

export const DEFAULT_API_TIMEOUT_MS = 12000;

type RuntimeTarget = 'server' | 'client';

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

function normalizeBaseUrl(value: string, port: string): string {
  const hasScheme = /^https?:\/\//i.test(value);
  const url = new URL(hasScheme ? value : `http://${value}`);
  if (!url.port) {
    url.port = port;
  }
  return url.toString().replace(/\/$/, '');
}

export function resolveApiBaseUrl(runtime?: RuntimeTarget): string {
  const isServer = runtime ? runtime === 'server' : typeof window === 'undefined';
  if (!isServer) {
    return '';
  }

  const host = process.env['API_HOST'] ?? 'localhost';
  const port = process.env['API_PORT'] ?? '3201';

  return normalizeBaseUrl(host, port);
}

export function buildApiUrl(path: string, runtime?: RuntimeTarget): string {
  const baseUrl = resolveApiBaseUrl(runtime);
  if (!baseUrl) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, `${baseUrl}/`).toString();
}

export async function fetchApi(
  path: string,
  options: ApiFetchOptions = {},
  runtime?: RuntimeTarget
): Promise<Response> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, ...init } = options;
  const url = buildApiUrl(path, runtime);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    logger.warn('api.fetch_failed', {
      targetUrl: url,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
