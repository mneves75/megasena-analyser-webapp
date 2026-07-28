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
  const normalizedValue = value.trim() === '::1' ? '[::1]' : value.trim();
  const hasScheme = /^https?:\/\//i.test(normalizedValue);
  const url = new URL(hasScheme ? normalizedValue : `http://${normalizedValue}`);
  if (!url.port) {
    url.port = port;
  }
  return url.toString().replace(/\/$/, '');
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function resolveApiBaseUrl(runtime?: RuntimeTarget): string {
  const isServer = runtime ? runtime === 'server' : typeof window === 'undefined';
  if (!isServer) {
    return '';
  }

  const configuredHost = process.env['API_HOST'];
  if (typeof configuredHost === 'string' && configuredHost.trim() === '') {
    return '';
  }

  const host = configuredHost ?? 'localhost';
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
  const isServer = runtime ? runtime === 'server' : typeof window === 'undefined';
  const url = buildApiUrl(path, runtime);
  const controller = new AbortController();
  const headers = new Headers(init.headers);
  const internalApiSecret = (process.env['INTERNAL_API_SECRET'] ?? '').trim();
  let shouldAttachSecret = false;
  if (isServer && internalApiSecret.length >= 32) {
    if (url.startsWith('/') && !url.startsWith('//')) {
      shouldAttachSecret = true;
    } else {
      try {
        const target = new URL(url);
        shouldAttachSecret = isLoopbackHostname(target.hostname);
        if (!shouldAttachSecret) {
          logger.warn('security.internal_secret_target_rejected', {
            targetOrigin: target.origin,
          });
        }
      } catch {
        shouldAttachSecret = false;
      }
    }
  }
  if (shouldAttachSecret) {
    headers.set('X-Megasena-Internal-Request', '1');
    headers.set('X-Megasena-Internal-Request-Secret', internalApiSecret);
  }
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, { ...init, headers, signal: controller.signal });
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
