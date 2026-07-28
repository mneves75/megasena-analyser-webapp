import { expect, request, test } from '@playwright/test';

test('production pages expose strict CSP headers without browser CSP violations', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto('/');
  expect(response).not.toBeNull();

  const csp = response?.headers()['content-security-policy'];
  expect(csp).toBeDefined();

  const scriptSrc = csp?.split('; ').find((directive) => directive.startsWith('script-src'));
  const styleSrc = csp?.split('; ').find((directive) => directive.startsWith('style-src'));
  const scriptNonce = scriptSrc?.match(/'nonce-([^']+)'/)?.[1];
  const styleNonce = styleSrc?.match(/'nonce-([^']+)'/)?.[1];

  expect(scriptNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  expect(styleNonce).toBe(scriptNonce);
  expect(scriptSrc).toContain("'strict-dynamic'");
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(styleSrc).not.toContain("'unsafe-inline'");

  await expect(page.getByRole('heading', { name: 'Mega-Sena Analyzer', exact: true })).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes('Content Security Policy'))).toEqual([]);
});

test('Next proxy does not trust spoofed forwarded proto for transport headers', async ({ baseURL }) => {
  const web = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      'X-Forwarded-Proto': 'https',
    },
  });

  const response = await web.get('/dashboard');
  expect(response.ok()).toBe(true);

  const headers = response.headers();
  expect(headers['strict-transport-security']).toBeUndefined();
  expect(headers['content-security-policy']).toBeDefined();
  expect(headers['content-security-policy']).not.toContain('upgrade-insecure-requests');

  await web.dispose();
});

test('Bun API responses expose defensive headers and minimal CORS surface', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
    },
  });

  const response = await api.get('/api/health');
  expect(response.ok()).toBe(true);

  const headers = response.headers();
  expect(headers['content-security-policy']).toBe(
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  );
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['access-control-allow-origin']).toBe('https://megasena-analyzer.com.br');
  expect(headers['x-ratelimit-limit']).toBe('100');

  const preflight = await api.fetch('/api/generate-bets', {
    method: 'OPTIONS',
  });
  expect(preflight.headers()['access-control-allow-headers']).toBe('Content-Type');

  await api.dispose();
});

test('Bun API rejects unsupported methods before running public handlers', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
    },
  });

  const readEndpoint = await api.post('/api/dashboard');
  expect(readEndpoint.status()).toBe(405);
  expect(readEndpoint.headers()['allow']).toBe('GET');
  await expect(readEndpoint.json()).resolves.toMatchObject({
    success: false,
    error: 'Método não permitido.',
  });

  const writeEndpoint = await api.get('/api/generate-bets');
  expect(writeEndpoint.status()).toBe(405);
  expect(writeEndpoint.headers()['allow']).toBe('POST');

  await api.dispose();
});

test('Bun API rejects non-JSON simple requests on JSON endpoints', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
    },
  });

  const response = await api.fetch('/api/generate-bets', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    data: JSON.stringify({ budget: 6 }),
  });

  expect(response.status()).toBe(415);
  await expect(response.json()).resolves.toMatchObject({
    success: false,
    error: 'Content-Type deve ser application/json.',
  });

  await api.dispose();
});

test('Bun API rejects oversized or out-of-domain trend inputs', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
    },
  });

  const outOfRange = await api.get('/api/trends?numbers=1,2,61&period=yearly');
  expect(outOfRange.status()).toBe(400);
  await expect(outOfRange.json()).resolves.toMatchObject({
    success: false,
    error: 'Informe números válidos entre 1 e 60.',
  });

  const tooManyNumbers = Array.from({ length: 61 }, () => '1').join(',');
  const tooMany = await api.get(`/api/trends?numbers=${tooManyNumbers}&period=yearly`);
  expect(tooMany.status()).toBe(400);

  await api.dispose();
});

test('/api/trends returns 200 and canonicalizes cache keys across permuted inputs', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
    },
  });

  const first = await api.get('/api/trends?numbers=3,1,2&period=yearly');
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.numbers).toEqual([1, 2, 3]);
  expect(firstBody.period).toBe('yearly');

  const second = await api.get('/api/trends?numbers=2,3,1&period=yearly');
  expect(second.status()).toBe(200);
  const secondBody = await second.json();
  expect(secondBody).toEqual(firstBody);

  await api.dispose();
});

test('Bun API rate limits CORS preflight requests', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
      'X-Forwarded-For': '198.51.100.214',
    },
  });

  let lastResponse = await api.fetch('/api/generate-bets', {
    method: 'OPTIONS',
  });

  for (let i = 1; i < 101; i++) {
    lastResponse = await api.fetch('/api/generate-bets', {
      method: 'OPTIONS',
    });
  }

  expect(lastResponse.status()).toBe(429);
  expect(lastResponse.headers()['x-ratelimit-limit']).toBe('100');
  expect(lastResponse.headers()['access-control-allow-origin']).toBe('https://megasena-analyzer.com.br');
  await expect(lastResponse.json()).resolves.toMatchObject({
    error: 'Muitas requisições',
  });

  await api.dispose();
});

test('public API rewrites cannot bypass rate limits with spoofed internal headers', async () => {
  const api = await request.newContext({
    baseURL: `http://127.0.0.1:${process.env.API_PORT ?? '3201'}`,
    extraHTTPHeaders: {
      Origin: 'https://megasena-analyzer.com.br',
      'X-Forwarded-For': '198.51.100.215',
      'X-Megasena-Internal-Request': '1',
    },
  });

  let lastResponse = await api.fetch('/api/generate-bets', {
    method: 'OPTIONS',
  });

  for (let i = 1; i < 101; i++) {
    lastResponse = await api.fetch('/api/generate-bets', {
      method: 'OPTIONS',
    });
  }

  expect(lastResponse.status()).toBe(429);
  expect(lastResponse.headers()['x-ratelimit-limit']).toBe('100');

  await api.dispose();
});
