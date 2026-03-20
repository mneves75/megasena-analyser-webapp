import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders } from '@/lib/security/csp';

describe('buildCsp', () => {
  it('mantém o caminho compatível com App Router em produção', () => {
    const csp = buildCsp({ isDev: false });

    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toMatch(/connect-src[^;]*servicebus2\.caixa\.gov\.br/);
  });

  it('allows dev conveniences (unsafe-eval/inline) in development', () => {
    const csp = buildCsp({ isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'unsafe-inline'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(csp).toContain('ws://localhost:*');
  });

  it('includes frame-src none to block external iframes', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("frame-src 'none'");
  });

  it('includes worker-src self to restrict workers', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("worker-src 'self'");
  });

  it('includes manifest-src self for PWA security', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("manifest-src 'self'");
  });

  it('includes base-uri self to prevent base tag injection', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("base-uri 'self'");
  });

  it('includes form-action self to prevent form hijacking', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("form-action 'self'");
  });

  it('includes frame-ancestors none to prevent clickjacking', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows Google Fonts in style-src', () => {
    const csp = buildCsp({ isDev: false });
    expect(csp).toContain('https://fonts.googleapis.com');
  });

  it('allows Google Fonts in font-src', () => {
    const csp = buildCsp({ isDev: false });
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
