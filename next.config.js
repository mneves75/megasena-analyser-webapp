const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "connect-src 'self' https://servicebus2.caixa.gov.br",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; '),
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
