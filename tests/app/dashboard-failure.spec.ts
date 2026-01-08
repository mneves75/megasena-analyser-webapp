import { test, expect } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const SERVER_PORT = '3001';
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let devServer: ChildProcessWithoutNullStreams | null = null;

async function waitForServerReady(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms: ${url}`);
}

test.beforeAll(async () => {
  devServer = spawn('bun', ['--bun', 'next', 'dev', '-p', SERVER_PORT], {
    env: {
      ...process.env,
      PORT: SERVER_PORT,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'ignore',
  });

  await waitForServerReady(`${SERVER_URL}/`, 90000);
});

test.afterAll(async () => {
  if (!devServer) {
    return;
  }
  devServer.kill('SIGTERM');

  await new Promise((resolve) => setTimeout(resolve, 2000));
  if (!devServer.killed) {
    devServer.kill('SIGKILL');
  }
});

test('dashboard shows error UI when API is unavailable', async ({ page }) => {
  await page.goto(`${SERVER_URL}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Algo deu errado' })).toBeVisible();
  await expect(page.getByText('Tentar novamente')).toBeVisible();
});
