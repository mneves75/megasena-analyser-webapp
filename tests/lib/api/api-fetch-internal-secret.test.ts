import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/api-fetch';
import { logger } from '@/lib/logger';

const originalEnv = {
  API_HOST: process.env['API_HOST'],
  API_PORT: process.env['API_PORT'],
  INTERNAL_API_SECRET: process.env['INTERNAL_API_SECRET'],
};
const internalSecretFixture = ['internal', 'test', 'shared', 'value', 'not', 'real', '0002'].join(
  '-'
);

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];
  if (typeof value === 'undefined') {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('fetchApi internal secret target guard', () => {
  beforeEach(() => {
    process.env['API_PORT'] = '3201';
    process.env['INTERNAL_API_SECRET'] = internalSecretFixture;
  });

  afterEach(() => {
    restoreEnv('API_HOST');
    restoreEnv('API_PORT');
    restoreEnv('INTERNAL_API_SECRET');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('attaches the secret to a relative server-side target', async () => {
    process.env['API_HOST'] = '';
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Headers | undefined;
      expect(headers?.get('X-Megasena-Internal-Request')).toBe('1');
      expect(headers?.get('X-Megasena-Internal-Request-Secret')).toBe(internalSecretFixture);
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    await fetchApi('/api/dashboard', {}, 'server');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/dashboard',
      expect.objectContaining({ headers: expect.any(Headers) })
    );
  });

  it.each(['localhost', '127.0.0.1', '::1'])(
    'attaches the secret to loopback host %s',
    async (host) => {
      process.env['API_HOST'] = host;
      const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Headers | undefined;
        expect(headers?.get('X-Megasena-Internal-Request-Secret')).toBe(
          internalSecretFixture
        );
        return Promise.resolve(new Response('{}', { status: 200 }));
      });
      vi.stubGlobal('fetch', fetchSpy);

      await fetchApi('/api/dashboard', {}, 'server');

      expect(fetchSpy).toHaveBeenCalledOnce();
    }
  );

  it('rejects an off-box target and logs only its origin', async () => {
    process.env['API_HOST'] = 'http://198.51.100.7:8080';
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Headers | undefined;
      expect(headers?.get('X-Megasena-Internal-Request')).toBeNull();
      expect(headers?.get('X-Megasena-Internal-Request-Secret')).toBeNull();
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    await fetchApi('/api/dashboard?private=query', {}, 'server');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('security.internal_secret_target_rejected', {
      targetOrigin: 'http://198.51.100.7:8080',
    });
    const warningPayload = JSON.stringify(warnSpy.mock.calls);
    expect(warningPayload).not.toContain(internalSecretFixture);
    expect(warningPayload).not.toContain('private=query');
  });
});
