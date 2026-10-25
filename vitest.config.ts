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
      // Ratchet at the measured baseline; the target is 80%. The gate had once
      // silently measured 0/0: an `app/**` exclude matched every path because the
      // checkout folder ends in "...webapp/". `include` already limits coverage to
      // components/ and lib/, so app/ needs no exclude. Raised on 2026-10-24 from
      // the measured 76.55 / 73.05 / 75.05 / 76.9, keeping a small buffer below it.
      thresholds: {
        lines: 75,
        functions: 73,
        branches: 71,
        statements: 75,
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
        'components/seo/**',
        'components/loading-state.tsx',
        'components/theme-toggle.tsx',
        'lib/seo/**',
        'lib/api/caixa-client.ts',
        'proxy.ts',
        'server.ts',
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
      '@': path.resolve(import.meta.dirname, './'),
    },
  },
});
