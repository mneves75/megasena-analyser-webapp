import { afterEach, describe, expect, it } from 'vitest';
import { pickClientIpHeaders } from '@/lib/api/forwarded-client-ip';
import { resolveClientIp, type RequestIpResolver } from '@/lib/security/http';

const loopbackPeer: RequestIpResolver = {
  requestIP: () => ({ address: '127.0.0.1', family: 'IPv4', port: 50_000 }),
};

describe('pickClientIpHeaders', () => {
  const originalPinnedHeader = process.env.TRUSTED_CLIENT_IP_HEADER;

  afterEach(() => {
    if (originalPinnedHeader === undefined) {
      delete process.env.TRUSTED_CLIENT_IP_HEADER;
    } else {
      process.env.TRUSTED_CLIENT_IP_HEADER = originalPinnedHeader;
    }
  });

  it('copies only the client IP headers the API trusts, verbatim', () => {
    const incoming = new Headers({
      'cf-connecting-ip': '198.51.100.7',
      'x-real-ip': '198.51.100.8',
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
      cookie: 'session=secret',
      authorization: 'Bearer secret',
    });

    expect(Object.fromEntries(pickClientIpHeaders(incoming))).toEqual({
      'cf-connecting-ip': '198.51.100.7',
      'x-real-ip': '198.51.100.8',
      'x-forwarded-for': '198.51.100.9, 10.0.0.1',
    });
  });

  it('forwards only the pinned header when TRUSTED_CLIENT_IP_HEADER is set', () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = 'X-Real-IP';
    const incoming = new Headers({ 'cf-connecting-ip': '203.0.113.1', 'x-real-ip': '198.51.100.8' });

    expect(Object.fromEntries(pickClientIpHeaders(incoming))).toEqual({ 'x-real-ip': '198.51.100.8' });
  });

  it('gives two visitors distinct API client identities through the loopback hop', () => {
    const forVisitor = (ip: string) =>
      new Request('http://127.0.0.1:3201/api/dashboard', {
        headers: pickClientIpHeaders(new Headers({ 'x-real-ip': ip })),
      });

    expect(resolveClientIp(forVisitor('198.51.100.1'), loopbackPeer, true)).toBe('198.51.100.1');
    expect(resolveClientIp(forVisitor('198.51.100.2'), loopbackPeer, true)).toBe('198.51.100.2');
  });
});
