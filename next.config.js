const isDevelopment = process.env.NODE_ENV === 'development';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // In development, allow unsafe-eval for React Refresh/HMR
      isDevelopment
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com data:",
      isDevelopment
        ? "connect-src 'self' https://servicebus2.caixa.gov.br ws://localhost:* http://localhost:*"
        : "connect-src 'self' https://servicebus2.caixa.gov.br",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      isDevelopment ? '' : 'upgrade-insecure-requests',
    ].filter(Boolean).join('; '),
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=(), payment=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/megasena-analyzer',
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async rewrites() {
    // Use environment variables for API host/port to support Docker and distributed deployments
    // Falls back to localhost:3201 for local development
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '3201';

    return [
      {
        source: '/api/:path*',
        destination: `http://${apiHost}:${apiPort}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
