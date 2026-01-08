import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      ...configDefaults.exclude,
      'tests/app/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.*',
        '**/*.d.ts',
        '.next/',
        'playwright.config.ts',
        'app/**',
        'docs/**',
        'scripts/**',
        'components/charts/**',
        'components/seo/**',
        'components/loading-state.tsx',
        'components/stats-card.tsx',
        'components/theme-toggle.tsx',
        'lib/seo/**',
        'lib/api/caixa-client.ts',
        'proxy.ts',
        'server.ts',
        'lib/analytics/complexity-score.ts',
        'lib/analytics/decade-analysis.ts',
        'lib/analytics/delay-analysis.ts',
        'lib/analytics/pair-analysis.ts',
        'lib/analytics/parity-analysis.ts',
        'lib/analytics/prime-analysis.ts',
        'lib/analytics/prize-correlation.ts',
        'lib/analytics/streak-analysis.ts',
        'lib/analytics/sum-analysis.ts',
        'lib/analytics/time-series.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
