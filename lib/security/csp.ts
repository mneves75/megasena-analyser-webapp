const CAIXA_API_ORIGIN = 'https://servicebus2.caixa.gov.br';

export interface CspOptions {
  isDev: boolean;
  nonce?: string;
  isSecure?: boolean;
}

export function buildCsp({ isDev, nonce, isSecure = true }: CspOptions): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ''}`;
  const styleSrc = isDev
    ? "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
    : `style-src 'self'${nonce ? ` 'nonce-${nonce}'` : ''} https://fonts.googleapis.com`;

  const directives = [
    // Fetch directives - control where resources can be loaded from
    "default-src 'self'",
    scriptSrc,
    // CSP3: when script-src-elem is present it fully replaces script-src for
    // <script> elements, with no fallback. Without 'strict-dynamic' here the
    // bare 'self' would be honoured, letting any same-origin script element load
    // with no nonce — strictly weaker than the script-src above. Repeating
    // 'strict-dynamic' makes 'self' inert and keeps one effective policy.
    !isDev && nonce ? `script-src-elem 'self' 'nonce-${nonce}' 'strict-dynamic'` : null,
    styleSrc,
    !isDev ? "style-src-attr 'unsafe-inline'" : null,
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

export function buildApiSecurityHeaders(isDev: boolean, isSecure = true): Record<string, string> {
  const headers: Record<string, string> = {
    // Dynamic JSON; never store in a shared/CDN cache. Prevents the edge from
    // serving a stale /api/health (and other endpoints) across deploys.
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()',
    'Referrer-Policy': 'no-referrer',
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
