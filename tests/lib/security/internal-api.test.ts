import { describe, expect, it } from 'vitest';
import { isInternalApiRequest, isRateLimitExempt } from '@/lib/security/internal-api';

const SECRET = ['internal', 'test', 'shared', 'value', 'not', 'real', '0001'].join('-');

function requestWithHeaders(secret = SECRET): Request {
  return new Request('http://localhost/api/dashboard', {
    headers: {
      'X-Megasena-Internal-Request': '1',
      'X-Megasena-Internal-Request-Secret': secret,
    },
  });
}

describe('isInternalApiRequest', () => {
  it('accepts a valid internal marker only from loopback with the shared secret', () => {
    expect(isInternalApiRequest(requestWithHeaders(), '127.0.0.1', SECRET)).toBe(true);
    expect(isInternalApiRequest(requestWithHeaders(), '::ffff:127.0.0.1', SECRET)).toBe(true);
  });

  it('rejects public peers even when the shared secret matches', () => {
    expect(isInternalApiRequest(requestWithHeaders(), '203.0.113.10', SECRET)).toBe(false);
  });

  it('rejects missing or wrong shared secrets', () => {
    expect(isInternalApiRequest(requestWithHeaders('wrong'), '127.0.0.1', SECRET)).toBe(false);
    expect(isInternalApiRequest(requestWithHeaders(), '127.0.0.1', '')).toBe(false);
  });
});

describe('isRateLimitExempt', () => {
  const apiRequest = (headers: Record<string, string> = {}) =>
    new Request('http://127.0.0.1:3201/api/generate-bets', { headers });

  it('never exempts a request that is not a verified internal call', () => {
    expect(isRateLimitExempt(apiRequest(), false, true)).toBe(false);
  });

  it('exempts a verified internal call that carries no client IP header', () => {
    expect(isRateLimitExempt(apiRequest(), true, true)).toBe(true);
  });

  it('charges a verified internal call to the visitor it forwards', () => {
    expect(isRateLimitExempt(apiRequest({ 'x-real-ip': '198.51.100.25' }), true, true)).toBe(false);
  });

  it('does not exempt a forwarded address that merely names loopback or is not an IP', () => {
    // The exemption must hinge on whether a visitor address was sent, not on what
    // it resolved to: a spoofed loopback value (or garbage that falls back to the
    // loopback peer) would otherwise make the generator server action unmetered.
    expect(isRateLimitExempt(apiRequest({ 'cf-connecting-ip': '127.0.0.1' }), true, true)).toBe(false);
    expect(isRateLimitExempt(apiRequest({ 'x-forwarded-for': '::1' }), true, true)).toBe(false);
    expect(isRateLimitExempt(apiRequest({ 'x-real-ip': 'not-an-ip' }), true, true)).toBe(false);
  });

  it('keeps the exemption when proxy headers are not trusted, since no caller is identifiable', () => {
    expect(isRateLimitExempt(apiRequest({ 'x-real-ip': '198.51.100.25' }), true, false)).toBe(true);
  });
});
