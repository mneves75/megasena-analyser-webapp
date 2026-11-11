import { describe, expect, it, vi } from 'vitest';
import * as pseudonymize from '../../lib/security/pseudonymize';
import { createApiHandler, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../../lib/api/handler';

vi.mock('../../lib/security/pseudonymize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/security/pseudonymize')>();
  return { ...actual, pseudonymizeClient: vi.fn(actual.pseudonymizeClient) };
});

const options = { environment: 'production', appVersion: 'test',
  ipHashSecret: 'public-api-factory-test-secret-0123456789' };
const request = () => new Request('https://example.com/api/missing');

describe('rate-limit key', () => {
  it('is computed once per request on the Bun path', async () => {
    const handler = createApiHandler({ ...options, audit: vi.fn() });
    vi.mocked(pseudonymize.pseudonymizeClient).mockClear();
    const response = await handler.fetch(request(), { clientIp: '203.0.113.40' });
    expect(response.status).toBe(404);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(pseudonymize.pseudonymizeClient).toHaveBeenCalledTimes(1);
  });

  it('is computed once per request on the Worker path and is the audited client id', async () => {
    const audit = vi.fn();
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 7, resetAt: 1 }));
    const handler = createApiHandler({ ...options, audit, checkRateLimit });
    vi.mocked(pseudonymize.pseudonymizeClient).mockClear();
    const response = await handler.fetch(new Request('https://example.com/api/health'), { clientIp: '203.0.113.41' });
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('7');
    expect(pseudonymize.pseudonymizeClient).toHaveBeenCalledTimes(1);
    const key = checkRateLimit.mock.calls[0]?.[0];
    expect(key).toMatch(/^hmac-sha256:v1:/);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ clientIdHash: key }));
  });
});

describe('Worker transport peers', () => {
  // The Worker transport no longer marks SSR calls internal: a loader that
  // forgets forwardedClientIpHeaders() is metered, not silently exempt.
  it('meters a call without a forwarded IP under the shared unknown subject', async () => {
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 98, resetAt: 1 }));
    const handler = createApiHandler({ ...options, audit: vi.fn(), checkRateLimit });
    const response = await handler.fetch(new Request('https://example.com/api/health'), { clientIp: null, secure: true });
    expect(checkRateLimit).toHaveBeenCalledWith('unknown');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('98');
  });

  it('meters a call with the forwarded IP under that client subject', async () => {
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 98, resetAt: 1 }));
    const handler = createApiHandler({ ...options, audit: vi.fn(), checkRateLimit });
    await handler.fetch(new Request('https://example.com/api/health'), { clientIp: '192.0.2.1', secure: true });
    const expected = (await vi.importActual<typeof import('../../lib/security/pseudonymize')>('../../lib/security/pseudonymize'))
      .pseudonymizeClient('192.0.2.1', options.ipHashSecret, new Uint8Array(0));
    expect(checkRateLimit).toHaveBeenCalledWith(expected);
  });
});

describe('rate-limit window boundary', () => {
  // Both adapters expire a window at resetAt <= now: the request at exactly
  // resetAt opens a new window (cloudflare/data-object.ts uses the same rule).
  it('opens a new Bun window at exactly resetAt', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-06-01T12:00:00.000Z') });
    try {
      const handler = createApiHandler({ ...options, audit: vi.fn() });
      const peer = { clientIp: '203.0.113.50' };
      for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index++) await handler.fetch(request(), peer);
      expect((await handler.fetch(request(), peer)).status).toBe(429);
      vi.setSystemTime(Date.parse('2026-06-01T12:00:00.000Z') + RATE_LIMIT_WINDOW_MS);
      const atReset = await handler.fetch(request(), peer);
      expect(atReset.status).toBe(404);
      expect(atReset.headers.get('X-RateLimit-Remaining')).toBe(String(RATE_LIMIT_MAX_REQUESTS - 1));
    } finally {
      vi.useRealTimers();
    }
  });
});
