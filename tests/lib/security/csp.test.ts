import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders, generateNonce } from '@/lib/security/csp';

describe('generateNonce', () => {
  it('generates unique nonces on each call', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it('generates base64-encoded string', () => {
    const nonce = generateNonce();
    // Base64 alphabet: A-Z, a-z, 0-9, +, /, =
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('generates nonce with sufficient entropy (>= 22 chars base64 = 128+ bits)', () => {
    const nonce = generateNonce();
    // UUID v4 is 122 bits, base64 encoded = ~48 chars (with dashes)
    expect(nonce.length).toBeGreaterThanOrEqual(22);
  });
});

describe('buildCsp', () => {
  it('creates strict policy without unsafe inline in production', () => {
    const nonce = 'testnonce';
    const csp = buildCsp({ nonce, isDev: false });

    expect(csp).toContain(`nonce-${nonce}`);
    expect(csp).toContain("script-src 'self' 'nonce-testnonce' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toMatch(/connect-src[^;]*servicebus2\.caixa\.gov\.br/);
  });

  it('allows dev conveniences (unsafe-eval/inline) in development', () => {
    const csp = buildCsp({ nonce: 'devnonce', isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(csp).toContain('ws://localhost:*');
  });

  it('includes frame-src none to block external iframes', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("frame-src 'none'");
  });

  it('includes worker-src self to restrict workers', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("worker-src 'self'");
  });

  it('includes manifest-src self for PWA security', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("manifest-src 'self'");
  });

  it('includes base-uri self to prevent base tag injection', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("base-uri 'self'");
  });

  it('includes form-action self to prevent form hijacking', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("form-action 'self'");
  });

  it('includes frame-ancestors none to prevent clickjacking', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows Google Fonts in style-src', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain('https://fonts.googleapis.com');
  });

  it('allows Google Fonts in font-src', () => {
    const csp = buildCsp({ nonce: 'test', isDev: false });
    expect(csp).toContain('https://fonts.gstatic.com');
  });
});

describe('buildSecurityHeaders', () => {
  it('adds HSTS only in production', () => {
    const prodHeaders = buildSecurityHeaders('csp', false);
    expect(prodHeaders['Strict-Transport-Security']).toBeDefined();

    const devHeaders = buildSecurityHeaders('csp', true);
    expect(devHeaders['Strict-Transport-Security']).toBeUndefined();
  });

  it('includes HSTS with preload directive', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['Strict-Transport-Security']).toContain('preload');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('includes cross-origin isolation headers', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });

  it('includes X-Content-Type-Options nosniff', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('includes X-Frame-Options DENY', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['X-Frame-Options']).toBe('DENY');
  });

  it('includes restrictive Permissions-Policy', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['Permissions-Policy']).toContain('geolocation=()');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['Permissions-Policy']).toContain('microphone=()');
  });

  it('includes Referrer-Policy', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
