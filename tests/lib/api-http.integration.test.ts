// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Test-owned runtime adapter: real SQLite executes the same migrations and analytics SQL.
// Production adapters remain covered separately by Bun and workerd runtime gates.
vi.mock('../../lib/db', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  let sqlite: InstanceType<typeof DatabaseSync> | undefined;
  return {
    getDatabase: () => { sqlite ??= new DatabaseSync(':memory:'); return sqlite; },
    closeDatabase: () => { sqlite?.close(); sqlite = undefined; },
  };
});
import { createApiHandler } from '../../lib/api/handler';
import { closeDatabase, getDatabase } from '../../lib/db';
import { StatisticsEngine } from '../../lib/analytics/statistics';
import { createAuditWriter } from '../../lib/audit';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  closeDatabase();
  const db = getDatabase();
  for (const migration of readdirSync('db/migrations').filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(`db/migrations/${migration}`, 'utf8'));
  }
  for (const [contest, date, numbers] of [
    [1, '2025-01-01', [1, 2, 3, 4, 5, 6]],
    [2, '2025-01-08', [1, 7, 8, 9, 10, 11]],
  ] as const) {
    db.prepare(`INSERT INTO draws (contest_number, draw_date, number_1, number_2,
      number_3, number_4, number_5, number_6, prize_sena, winners_sena)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`).run(contest, date, ...numbers);
  }
  new StatisticsEngine().updateNumberFrequencies();
  const audit = createAuditWriter({ automaticFlush: false });
  const handler = createApiHandler({ environment: 'production', appVersion: 'http-fixture',
    ipHashSecret: 'public-http-integration-test-only-secret-0123456789',
    allowedOrigins: 'https://example.com',
    audit: async event => { audit.enqueue(event); await audit.stop(); },
  });
  server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (typeof value === 'string') headers.set(key, value);
      }
      const response = await handler.fetch(new Request(`${baseUrl}${incoming.url}`, {
        method: incoming.method ?? 'GET', headers,
        ...(body.length ? { body } : {}),
      }), { clientIp: incoming.socket.remoteAddress ?? null });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500);
      outgoing.end(String(error));
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture listener');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
  closeDatabase();
});

async function get(route: string) {
  const response = await fetch(`${baseUrl}${route}`);
  const payload: unknown = await response.json();
  expect(response.status, JSON.stringify(payload)).toBe(200);
  expect(response.headers.get('X-Request-Id')).toBeTruthy();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  return payload;
}

describe('public API over a real HTTP listener', () => {
  it('serves draw-backed health, dashboard and statistics with their public contracts', async () => {
    expect(await get('/api/health')).toMatchObject({ status: 'healthy', version: 'http-fixture', database: { totalDraws: 2 } });
    expect(await get('/api/dashboard')).toMatchObject({ statistics: { totalDraws: 2 }, recentDraws: expect.any(Array), hotNumbers: expect.any(Array) });
    expect(await get('/api/statistics')).toMatchObject({ summary: { totalDraws: 2 }, frequencies: expect.any(Array), patterns: expect.any(Object) });
    expect(await get('/api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true')).toMatchObject({
      delays: expect.any(Array), delayDistribution: expect.any(Array),
      decades: expect.any(Array), pairs: expect.any(Array), parity: expect.any(Array), primes: expect.any(Object),
      sumStats: expect.any(Object), hotNumbers: expect.any(Array), coldNumbers: expect.any(Array),
      luckyNumbers: expect.any(Array), unluckyNumbers: expect.any(Array),
    });
  });

  it('preserves caller number order across cached trend requests', async () => {
    expect(await get('/api/trends?numbers=7,1&period=yearly')).toMatchObject({ numbers: [7, 1], period: 'yearly', data: expect.any(Array) });
    expect(await get('/api/trends?numbers=1,7&period=yearly')).toMatchObject({ numbers: [1, 7], period: 'yearly' });
  });

  it('serves the public archive, number profiles and sitemap', async () => {
    expect(await get('/api/draws')).toMatchObject({ archive: { totalDraws: 2 }, recent: expect.any(Array), years: expect.any(Array) });
    expect(await get('/api/draws?contest=1')).toMatchObject({ draw: { contestNumber: 1, numbers: [1, 2, 3, 4, 5, 6] } });
    expect(await get('/api/draws?year=2025')).toMatchObject({ year: 2025, draws: expect.any(Array) });
    expect(await get('/api/draws?view=mega-da-virada')).toMatchObject({ editions: expect.any(Array) });
    expect(await get('/api/numbers')).toMatchObject({ archive: { totalDraws: 2 }, numbers: expect.any(Array) });
    expect(await get('/api/numbers?n=1')).toMatchObject({ number: 1 });
    expect(await get('/api/sitemap')).toMatchObject({ draws: expect.any(Array), years: expect.any(Array) });
  });

  it('generates budget-bounded bets and records successful persistence', async () => {
    const response = await fetch(`${baseUrl}/api/generate-bets`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ budget: 30, strategy: 'random', mode: 'simple_only' }) });
    expect(response.status).toBe(200);
    const result = await response.json() as { success: boolean; data: { totalCost: number; bets: { numbers: number[] }[] } };
    expect(result.success).toBe(true);
    expect(result.data.totalCost).toBeLessThanOrEqual(30);
    expect(result.data.bets.length).toBeGreaterThan(0);
    for (const bet of result.data.bets) expect(new Set(bet.numbers).size).toBe(6);
    const rows = getDatabase().prepare('SELECT * FROM audit_logs').all() as { event: string; status_code: number }[];
    expect(rows).toContainEqual(expect.objectContaining({ event: 'bets.generate_requested', status_code: 200 }));
  });

  it('rejects invalid methods, input, oversized bodies and hostile origins at HTTP boundaries', async () => {
    for (const route of ['/api/health', '/api/dashboard', '/api/statistics', '/api/trends', '/api/draws', '/api/numbers', '/api/sitemap']) {
      const response = await fetch(`${baseUrl}${route}`, { method: 'POST' });
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toBe('GET');
    }
    for (const route of ['/api/trends', '/api/trends?numbers=61', '/api/trends?numbers=1&period=invalid', '/api/draws?contest=01', '/api/draws?year=2025&contest=1', '/api/numbers?n=61']) {
      expect((await fetch(`${baseUrl}${route}`)).status).toBe(400);
    }
    for (const [contentType, body, status] of [
      ['text/plain', '{}', 415], ['application/json', '{broken', 400],
      ['application/json', JSON.stringify({ budget: -1 }), 400],
      ['application/json', JSON.stringify({ budget: 20001, mode: 'optimized' }), 400],
      ['application/json', JSON.stringify({ padding: 'a'.repeat(11000) }), 413],
    ] as const) {
      expect((await fetch(`${baseUrl}/api/generate-bets`, { method: 'POST', headers: { 'Content-Type': contentType }, body })).status).toBe(status);
    }
    const preflight = await fetch(`${baseUrl}/api/statistics`, { method: 'OPTIONS', headers: { origin: 'https://example.com' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(preflight.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    const hostile = await fetch(`${baseUrl}/api/health`, { headers: { origin: 'https://hostile.example' } });
    expect(hostile.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
