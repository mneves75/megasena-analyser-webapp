import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  getFrequencies,
  getPairs,
  getSums,
  getQuadrants,
  getRecency,
} from "@/services/stats";
import { prisma } from "@/lib/prisma";

const DEFAULT_WINDOW_SIZE = 200;
const DEFAULT_TOP_PAIRS = 9;

export type StatsSummary = {
  totalDraws: number;
  lastSync: Date | null;
  averageSum: number;
  parityEvenPercent: number;
  parityOddPercent: number;
  hotNumbers: Array<{
    dezena: number;
    hits: number;
    percentage: number;
    contestsSinceLast: number | null;
  }>;
  coldNumbers: Array<{
    dezena: number;
    hits: number;
    percentage: number;
    contestsSinceLast: number | null;
  }>;
  quadrantDistribution: Awaited<ReturnType<typeof getQuadrants>>;
  topPairs: Array<{ combination: [number, number]; hits: number }>;
};

export type LoadStatsSummaryOptions = {
  windowSize?: number;
  topPairsLimit?: number;
  client?: PrismaClient;
};

export async function loadStatsSummary(
  options: LoadStatsSummaryOptions = {},
): Promise<StatsSummary> {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  const topPairsLimit = options.topPairsLimit ?? DEFAULT_TOP_PAIRS;
  const prismaClient = options.client ?? prisma;

  const [
    frequencies,
    pairs,
    sums,
    quadrants,
    recency,
    lastSyncMeta,
    totalDrawCount,
  ] = await Promise.all([
    getFrequencies({ window: windowSize, client: options.client }),
    getPairs({
      window: windowSize,
      limit: topPairsLimit,
      client: options.client,
    }),
    getSums({ window: windowSize, client: options.client }),
    getQuadrants({ window: windowSize, client: options.client }),
    getRecency({ client: options.client }),
    prismaClient.meta.findUnique({ where: { key: "last_sync" } }),
    prismaClient.draw.count(),
  ]);

  const totalNumbers = sums.parity.even + sums.parity.odd;
  const parityEvenPercent =
    totalNumbers > 0 ? sums.parity.even / totalNumbers : 0;
  const parityOddPercent =
    totalNumbers > 0 ? sums.parity.odd / totalNumbers : 0;

  const recencyMap = new Map(
    recency.map((item) => [item.dezena, item.contestsSinceLast]),
  );

  const hotNumbers = frequencies.items.slice(0, 5).map((item) => ({
    dezena: item.dezena,
    hits: item.hits,
    percentage: item.frequency,
    contestsSinceLast: recencyMap.get(item.dezena) ?? null,
  }));

  const coldNumbersSource =
    frequencies.items.length > 5
      ? frequencies.items.slice(-5)
      : frequencies.items.slice().reverse();
  const coldNumbers = [...coldNumbersSource]
    .sort((a, b) => a.hits - b.hits)
    .map((item) => ({
      dezena: item.dezena,
      hits: item.hits,
      percentage: item.frequency,
      contestsSinceLast: recencyMap.get(item.dezena) ?? null,
    }));

  const topPairs = pairs.map((pair) => ({
    combination: [pair.combination[0], pair.combination[1]] as [number, number],
    hits: pair.hits,
  }));

  const lastSyncValue = lastSyncMeta?.value
    ? new Date(lastSyncMeta.value)
    : null;
  const lastSync =
    lastSyncValue && !Number.isNaN(lastSyncValue.getTime())
      ? lastSyncValue
      : null;

  return {
    totalDraws: totalDrawCount,
    lastSync,
    averageSum: Math.round(sums.average ?? 0),
    parityEvenPercent,
    parityOddPercent,
    hotNumbers,
    coldNumbers,
    quadrantDistribution: quadrants,
    topPairs,
  };
}

export const STATS_SUMMARY_DEFAULT_WINDOW = DEFAULT_WINDOW_SIZE;
export const STATS_SUMMARY_DEFAULT_TOP_PAIRS = DEFAULT_TOP_PAIRS;
