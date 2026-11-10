import { describe, expect, it, vi } from 'vitest';
import * as pseudonymize from '../../lib/security/pseudonymize';
import { createApiHandler } from '../../lib/api/handler';

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
