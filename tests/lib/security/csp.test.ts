import { describe, expect, it } from 'vitest';
import { buildApiSecurityHeaders, buildCsp, buildSecurityHeaders } from '@/lib/security/csp';

describe('buildCsp', () => {
  it('usa nonce e strict-dynamic em produção sem unsafe-inline em script-src', () => {
    const csp = buildCsp({ isDev: false, nonce: 'abc123' });

    const scriptSrc = csp.split('; ').find((directive) => directive.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // script-src-elem replaces script-src for <script> elements with no
    // fallback, so it must carry 'strict-dynamic' too. Without it the bare
    // 'self' would admit any same-origin script element with no nonce.
    const scriptSrcElem = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src-elem'));
    expect(scriptSrcElem).toBe("script-src-elem 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toMatch(/connect-src[^;]*servicebus2\.caixa\.gov\.br/);
  });

  it('usa nonce em style-src de produção sem unsafe-inline', () => {
    const csp = buildCsp({ isDev: false, nonce: 'abc123' });
    const styleSrc = csp.split('; ').find((directive) => directive.startsWith('style-src'));

    expect(styleSrc).toBe("style-src 'self' 'nonce-abc123' https://fonts.googleapis.com");
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
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

describe('buildApiSecurityHeaders', () => {
  it('adds a deny-by-default CSP for JSON API responses', () => {
    const headers = buildApiSecurityHeaders(false);

    expect(headers['Content-Security-Policy']).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
  });

  it('marks API responses as non-cacheable so the CDN cannot serve stale JSON', () => {
    expect(buildApiSecurityHeaders(false)['Cache-Control']).toBe('no-store');
    expect(buildApiSecurityHeaders(true)['Cache-Control']).toBe('no-store');
  });

  it('adds HSTS to API responses only when served securely in production', () => {
    expect(buildApiSecurityHeaders(false, true)['Strict-Transport-Security']).toContain('preload');
    expect(buildApiSecurityHeaders(false, false)['Strict-Transport-Security']).toBeUndefined();
    expect(buildApiSecurityHeaders(true, true)['Strict-Transport-Security']).toBeUndefined();
  });
});
