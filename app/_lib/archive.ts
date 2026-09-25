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

// `cache` dedupes the request between generateMetadata and the page render.
export const loadDrawPage = cache((contest: number) =>
  loadArchiveJson(`/api/draws?contest=${contest}`, drawPageSchema)
);

export const loadYearArchive = cache((year: number) =>
  loadArchiveJson(`/api/draws?year=${year}`, yearArchiveSchema)
);

export const loadArchiveIndex = cache(async () => {
  const index = await loadArchiveJson('/api/draws', archiveIndexSchema);
  if (!index) {
    throw new Error('Archive index unavailable');
  }
  return index;
});

export const loadNumbersIndex = cache(async () => {
  const index = await loadArchiveJson('/api/numbers', numbersIndexSchema);
  if (!index) {
    throw new Error('Numbers index unavailable');
  }
  return index;
});

export const loadNumberProfile = cache(async (number: number) => {
  const profile = await loadArchiveJson(`/api/numbers?n=${number}`, numberProfileSchema);
  if (!profile) {
    throw new Error(`Number profile ${number} unavailable`);
  }
  return profile;
});

export const loadSitemapData = cache(async () => {
  const data = await loadArchiveJson('/api/sitemap', sitemapDataSchema);
  if (!data) {
    throw new Error('Sitemap data unavailable');
  }
  return data;
});
