import { describe, expect, it, vi } from 'vitest';
import * as pseudonymize from '../../lib/security/pseudonymize';
import { createApiHandler, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../../lib/api/handler';
import '../../lib/log-context.runtime';
import { runWithLogSink } from '../../lib/logger';

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
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 7, resetAt: 1, count: 1 }));
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
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 98, resetAt: 1, count: 1 }));
    const handler = createApiHandler({ ...options, audit: vi.fn(), checkRateLimit });
    const response = await handler.fetch(new Request('https://example.com/api/health'), { clientIp: null, secure: true });
    expect(checkRateLimit).toHaveBeenCalledWith('unknown');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('98');
  });

  it('meters a call with the forwarded IP under that client subject', async () => {
    const checkRateLimit = vi.fn(() => ({ allowed: true, remaining: 98, resetAt: 1, count: 1 }));
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

describe('rejected requests are recorded once per window', () => {
  // Every rejection still answers 429 with the same headers and still counts;
  // only the first rejection in a window per subject is written.
  it('writes one audit row and its log rows for three rejections, and one more in a new window', async () => {
    const start = Date.parse('2026-06-01T12:00:00.000Z');
    vi.useFakeTimers({ now: start });
    const audit = vi.fn();
    const events: string[] = [];
    const handler = createApiHandler({ ...options, audit });
    const peer = { clientIp: '203.0.113.70' };
    const health = () => new Request('https://example.com/api/health');
    const rejectedAudits = () => audit.mock.calls.filter(([event]) => (event as { metadata?: { rateLimited?: boolean } }).metadata?.rateLimited).length;
    try {
      await runWithLogSink(entry => { events.push(entry.event); }, async () => {
        for (let window = 0; window < 2; window++) {
          vi.setSystemTime(start + window * RATE_LIMIT_WINDOW_MS);
          for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index++) await handler.fetch(health(), peer);
          const before = events.length;
          const rejected = [];
          for (let index = 0; index < 3; index++) rejected.push(await handler.fetch(health(), peer));
          expect(rejected.map(response => response.status)).toEqual([429, 429, 429]);
          for (const response of rejected) {
            expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(response.headers.get('Retry-After')).toBe('60');
          }
          expect(rejectedAudits()).toBe(window + 1);
          expect(events.slice(before)).toEqual(['api.rate_limit_exceeded', 'api.request_completed']);
        }
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
