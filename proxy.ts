import { NextRequest, NextResponse } from 'next/server';
import { buildCsp, buildSecurityHeaders, generateNonce, isDevelopment } from './lib/security/csp';

export function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = isDevelopment();
  const csp = buildCsp({ nonce, isDev });

  // Propagate nonce to request so Next can attach it to scripts/styles during render
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const securityHeaders = buildSecurityHeaders(csp, isDev);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    {
      // Skip static assets, API routes, and well-known files
      // Prefetch requests are also excluded to avoid duplicate nonce generation
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
