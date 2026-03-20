import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('proxy', () => {
  it('aplica headers de segurança sem propagar nonce morto', () => {
    const request = new NextRequest('https://megasena-analyzer.com.br/dashboard');

    const response = proxy(request);

    expect(response.headers.get('content-security-policy')).toContain("script-src 'self' 'unsafe-inline'");
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(response.headers.get('x-nonce')).toBeNull();
  });

  it('não força HSTS em contexto não seguro', () => {
    const request = new NextRequest('http://localhost:3000/dashboard');

    const response = proxy(request);

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});
