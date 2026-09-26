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
      include: [
        'components/**/*.tsx',
        'lib/**/*.ts',
      ],
      reporter: ['text', 'json', 'html'],
      // Ratchet at the measured baseline (2026-09-25); the target is 80%. Until
      // then the gate had silently measured 0/0: an `app/**` exclude matched
      // every path because the checkout folder ends in "...webapp/". `include`
      // already limits coverage to components/ and lib/, so app/ needs no exclude.
      thresholds: {
        lines: 71,
        functions: 72,
        branches: 67,
        statements: 71,
      },
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.*',
        '**/*.d.ts',
        '.next/',
        'playwright.config.ts',
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
        // Results archive (SQL read model + API contract) is exercised end to end,
        // through the Bun API and the pages, by tests/app/seo.spec.ts.
        'lib/analytics/draw-archive.ts',
        'lib/api/archive-contract.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
