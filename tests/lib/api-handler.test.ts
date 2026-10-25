import { describe, expect, it, vi } from 'vitest';
import { createApiHandler } from '../../lib/api/handler';
import { closeDatabase, getDatabase } from '../../lib/db';
import { BASE_URL } from '../../lib/constants';
import { DrawArchiveEngine } from '../../lib/analytics/draw-archive';
import '../../lib/log-context.runtime';
import { runWithLogSink } from '../../lib/logger';

const options = { environment: 'production', appVersion: 'test',
  ipHashSecret: 'public-api-factory-test-secret-0123456789', audit: vi.fn() };
const request = () => new Request('https://example.com/api/missing', { headers: {
  'x-megasena-internal-request': '1', 'x-megasena-internal-request-secret': options.ipHashSecret,
} });

describe('runtime-neutral API handler', () => {
  it('denies cross-origin access for an explicit empty allowlist while preserving the unset default', async () => {
    const req = () => new Request('https://example.com/api/missing', { headers: { origin: BASE_URL } });
    const closed = await createApiHandler({ ...options, allowedOrigins: '' }).fetch(req());
    expect(closed.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const defaulted = await createApiHandler(options).fetch(req());
    expect(defaulted.headers.get('Access-Control-Allow-Origin')).toBe(BASE_URL);
  });
  it('retains health, method, audit and CORS contracts through the shared entry point', async () => {
    closeDatabase();
    getDatabase();
    const audit = vi.fn();
    const handler = createApiHandler({ ...options, audit, allowedOrigins: 'https://example.com' });
    const health = await handler.fetch(new Request('https://example.com/api/health', {
      headers: { origin: 'https://example.com' },
    }), { clientIp: '203.0.113.3' });
    expect(health.status).toBe(503);
    expect(health.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(health.headers.get('Cache-Control')).toBe('no-store');
    expect(await health.json()).toMatchObject({ status: 'unhealthy', version: 'test', database: { connected: true, totalDraws: 0 } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'api.health_read', statusCode: 503, clientIdHash: expect.stringMatching(/^hmac-sha256:/) }));
    const invalidMethod = await handler.fetch(new Request('https://example.com/api/health', { method: 'POST' }));
    expect(invalidMethod.status).toBe(405);
    expect(invalidMethod.headers.get('Allow')).toBe('GET');
  });
  it('logs the deployment stage, not the fail-closed security environment, on every entry', async () => {
    const previous = process.env['DEPLOYMENT_STAGE'];
    process.env['DEPLOYMENT_STAGE'] = 'staging';
    const stages: (string | undefined)[] = [];
    try {
      await runWithLogSink(entry => { stages.push(entry.launchStage); },
        () => createApiHandler(options).fetch(request(), { clientIp: '203.0.113.9' }));
    } finally {
      if (previous === undefined) delete process.env['DEPLOYMENT_STAGE'];
      else process.env['DEPLOYMENT_STAGE'] = previous;
    }
    expect(stages.length).toBeGreaterThan(1);
    expect(new Set(stages)).toEqual(new Set(['staging']));
  });
  it('fails closed when production pseudonymization is unconfigured', () => {
    expect(() => createApiHandler({ ...options, ipHashSecret: '' })).toThrow('IP_HASH_SECRET');
  });
  it('limits spoofed internal headers and isolates instance quota', async () => {
    const first = createApiHandler(options);
    const second = createApiHandler(options);
    for (let i = 0; i < 100; i++) {
      expect((await first.fetch(request(), { clientIp: '203.0.113.1' })).status).toBe(404);
    }
    const limited = await first.fetch(request(), { clientIp: '203.0.113.1' });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect((await second.fetch(request(), { clientIp: '203.0.113.1' })).status).toBe(404);
  });
  it('records a throttled request on a known route and keeps unknown paths out of the audit table', async () => {
    closeDatabase();
    getDatabase();
    const audit = vi.fn();
    const handler = createApiHandler({ ...options, audit, minHealthTotalDraws: 0 });
    const clientIp = '198.51.100.77';
    for (let i = 0; i < 100; i++) {
      await handler.fetch(new Request('https://example.com/api/health'), { clientIp });
    }
    audit.mockClear();

    const limited = await handler.fetch(new Request('https://example.com/api/health'), { clientIp });

    expect(limited.status).toBe(429);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'api.health_read',
        statusCode: 429,
        success: false,
        metadata: { rateLimited: true },
      })
    );

    audit.mockClear();
    const unknown = '198.51.100.78';
    for (let i = 0; i < 101; i++) {
      await handler.fetch(new Request('https://example.com/api/missing'), { clientIp: unknown });
    }
    expect(audit).not.toHaveBeenCalled();
  });

  it('returns 400 with the actionable message when the mode minimum is not met', async () => {
    closeDatabase();
    getDatabase();
    const handler = createApiHandler({
      ...options,
      minHealthTotalDraws: 0,
      allowedOrigins: 'https://example.com',
    });

    const response = await handler.fetch(
      new Request('https://example.com/api/generate-bets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ budget: 10, mode: 'multiple_only' }),
      }),
      { clientIp: '198.51.100.88' }
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/múltipla/i);
  });

  it('charges internal requests that identify visitors while exempting private background calls', async () => {
    const handler = createApiHandler(options);
    for (let i = 0; i < 101; i++) {
      expect((await handler.fetch(request(), { internal: true })).status).toBe(404);
    }
    for (let i = 0; i < 100; i++) {
      await handler.fetch(request(), { internal: true, clientIp: '203.0.113.2' });
    }
    expect((await handler.fetch(request(), { internal: true, clientIp: '203.0.113.2' })).status).toBe(429);
  });
  it('serves shared archive listings from the revision cache and keeps draw pages uncached', async () => {
    closeDatabase();
    const insert = getDatabase().prepare(`INSERT INTO draws (contest_number, draw_date, number_1, number_2,
      number_3, number_4, number_5, number_6) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run(1, '2025-01-01', 1, 2, 3, 4, 5, 6);
    const handler = createApiHandler(options);
    const get = (route: string) => handler.fetch(new Request(`https://example.com${route}`), { clientIp: '203.0.113.20' });
    const spies = [
      vi.spyOn(DrawArchiveEngine.prototype, 'getYearArchive'),
      vi.spyOn(DrawArchiveEngine.prototype, 'getArchiveIndex'),
      vi.spyOn(DrawArchiveEngine.prototype, 'getMegaDaVirada'),
      vi.spyOn(DrawArchiveEngine.prototype, 'getSitemapData'),
      vi.spyOn(DrawArchiveEngine.prototype, 'getDrawPage'),
    ];
    try {
      const routes = ['/api/draws?year=2025', '/api/draws', '/api/draws?view=mega-da-virada', '/api/sitemap', '/api/draws?contest=1'];
      for (let pass = 0; pass < 2; pass++) {
        for (const route of routes) expect((await get(route)).status).toBe(200);
      }
      expect((await get('/api/draws?year=2024')).status).toBe(404);
      expect(spies.map(spy => spy.mock.calls.length)).toEqual([2, 1, 1, 1, 2]);
      insert.run(2, '2025-01-08', 7, 8, 9, 10, 11, 12);
      const year = await (await get('/api/draws?year=2025')).json() as { draws: unknown[] };
      expect(year.draws).toHaveLength(2);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
