import { describe, expect, it } from 'vitest';
import { isInternalApiRequest } from '@/lib/security/internal-api';

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
