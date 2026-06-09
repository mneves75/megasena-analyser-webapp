import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy', () => {
  it('aplica CSP com nonce por request sem expor x-nonce como header público', () => {
    const request = new NextRequest('https://megasena-analyzer.com.br/dashboard');

    const response = proxy(request);

    const csp = response.headers.get('content-security-policy');
    const requestNonce = response.headers.get('x-middleware-request-x-nonce');
    const scriptSrc = csp?.split('; ').find((directive) => directive.startsWith('script-src'));
    const styleSrc = csp?.split('; ').find((directive) => directive.startsWith('style-src'));

    expect(requestNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(scriptSrc).toBe(`script-src 'self' 'nonce-${requestNonce}' 'strict-dynamic'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(styleSrc).toBe(`style-src 'self' 'nonce-${requestNonce}' https://fonts.googleapis.com`);
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(response.headers.get('strict-transport-security')).toBeNull();
    expect(response.headers.get('x-nonce')).toBeNull();
  });

  it('não emite diretivas dependentes de transporte no middleware do Next', () => {
    const request = new NextRequest('https://megasena-analyzer.com.br/dashboard');

    const response = proxy(request);
    const csp = response.headers.get('content-security-policy');

    expect(response.headers.get('strict-transport-security')).toBeNull();
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('não força HSTS em contexto não seguro', () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = proxy(request);

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });

  it('ignora x-forwarded-proto spoofado em contexto não seguro', () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        'x-forwarded-proto': 'https',
      },
    });

    const response = proxy(request);
    const csp = response.headers.get('content-security-policy');

    expect(response.headers.get('strict-transport-security')).toBeNull();
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
