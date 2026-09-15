import { NextRequest, NextResponse } from 'next/server';
import { buildCsp, buildSecurityHeaders, isDevelopment } from './lib/security/csp';

function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function proxy(request: NextRequest): NextResponse {
  const isDev = isDevelopment();
  // Next standalone may derive request.url from X-Forwarded-Proto before middleware runs.
  // Because middleware cannot validate the socket peer, the app never asserts transport security here.
  const canAssertSecureTransport = false;
  const nonce = generateNonce();
  const csp = buildCsp({ isDev, nonce, isSecure: canAssertSecureTransport });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const securityHeaders = buildSecurityHeaders(csp, isDev, canAssertSecureTransport);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    {
      // Skip static assets, API routes, and well-known files.
      // Router prefetches are RSC payloads, not documents, so they need no CSP.
      // Do NOT also skip `Purpose: prefetch`: that is a full HTML document the
      // browser may display on navigation, and skipping it served it without CSP.
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|\\.well-known).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
