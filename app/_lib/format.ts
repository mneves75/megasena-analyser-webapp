import { notFound, permanentRedirect } from 'next/navigation';
import {
  parseCanonicalInteger,
  type DrawNumberHistory,
  type DrawRecord,
} from '@/lib/api/archive-contract';
import { formatCurrency, formatNumber } from '@/lib/utils';

/** Mega-Sena numbers are always written with two digits ("dezenas"). */
export function dezena(number: number): string {
  return String(number).padStart(2, '0');
}

/** "a", "a e b", "a, b e c" */
export function joinPtBr(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function formatDecimal(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercentPtBr(part: number, whole: number, fractionDigits = 1): string {
  return `${formatDecimal(whole > 0 ? (part / whole) * 100 : 0, fractionDigits)}%`;
}

/** One sentence about the jackpot tier of a draw. */
export function senaOutcome(draw: DrawRecord): string {
  const { winners, prize } = draw.sena;
  if (winners === 0) {
    return 'Acumulou: nenhuma aposta acertou as seis dezenas.';
  }
  return `${countLabel(winners, 'aposta acertou', 'apostas acertaram')} as seis dezenas e ${
    winners === 1 ? 'recebeu' : 'receberam'
  } ${formatCurrency(prize)}${winners > 1 ? ' cada' : ''}.`;
}

/** Calendar date of an instant as seen in Brasília (the archive's audience). */
export function formatDateInBrasilia(instant: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(instant));
}

export function weekdayPtBr(isoDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`)
  );
}

/**
 * Resolves an integer route segment. Zero-padded aliases ("03006") redirect
 * permanently to the canonical form; anything else invalid is a hard 404.
 * The status stays settable because archive routes have no Suspense boundary
 * above them (see app/(home)/loading.tsx); keep it that way.
 */
export function resolveIntegerParam(
  raw: string,
  min: number,
  max: number,
  canonicalPath: (value: number) => string
): number {
  const value = parseCanonicalInteger(raw, min, max);
  if (value !== null) {
    return value;
  }
  if (/^0+\d+$/.test(raw)) {
    const unpadded = parseCanonicalInteger(raw.replace(/^0+/, ''), min, max);
    if (unpadded !== null) {
      permanentRedirect(canonicalPath(unpadded));
    }
  }
  notFound();
}

/** The drawn number that had been absent the longest before this draw, if any returned. */
export function longestComeback(
  history: readonly DrawNumberHistory[]
): { number: number; gap: number } | null {
  let best: { number: number; gap: number } | null = null;
  for (const entry of history) {
    if (entry.previous && entry.previous.drawsBetween > 0 && (best === null || entry.previous.drawsBetween > best.gap)) {
      best = { number: entry.number, gap: entry.previous.drawsBetween };
    }
  }
  return best;
}

const PRIMES_UP_TO_60 = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59]);

export interface DrawInsights {
  sum: number;
  even: number;
  odd: number;
  low: number;
  high: number;
  primes: number[];
  repeatedFromPrevious: number[] | null;
  consecutivePairs: Array<[number, number]>;
}

/** Descriptive features of a single draw. They describe it; they predict nothing. */
export function describeDraw(
  numbers: readonly number[],
  previousNumbers: readonly number[] | null
): DrawInsights {
  const sorted = [...numbers].sort((a, b) => a - b);
  const even = sorted.filter((number) => number % 2 === 0).length;
  const low = sorted.filter((number) => number <= 30).length;
  const previous = previousNumbers ? new Set(previousNumbers) : null;

  return {
    sum: sorted.reduce((total, number) => total + number, 0),
    even,
    odd: sorted.length - even,
    low,
    high: sorted.length - low,
    primes: sorted.filter((number) => PRIMES_UP_TO_60.has(number)),
    repeatedFromPrevious: previous ? sorted.filter((number) => previous.has(number)) : null,
    consecutivePairs: sorted.flatMap((number, index): Array<[number, number]> => {
      const next = sorted[index + 1];
      return next === number + 1 ? [[number, next]] : [];
    }),
  };
}
