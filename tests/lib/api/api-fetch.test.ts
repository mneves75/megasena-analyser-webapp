import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl, fetchApi, resolveApiBaseUrl } from '@/lib/api/api-fetch';

const originalEnv = {
  API_HOST: process.env.API_HOST,
  API_PORT: process.env.API_PORT,
  INTERNAL_API_SECRET: process.env['INTERNAL_API_SECRET'],
};
const internalSecretFixture = ['internal', 'test', 'shared', 'value', 'not', 'real', '0001'].join('-');

describe('api fetch helpers', () => {
  beforeEach(() => {
    process.env.API_HOST = 'localhost';
    process.env.API_PORT = '3201';
  });

  afterEach(() => {
    process.env.API_HOST = originalEnv.API_HOST;
    process.env.API_PORT = originalEnv.API_PORT;
    process.env['INTERNAL_API_SECRET'] = originalEnv.INTERNAL_API_SECRET;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves API base URL on the server', () => {
    process.env.API_HOST = 'api.internal';
    process.env.API_PORT = '9999';

    expect(resolveApiBaseUrl('server')).toBe('http://api.internal:9999');
  });

  it('builds API URLs for server runtime', () => {
    process.env.API_HOST = 'localhost';
    process.env.API_PORT = '3201';

    expect(buildApiUrl('/api/dashboard', 'server')).toBe('http://localhost:3201/api/dashboard');
  });

  it('leaves API paths relative on the client', () => {
    expect(buildApiUrl('/api/dashboard', 'client')).toBe('/api/dashboard');
  });

  it('aborts when the timeout elapses', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (!signal) {
          return;
        }
        if (signal.aborted) {
          reject(signal.reason ?? new Error('AbortError'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(signal.reason ?? new Error('AbortError'));
        });
      });
    });

    vi.stubGlobal('fetch', fetchSpy);

    const promise = fetchApi('/api/timeout', { timeoutMs: 50 }, 'server');
    const assertion = expect(promise).rejects.toThrow('Request timed out');

    await vi.advanceTimersByTimeAsync(75);
    await assertion;
  });

  it('marks server-side API calls as internal service requests when a shared secret is configured', async () => {
    process.env['INTERNAL_API_SECRET'] = internalSecretFixture;
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Headers | undefined;
      expect(headers?.get('X-Megasena-Internal-Request')).toBe('1');
      expect(headers?.get('X-Megasena-Internal-Request-Secret')).toBe(internalSecretFixture);
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    await fetchApi('/api/dashboard', {}, 'server');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3201/api/dashboard',
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );
  });

  it('does not add internal service headers without a strong shared secret', async () => {
    delete process.env['INTERNAL_API_SECRET'];
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Headers | undefined;
      expect(headers?.get('X-Megasena-Internal-Request')).toBeNull();
      expect(headers?.get('X-Megasena-Internal-Request-Secret')).toBeNull();
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    await fetchApi('/api/dashboard', {}, 'server');
  });

  it('does not add internal headers to client-side relative calls', async () => {
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Headers | undefined;
      expect(headers?.get('X-Megasena-Internal-Request')).toBeNull();
      return Promise.resolve(new Response('{}', { status: 200 }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    await fetchApi('/api/dashboard', {}, 'client');
  });
});
