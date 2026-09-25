import 'server-only';
import { cache } from 'react';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/api-fetch';
import { forwardedClientIpHeaders } from '@/lib/api/forwarded-client-ip';
import {
  archiveIndexSchema,
  drawPageSchema,
  numberProfileSchema,
  numbersIndexSchema,
  sitemapDataSchema,
  yearArchiveSchema,
  type ArchiveIndex,
  type DrawPage,
  type NumberProfile,
  type NumbersIndex,
  type SitemapData,
  type YearArchive,
} from '@/lib/api/archive-contract';
import { logger } from '@/lib/logger';

const ARCHIVE_TIMEOUT_MS = 8000;

/**
 * Reads one archive view from the Bun API. `null` means the API answered 404
 * (the contest/year does not exist); anything else that is not a valid payload
 * throws, so the page renders its error boundary instead of wrong data.
 */
async function loadArchiveJson<Schema extends z.ZodTypeAny>(
  path: string,
  schema: Schema
): Promise<z.infer<Schema> | null> {
  const response = await fetchApi(path, {
    headers: await forwardedClientIpHeaders(),
    cache: 'no-store',
    timeoutMs: ARCHIVE_TIMEOUT_MS,
  });

  if (response.status === 404) {
    return null;
  }
  if (response.status === 429) {
    // A visitor (usually a crawler burst from one IP) exhausted its API quota;
    // the page fails with 500, which crawlers treat as a signal to slow down.
    logger.warn('archive.rate_limited', { route: path });
  }
  if (!response.ok) {
    throw new Error(`Archive request ${path} failed with status ${response.status}`);
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    logger.error('archive.contract_violation', parsed.error, { route: path });
    throw new Error(`Archive request ${path} returned an unexpected payload`);
  }
  return parsed.data;
}

/** Existing value or a thrown error: index views always exist, even when empty. */
async function loadRequired<Schema extends z.ZodTypeAny>(
  path: string,
  schema: Schema
): Promise<z.infer<Schema>> {
  const value = await loadArchiveJson(path, schema);
  if (value === null) {
    throw new Error(`Archive request ${path} returned 404`);
  }
  return value;
}

// `cache` dedupes the request between generateMetadata and the page render.
export const loadDrawPage: (contest: number) => Promise<DrawPage | null> = cache((contest) =>
  loadArchiveJson(`/api/draws?contest=${contest}`, drawPageSchema)
);

export const loadYearArchive: (year: number) => Promise<YearArchive | null> = cache((year) =>
  loadArchiveJson(`/api/draws?year=${year}`, yearArchiveSchema)
);

export const loadArchiveIndex: () => Promise<ArchiveIndex> = cache(() =>
  loadRequired('/api/draws', archiveIndexSchema)
);

export const loadNumbersIndex: () => Promise<NumbersIndex> = cache(() =>
  loadRequired('/api/numbers', numbersIndexSchema)
);

export const loadNumberProfile: (number: number) => Promise<NumberProfile> = cache((number) =>
  loadRequired(`/api/numbers?n=${number}`, numberProfileSchema)
);

export const loadSitemapData: () => Promise<SitemapData> = cache(() =>
  loadRequired('/api/sitemap', sitemapDataSchema)
);
