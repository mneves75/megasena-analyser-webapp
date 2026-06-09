/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Ensure Turbopack/Next build uses this repo as the workspace root.
  // Prevents accidental inference from unrelated lockfiles elsewhere on disk.
  turbopack: {
    root: __dirname,
  },

  // Enable standalone output for Docker deployment
  // Creates a self-contained build with minimal dependencies
  output: 'standalone',

  // Prevent Next output tracing from copying local SQLite runtime state into
  // `.next/standalone`. Docker/deploy paths copy migrations explicitly and
  // mount the real database at runtime.
  outputFileTracingExcludes: {
    '/*': [
      './db/**/*.db',
      './db/**/*.db-shm',
      './db/**/*.db-wal',
      './db/**/*.sqlite',
      './db/**/*.sqlite-shm',
      './db/**/*.sqlite-wal',
      './db/**/*.bak',
      './db/**/*.backup',
      './db/backups/**/*',
    ],
  },

  async rewrites() {
    // Use environment variables for API host/port to support Docker and distributed deployments
    // Falls back to localhost:3201 for local development
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '3201';
    const apiBaseUrl = normalizeApiBaseUrl(apiHost, apiPort);

    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },
};

function normalizeApiBaseUrl(host, port) {
  const hasScheme = /^https?:\/\//i.test(host);
  const url = new URL(hasScheme ? host : `http://${host}`);
  if (!url.port) {
    url.port = port;
  }
  return url.origin;
}

module.exports = nextConfig;
