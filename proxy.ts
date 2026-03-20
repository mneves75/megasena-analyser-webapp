import { NextRequest, NextResponse } from 'next/server';
import { buildCsp, buildSecurityHeaders, isDevelopment } from './lib/security/csp';

export function proxy(request: NextRequest): NextResponse {
  const isDev = isDevelopment();
  const isSecure = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https');
  const csp = buildCsp({ isDev, isSecure });
  const response = NextResponse.next();

  const securityHeaders = buildSecurityHeaders(csp, isDev, isSecure);
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
