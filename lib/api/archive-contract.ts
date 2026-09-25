import { z } from 'zod';

/**
 * Contract for the public results archive served by the Bun API (server.ts) and
 * read by the programmatic SEO pages (/resultados, /concurso, /numeros).
 *
 * The API validates query parameters with the parsers below; the pages validate
 * the JSON responses with the schemas below before rendering them.
 */

export const FIRST_DRAW_YEAR = 1996;
// Upper bound for year parameters. Keeps the key space finite even if a client
// probes arbitrary years; real draws never exceed the current year.
export const LAST_ACCEPTED_YEAR = 2100;
export const MAX_CONTEST_NUMBER = 999_999;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Instant the archive last changed a page's content or links (sitemap lastmod). */
const isoInstantSchema = z.string().datetime();
const lotteryNumberSchema = z.number().int().min(1).max(60);
const contestNumberSchema = z.number().int().positive();

const prizeTierSchema = z.object({
  winners: z.number().int().nonnegative(),
  prize: z.number().nonnegative(),
});

export const drawRecordSchema = z.object({
  contestNumber: contestNumberSchema,
  drawDate: isoDateSchema,
  numbers: z.array(lotteryNumberSchema).length(6),
  sena: prizeTierSchema,
  quina: prizeTierSchema,
  quadra: prizeTierSchema,
  accumulated: z.boolean(),
  accumulatedValue: z.number().positive().nullable(),
  nextEstimatedPrize: z.number().positive().nullable(),
  totalCollection: z.number().positive().nullable(),
});

/** State of the whole archive, shown as "Dados até o concurso N" on its pages. */
const archiveStateSchema = z.object({
  totalDraws: z.number().int().nonnegative(),
  lastContestNumber: contestNumberSchema.nullable(),
  lastDrawDate: isoDateSchema.nullable(),
  lastModified: isoInstantSchema.nullable(),
});

/**
 * How each drawn number stood in the archive at the moment of this draw.
 * Everything is computed from contests up to this one, so the page for an old
 * draw never changes when newer draws arrive.
 */
const drawNumberHistorySchema = z.object({
  number: lotteryNumberSchema,
  timesDrawn: z.number().int().positive(),
  previous: z
    .object({
      contestNumber: contestNumberSchema,
      drawDate: isoDateSchema,
      drawsBetween: z.number().int().nonnegative(),
    })
    .nullable(),
});

export const drawPageSchema = z.object({
  draw: drawRecordSchema,
  lastModified: isoInstantSchema,
  previous: z
    .object({ contestNumber: contestNumberSchema, numbers: z.array(lotteryNumberSchema) })
    .nullable(),
  next: z.object({ contestNumber: contestNumberSchema, drawDate: isoDateSchema }).nullable(),
  numberHistory: z.array(drawNumberHistorySchema).length(6),
  sumContext: z.object({
    earlierDraws: z.number().int().nonnegative(),
    lowerSum: z.number().int().nonnegative(),
  }),
});

const yearSummarySchema = z.object({
  year: z.number().int(),
  drawCount: z.number().int().positive(),
  firstContest: contestNumberSchema,
  lastContest: contestNumberSchema,
  firstDrawDate: isoDateSchema,
  lastDrawDate: isoDateSchema,
});

export const archiveIndexSchema = z.object({
  archive: archiveStateSchema,
  recent: z.array(drawRecordSchema),
  years: z.array(yearSummarySchema),
});

export const yearArchiveSchema = z.object({
  year: z.number().int(),
  lastModified: isoInstantSchema,
  draws: z.array(drawRecordSchema).min(1),
  previousYear: z.number().int().nullable(),
  nextYear: z.number().int().nullable(),
});

const numberSummarySchema = z.object({
  number: lotteryNumberSchema,
  frequency: z.number().int().nonnegative(),
  rank: z.number().int().min(1).max(60),
  /** Null only for a number that was never drawn. */
  lastAppearance: z
    .object({
      contestNumber: contestNumberSchema,
      drawDate: isoDateSchema,
      drawsSince: z.number().int().nonnegative(),
    })
    .nullable(),
});

export const numbersIndexSchema = z.object({
  archive: archiveStateSchema,
  numbers: z.array(numberSummarySchema).length(60),
});

export const numberProfileSchema = numberSummarySchema.extend({
  archive: archiveStateSchema,
  averageInterval: z.number().positive().nullable(),
  longestGap: z.number().int().nonnegative().nullable(),
  appearances: z.array(z.object({ contestNumber: contestNumberSchema, drawDate: isoDateSchema })),
  companions: z.array(
    z.object({ number: lotteryNumberSchema, count: z.number().int().positive() })
  ),
});

export const sitemapDataSchema = z.object({
  archive: archiveStateSchema,
  draws: z.array(z.object({ contestNumber: contestNumberSchema, lastModified: isoInstantSchema })),
  years: z.array(z.object({ year: z.number().int(), lastModified: isoInstantSchema })),
});

export type DrawRecord = z.infer<typeof drawRecordSchema>;
export type ArchiveState = z.infer<typeof archiveStateSchema>;
export type DrawNumberHistory = z.infer<typeof drawNumberHistorySchema>;
export type DrawPage = z.infer<typeof drawPageSchema>;
export type YearSummary = z.infer<typeof yearSummarySchema>;
export type ArchiveIndex = z.infer<typeof archiveIndexSchema>;
export type YearArchive = z.infer<typeof yearArchiveSchema>;
export type NumberSummary = z.infer<typeof numberSummarySchema>;
export type NumbersIndex = z.infer<typeof numbersIndexSchema>;
export type NumberProfile = z.infer<typeof numberProfileSchema>;
export type SitemapData = z.infer<typeof sitemapDataSchema>;

/**
 * Canonical integer route/query parameter: digits only, no sign, no leading
 * zero. Returns null for anything else so callers can 400/404 or redirect.
 */
export function parseCanonicalInteger(value: string, min: number, max: number): number | null {
  const parsed = z
    .string()
    .max(String(max).length)
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type DrawsQuery =
  | { kind: 'index' }
  | { kind: 'year'; year: number }
  | { kind: 'contest'; contest: number };

export function parseDrawsQuery(searchParams: URLSearchParams): DrawsQuery | null {
  const year = searchParams.get('year');
  const contest = searchParams.get('contest');
  if (year !== null && contest !== null) {
    return null;
  }
  if (year !== null) {
    const parsed = parseCanonicalInteger(year, FIRST_DRAW_YEAR, LAST_ACCEPTED_YEAR);
    return parsed === null ? null : { kind: 'year', year: parsed };
  }
  if (contest !== null) {
    const parsed = parseCanonicalInteger(contest, 1, MAX_CONTEST_NUMBER);
    return parsed === null ? null : { kind: 'contest', contest: parsed };
  }
  return { kind: 'index' };
}

export type NumbersQuery = { kind: 'index' } | { kind: 'number'; number: number };

export function parseNumbersQuery(searchParams: URLSearchParams): NumbersQuery | null {
  const value = searchParams.get('n');
  if (value === null) {
    return { kind: 'index' };
  }
  const parsed = parseCanonicalInteger(value, 1, 60);
  return parsed === null ? null : { kind: 'number', number: parsed };
}
