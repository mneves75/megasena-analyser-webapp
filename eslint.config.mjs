import nextConfig from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '.firecrawl/**',
    ],
  },
];

export default eslintConfig;
