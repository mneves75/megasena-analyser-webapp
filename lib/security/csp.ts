import { env } from 'process';

const CAIXA_API_ORIGIN = 'https://servicebus2.caixa.gov.br';

export interface CspOptions {
  nonce: string;
  isDev: boolean;
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

export function buildCsp({ nonce, isDev }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com${isDev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' ${CAIXA_API_ORIGIN}${
      isDev ? ' http://localhost:* https://localhost:* ws://localhost:*' : ''
    }`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    isDev ? null : 'upgrade-insecure-requests',
  ].filter(Boolean);

  return directives.join('; ');
}

export function buildSecurityHeaders(csp: string, isDev: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': csp,
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-DNS-Prefetch-Control': 'off',
  };

  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}
