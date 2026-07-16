import { getDatabase } from '@/lib/db';

interface ResponseCacheEntry {
  contest: number | null;
  body: string;
}

const DEFAULT_MAX_ENTRIES = 32;

export function buildResponseCacheKey(route: string, searchParams: URLSearchParams): string {
  const entries = [...searchParams.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    const keyComparison = keyA.localeCompare(keyB);
    return keyComparison !== 0 ? keyComparison : valueA.localeCompare(valueB);
  });
  const canonicalQuery = new URLSearchParams(entries).toString();
  return canonicalQuery.length > 0 ? `${route}?${canonicalQuery}` : route;
}

export function getLatestContestNumber(): number | null {
  const row = getDatabase()
    .prepare('SELECT MAX(contest_number) AS lastContestNumber FROM draws')
    .get() as { lastContestNumber: number | null } | undefined;

  return row?.lastContestNumber ?? null;
}

export class ContestResponseCache {
  private readonly entries = new Map<string, ResponseCacheEntry>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error('Response cache size must be a positive integer');
    }
  }

  get size(): number {
    return this.entries.size;
  }

  getOrCompute(
    key: string,
    contest: number | null,
    computePayload: () => unknown
  ): string {
    const cached = this.entries.get(key);
    if (cached?.contest === contest) {
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
    this.entries.set(key, { contest, body });
    return body;
  }
}
