import { describe, expect, it } from 'vitest';
import { buildCsp, buildSecurityHeaders } from '@/lib/security/csp';

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
});

describe('buildSecurityHeaders', () => {
  it('adds HSTS only in production', () => {
    const prodHeaders = buildSecurityHeaders('csp', false);
    expect(prodHeaders['Strict-Transport-Security']).toBeDefined();

    const devHeaders = buildSecurityHeaders('csp', true);
    expect(devHeaders['Strict-Transport-Security']).toBeUndefined();
  });

  it('includes cross-origin isolation headers', () => {
    const headers = buildSecurityHeaders('csp', false);
    expect(headers['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });
});
