import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/app',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env['CI'],
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
