import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/app',
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run build && bun run start',
    url: 'http://localhost:3000',
    timeout: 240000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
