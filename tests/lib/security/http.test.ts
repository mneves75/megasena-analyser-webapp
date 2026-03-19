import { describe, expect, it, vi } from 'vitest';
import {
  RequestBodyTooLargeError,
  readJsonBodyWithLimit,
  resolveClientIp,
  type RequestIpResolver,
} from '@/lib/security/http';

describe('resolveClientIp', () => {
  const server: RequestIpResolver = {
    requestIP: vi.fn(() => ({ address: '203.0.113.10', family: 'IPv4', port: 443 })),
  };

  it('defaults to the socket address when proxy headers are not trusted', () => {
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.25',
      },
    });

    expect(resolveClientIp(req, server, false)).toBe('203.0.113.10');
  });

  it('uses the forwarded chain when proxy headers are explicitly trusted', () => {
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.25, 203.0.113.5',
      },
    });

    expect(resolveClientIp(req, server, true)).toBe('198.51.100.25');
  });
});

describe('readJsonBodyWithLimit', () => {
  it('parses JSON bodies within the declared limit', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: 42 }),
    });

    await expect(readJsonBodyWithLimit<{ budget: number }>(req, 1024)).resolves.toEqual({ budget: 42 });
  });

  it('rejects bodies that exceed the actual byte limit', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'x'.repeat(2048) }),
    });

    await expect(readJsonBodyWithLimit(req, 128)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
