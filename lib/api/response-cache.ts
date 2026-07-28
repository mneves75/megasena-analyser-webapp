import { getDatabase } from '@/lib/db';

interface ResponseCacheEntry {
  contest: string | number | null;
  body: string;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 32;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * Builds a cache key from the handler's VALIDATED effective options only.
 * Never key on raw query strings: unknown or duplicate parameters would let
 * clients force cache misses (eviction attack) or collapse semantically
 * different requests into one entry.
 */
export function buildResponseCacheKey(
  route: string,
  options: Record<string, boolean | number | string> = {}
): string {
  const entries = Object.entries(options).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
  if (entries.length === 0) {
    return route;
  }
  const canonical = entries.map(([key, value]) => `${key}=${String(value)}`).join('&');
  return `${route}?${canonical}`;
}

export function getDrawsVersion(): string | null {
  const row = getDatabase()
    .prepare(
      `SELECT
        COUNT(*) AS count,
        COALESCE(MAX(rowid), 0) AS maxRowId,
        COALESCE(MAX(strftime('%s', updated_at)), 0) AS maxUpdatedAt
      FROM draws`
    )
    .get() as { count: number; maxRowId: number; maxUpdatedAt: number } | undefined;

  if (!row) {
    return null;
  }

  // Composite version: count catches inserts/deletes, maxRowId catches re-inserts,
  // and maxUpdatedAt catches in-place corrections (backfills/prize fixes).
  return `${row.count}:${row.maxRowId}:${row.maxUpdatedAt}`;
}

/**
 * @deprecated Use getDrawsVersion for cache invalidation; kept for callers that
 * genuinely need the largest contest number.
 */
export function getLatestContestNumber(): number | null {
  const row = getDatabase()
    .prepare('SELECT MAX(contest_number) AS lastContestNumber FROM draws')
    .get() as { lastContestNumber: number | null } | undefined;

  return row?.lastContestNumber ?? null;
}

export class ContestResponseCache {
  private readonly entries = new Map<string, ResponseCacheEntry>();

  constructor(
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('Response cache size must be a positive integer');
    }
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new Error('Response cache TTL must be a positive number of milliseconds');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  getOrCompute(key: string, contest: string | number | null, computePayload: () => unknown): string {
    const cached = this.entries.get(key);
    // TTL bounds staleness from data changes that do not move the version:
    // for example, manual updates that do not change the draws count, or requests
    // racing an ingestion while the count has not yet incremented.
    if (cached && cached.contest === contest && cached.expiresAt > this.now()) {
      return cached.body;
    }

    const body = JSON.stringify(computePayload());
    if (typeof body !== 'string') {
      throw new Error('Response cache payload must be JSON serializable');
    }

    this.entries.delete(key);
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    this.entries.set(key, { contest, body, expiresAt: this.now() + this.ttlMs });
    return body;
  }
}
