import nextConfig from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'dist/**', 'coverage/**'],
  },
];

export default eslintConfig;
