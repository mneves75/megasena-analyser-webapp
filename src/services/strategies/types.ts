import "server-only";

import type { PrismaClient } from "@prisma/client";

import {
  DEFAULT_BETTING_LIMITS,
  type BettingLimits,
} from "@/services/strategy-limits";

export const MEGASENA_MIN_DEZENA = 1;
export const MEGASENA_MAX_DEZENA = 60;
export const QUADRANT_RANGES = [
  { name: "01-10", start: 1, end: 10 },
  { name: "11-20", start: 11, end: 20 },
  { name: "21-30", start: 21, end: 30 },
  { name: "31-40", start: 31, end: 40 },
  { name: "41-50", start: 41, end: 50 },
  { name: "51-60", start: 51, end: 60 },
] as const;

export type QuadrantRange = (typeof QUADRANT_RANGES)[number];

export type StrategyName = "uniform" | "balanced";

export type StrategyContext = {
  seed: string;
  k?: number;
  window?: number;
  client?: PrismaClient;
  limits?: BettingLimits;
};

export type QuadrantDistribution = {
  range: QuadrantRange["name"];
  count: number;
};

export type ParityDistribution = {
  even: number;
  odd: number;
};

export type StrategyMetadata = {
  strategy: StrategyName;
  seed: string;
  k: number;
  sum: number;
  parity: ParityDistribution;
  quadrants: QuadrantDistribution[];
  score?: number;
  details?: Record<string, unknown>;
};

export type StrategyResult = {
  dezenas: number[];
  metadata: StrategyMetadata;
};

export type StrategyHandler = (ctx: StrategyContext) => Promise<StrategyResult>;

export function resolveK(k?: number): number {
  return resolveKWithLimits(k, DEFAULT_BETTING_LIMITS);
}

export function resolveKWithLimits(
  k: number | undefined,
  limits: BettingLimits,
): number {
  if (k === undefined || k === null) {
    return limits.defaultDezenaCount;
  }

  if (
    k < limits.minDezenaCount ||
    k > limits.maxDezenaCount ||
    !Number.isInteger(k)
  ) {
    throw new Error(
      `Valor de k inválido: ${k}. Permitido entre ${limits.minDezenaCount} e ${limits.maxDezenaCount}.`,
    );
  }

  return k;
}

export function normalizeSeed(seed: string): string {
  const normalized = seed?.trim();
  if (!normalized) {
    throw new Error("Seed inválida. Forneça uma seed não vazia");
  }
  return normalized;
}
