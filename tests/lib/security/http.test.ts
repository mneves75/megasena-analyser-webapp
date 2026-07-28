import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isJsonContentType,
  isSecureRequest,
  RequestBodyTooLargeError,
  readJsonBodyWithLimit,
  resolveClientIp,
  type RequestIpResolver,
} from '@/lib/security/http';

describe('resolveClientIp', () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_IPS;
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
  });

  function serverWithAddress(address: string): RequestIpResolver {
    return {
      requestIP: vi.fn(() => ({ address, family: 'IPv4', port: 443 })),
    };
  }

  it('defaults to the socket address when proxy headers are not trusted', () => {
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.25',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('203.0.113.10'), false)).toBe('203.0.113.10');
  });

  it('uses the forwarded chain only when proxy headers are enabled and the peer is explicitly trusted', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.25, 203.0.113.5',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('198.51.100.25');
  });

  it('prefers proxy-overwritten client IP headers over potentially appended x-forwarded-for', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.200, 203.0.113.5',
        'x-real-ip': '198.51.100.30',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('198.51.100.30');
  });

  it('consults only TRUSTED_CLIENT_IP_HEADER when it pins a single header', () => {
    // An origin reachable outside Cloudflare must be able to ignore the
    // client-settable cf-connecting-ip and trust only the header its own proxy
    // rewrites, otherwise each forged value mints a fresh rate-limit bucket.
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';

    const req = new Request('http://localhost/api', {
      headers: {
        'cf-connecting-ip': '198.51.100.99',
        'x-real-ip': '198.51.100.30',
        'x-forwarded-for': '198.51.100.200, 203.0.113.5',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('198.51.100.30');
  });

  it('falls back to the socket peer when the pinned header is absent', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    process.env.TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';

    const req = new Request('http://localhost/api', {
      headers: { 'cf-connecting-ip': '198.51.100.99' },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('172.18.0.10');
  });

  it('prefers cf-connecting-ip over x-forwarded-for when both are present from a trusted peer', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    const req = new Request('http://localhost/api', {
      headers: {
        'cf-connecting-ip': '198.51.100.40',
        'x-forwarded-for': '198.51.100.200, 203.0.113.5',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('198.51.100.40');
  });

  it('ignores forwarded headers from public socket peers even when proxy trust is enabled', () => {
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': '198.51.100.25',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('203.0.113.10'), true)).toBe('203.0.113.10');
  });

  it('trusts forwarded headers from IPv4-mapped loopback peers', () => {
    const req = new Request('http://localhost/api', {
      headers: {
        'x-real-ip': '198.51.100.25',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('::ffff:127.0.0.1'), true)).toBe('198.51.100.25');
  });

  it('ignores malformed forwarded IPs even from trusted peers', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    const req = new Request('http://localhost/api', {
      headers: {
        'x-forwarded-for': 'not-an-ip, 198.51.100.25',
        'x-real-ip': '198.51.100.30',
      },
    });

    expect(resolveClientIp(req, serverWithAddress('172.18.0.10'), true)).toBe('198.51.100.30');
  });
});

describe('isSecureRequest', () => {
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_IPS;
  });

  function serverWithAddress(address: string): RequestIpResolver {
    return {
      requestIP: vi.fn(() => ({ address, family: 'IPv4', port: 443 })),
    };
  }

  it('treats HTTPS URLs as secure without forwarded headers', () => {
    const req = new Request('https://example.com/api');
    const url = new URL(req.url);

    expect(isSecureRequest(req, url, serverWithAddress('203.0.113.10'), false)).toBe(true);
  });

  it('ignores spoofed forwarded proto from untrusted peers', () => {
    const req = new Request('http://example.com/api', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const url = new URL(req.url);

    expect(isSecureRequest(req, url, serverWithAddress('203.0.113.10'), true)).toBe(false);
  });

  it('trusts forwarded proto only from trusted peers when proxy trust is enabled', () => {
    process.env.TRUSTED_PROXY_IPS = '172.18.0.10';
    const req = new Request('http://example.com/api', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });
    const url = new URL(req.url);

    expect(isSecureRequest(req, url, serverWithAddress('172.18.0.10'), true)).toBe(true);
  });
});

describe('isJsonContentType', () => {
  it('accepts application/json with optional parameters', () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    expect(isJsonContentType(req)).toBe(true);
  });

  it('accepts structured JSON media types', () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.megasena+json' },
    });

    expect(isJsonContentType(req)).toBe(true);
  });

  it('rejects missing or simple non-JSON content types', () => {
    expect(isJsonContentType(new Request('http://localhost/api', { method: 'POST' }))).toBe(false);
    expect(
      isJsonContentType(
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    ).toBe(false);
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
