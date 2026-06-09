import { defineConfig } from '@playwright/test';
import path from 'node:path';

const port = process.env['PORT'] ?? '3000';
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? `http://localhost:${port}`;
const databasePath =
  process.env['DATABASE_PATH'] ?? path.join(process.cwd(), '.tmp', 'e2e', 'mega-sena.db');

export default defineConfig({
  testDir: './tests/app',
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bun run scripts/prepare-e2e-db.ts && bun run build && bun run start',
    url: baseURL,
    timeout: 240000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
      NEXT_TELEMETRY_DISABLED: '1',
      TRUST_PROXY_HEADERS: 'true',
      // E2E runs `bun run start` in NODE_ENV=production. server.ts is fail-closed
      // without IP_HASH_SECRET; this opt-in lets it generate an ephemeral secret
      // per process. Never enable this in real deployments.
      IP_HASH_SECRET_AUTOGENERATE: 'true',
    },
  },
});
