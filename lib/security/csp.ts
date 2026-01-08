const CAIXA_API_ORIGIN = 'https://servicebus2.caixa.gov.br';

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  isSecure?: boolean;
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

export function buildCsp({ nonce, isDev, isSecure = true }: CspOptions): string {
  // Build CSP following 2025 best practices (OWASP, MDN, CSP Level 3)
  // See: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
  const directives = [
    // Fetch directives - control where resources can be loaded from
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com${isDev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' ${CAIXA_API_ORIGIN}${
      isDev ? ' http://localhost:* https://localhost:* ws://localhost:*' : ''
    }`,
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",

    // Document directives
    "base-uri 'self'",
    "form-action 'self'",

    // Navigation directives
    "frame-ancestors 'none'",

    // Only upgrade to HTTPS when actually served over HTTPS
    !isDev && isSecure ? 'upgrade-insecure-requests' : null,
  ].filter(Boolean);

  return directives.join('; ');
}

export function buildSecurityHeaders(csp: string, isDev: boolean, isSecure = true): Record<string, string> {
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

  if (!isDev && isSecure) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

export function isDevelopment(): boolean {
  return process.env['NODE_ENV'] === 'development';
}
