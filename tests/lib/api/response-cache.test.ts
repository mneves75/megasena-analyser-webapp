import { beforeEach, describe, expect, it } from 'vitest';
import { getDatabase, runMigrations } from '@/lib/db';
import {
  buildResponseCacheKey,
  ContestResponseCache,
  getDrawsVersion,
} from '@/lib/api/response-cache';

describe('ContestResponseCache', () => {
  beforeEach(() => {
    runMigrations();
  });

  it('builds keys from validated effective options only, independent of insertion order', () => {
    expect(buildResponseCacheKey('/api/statistics', { pairs: true, delays: false })).toBe(
      buildResponseCacheKey('/api/statistics', { delays: false, pairs: true })
    );
    expect(buildResponseCacheKey('/api/statistics', { pairs: true })).not.toBe(
      buildResponseCacheKey('/api/statistics', { pairs: false })
    );
    expect(buildResponseCacheKey('/api/dashboard')).toBe('/api/dashboard');
  });

  it('expires entries after the TTL even when the contest is unchanged', () => {
    let clock = 0;
    const cache = new ContestResponseCache(32, 1000, () => clock);
    let computations = 0;
    const compute = (): { value: number } => ({ value: ++computations });

    expect(cache.getOrCompute('/api/dashboard', 3031, compute)).toBe('{"value":1}');
    clock = 999;
    expect(cache.getOrCompute('/api/dashboard', 3031, compute)).toBe('{"value":1}');
    clock = 1000;
    expect(cache.getOrCompute('/api/dashboard', 3031, compute)).toBe('{"value":2}');
    expect(computations).toBe(2);
  });

  it('hits once per contest and invalidates when the contest changes', () => {
    const cache = new ContestResponseCache();
    let computations = 0;
    const compute = (): { value: number } => ({ value: ++computations });

    expect(cache.getOrCompute('/api/statistics', 3031, compute)).toBe('{"value":1}');
    expect(cache.getOrCompute('/api/statistics', 3031, compute)).toBe('{"value":1}');
    expect(computations).toBe(1);

    expect(cache.getOrCompute('/api/statistics', 3032, compute)).toBe('{"value":2}');
    expect(computations).toBe(2);
  });

  it('evicts the oldest entry at the configured limit', () => {
    const cache = new ContestResponseCache(2);
    let computations = 0;
    const compute = (): { value: number } => ({ value: ++computations });

    cache.getOrCompute('/api/dashboard', 3031, compute);
    cache.getOrCompute('/api/statistics?delays=true', 3031, compute);
    cache.getOrCompute('/api/statistics?pairs=true', 3031, compute);

    expect(cache.size).toBe(2);
    expect(cache.getOrCompute('/api/dashboard', 3031, compute)).toBe('{"value":4}');
  });

  it('does not cache failed computations', () => {
    const cache = new ContestResponseCache();
    let attempts = 0;

    expect(() =>
      cache.getOrCompute('/api/dashboard', 3031, () => {
        attempts++;
        throw new Error('failed computation');
      })
    ).toThrow('failed computation');

    expect(cache.getOrCompute('/api/dashboard', 3031, () => ({ attempts: ++attempts }))).toBe(
      '{"attempts":2}'
    );
  });

  it('reads a composite draws version that includes count, max rowid and last update', () => {
    const db = getDatabase();
    const insert = db.prepare(`
      INSERT INTO draws (
        contest_number, draw_date,
        number_1, number_2, number_3, number_4, number_5, number_6,
        prize_sena, winners_sena
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);
    insert.run(3030, '2026-07-11', 6, 11, 25, 45, 48, 58);
    insert.run(3031, '2026-07-14', 20, 28, 32, 35, 40, 54);

    const version = getDrawsVersion();
    expect(typeof version).toBe('string');
    expect(version).toMatch(/^2:\d+:\d+$/);
  });

  it('changes the draws version on historical backfills, not only on the latest contest', () => {
    const db = getDatabase();
    const insert = db.prepare(`
      INSERT INTO draws (
        contest_number, draw_date,
        number_1, number_2, number_3, number_4, number_5, number_6,
        prize_sena, winners_sena
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
    `);
    insert.run(3031, '2026-07-14', 20, 28, 32, 35, 40, 54);
    const versionBefore = getDrawsVersion();
    expect(versionBefore).toMatch(/^1:\d+:\d+$/);

    insert.run(3030, '2026-07-11', 6, 11, 25, 45, 48, 58);
    const versionAfter = getDrawsVersion();
    expect(versionAfter).toMatch(/^2:\d+:\d+$/);
    expect(versionAfter).not.toBe(versionBefore);
  });
});
