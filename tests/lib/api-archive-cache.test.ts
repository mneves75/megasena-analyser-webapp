// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Real SQLite (with the migration triggers that bump the draws revision).
vi.mock('../../lib/db', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  let sqlite: InstanceType<typeof DatabaseSync> | undefined;
  return {
    getDatabase: () => { sqlite ??= new DatabaseSync(':memory:'); return sqlite; },
    closeDatabase: () => { sqlite?.close(); sqlite = undefined; },
  };
});
import { createApiHandler } from '../../lib/api/handler';
import { getDatabase } from '../../lib/db';
import { DrawArchiveEngine } from '../../lib/analytics/draw-archive';
import { ContestResponseCache } from '../../lib/api/response-cache';

function insertDraw(contest: number, date: string, numbers: readonly number[]) {
  getDatabase().prepare(`INSERT INTO draws (contest_number, draw_date, number_1, number_2,
    number_3, number_4, number_5, number_6, prize_sena, winners_sena)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`).run(contest, date, ...numbers);
}

beforeAll(() => {
  const db = getDatabase();
  for (const migration of readdirSync('db/migrations').filter(name => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(`db/migrations/${migration}`, 'utf8'));
  }
  insertDraw(1, '2025-01-01', [1, 2, 3, 4, 5, 6]);
  insertDraw(2, '2025-01-08', [1, 7, 8, 9, 10, 11]);
});

afterEach(() => { vi.restoreAllMocks(); });

const handler = () => createApiHandler({ environment: 'development', appVersion: 'test', audit: () => {} });
const get = async (api: ReturnType<typeof handler>, path: string) => {
  const response = await api.fetch(new Request(`http://localhost${path}`), { internal: true });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};

describe('draw archive responses are memoized per draws revision', () => {
  it('passes the handler APP_VERSION into response cache keys', async () => {
    const cache = vi.spyOn(ContestResponseCache.prototype, 'getOrCompute');
    for (const appVersion of ['release-1', 'release-2']) {
      const api = createApiHandler({ environment: 'development', appVersion, audit: () => {} });
      expect((await get(api, '/api/sitemap')).status).toBe(200);
    }
    const builds = cache.mock.calls.map(([key]) => new URL(key, 'https://example.com').searchParams.get('build'));
    expect(builds).toEqual(['release-1', 'release-2']);
  });

  it.each([
    ['/api/draws?contest=2', 'getDrawPage'],
    ['/api/draws?year=2025', 'getYearArchive'],
    ['/api/draws', 'getArchiveIndex'],
    ['/api/draws?view=mega-da-virada', 'getMegaDaVirada'],
    ['/api/sitemap', 'getSitemapData'],
  ] as const)('%s computes once and then hits', async (path, method) => {
    const api = handler();
    const spy = vi.spyOn(DrawArchiveEngine.prototype, method);
    const first = await get(api, path);
    const second = await get(api, path);
    expect(first.status).toBe(200);
    expect(second).toEqual(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keys on the validated view, so different contests never share an entry', async () => {
    const api = handler();
    const one = await get(api, '/api/draws?contest=1');
    const two = await get(api, '/api/draws?contest=2');
    expect(one.body).toMatchObject({ draw: { contestNumber: 1 } });
    expect(two.body).toMatchObject({ draw: { contestNumber: 2 } });
  });

  it('keeps returning 404 for a missing contest', async () => {
    const api = handler();
    expect((await get(api, '/api/draws?contest=999')).status).toBe(404);
    expect((await get(api, '/api/draws?contest=999')).status).toBe(404);
  });

  it('invalidates when a new contest is stored', async () => {
    const api = handler();
    const spy = vi.spyOn(DrawArchiveEngine.prototype, 'getSitemapData');
    const before = await get(api, '/api/sitemap');
    insertDraw(3, '2025-01-15', [12, 13, 14, 15, 16, 17]);
    const after = await get(api, '/api/sitemap');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(after.body).not.toEqual(before.body);
    expect(JSON.stringify(after.body)).toContain('"contestNumber":3');
  });
});
