import "server-only";

import {
  MEGASENA_MAX_DEZENA,
  MEGASENA_MIN_DEZENA,
  QUADRANT_RANGES,
} from "@/services/strategies/types";
import type {
  ParityDistribution,
  QuadrantDistribution,
  StrategyMetadata,
  StrategyName,
} from "@/types/strategy";

export function buildQuadrantDistribution(
  numbers: readonly number[],
): QuadrantDistribution[] {
  return QUADRANT_RANGES.map((quadrant) => ({
    range: quadrant.name,
    count: numbers.filter((n) => n >= quadrant.start && n <= quadrant.end)
      .length,
  }));
}

export function buildParityDistribution(
  numbers: readonly number[],
): ParityDistribution {
  const even = numbers.filter((n) => n % 2 === 0).length;
  return {
    even,
    odd: numbers.length - even,
  };
}

export function buildMetadata(
  strategy: StrategyName,
  seed: string,
  dezenas: readonly number[],
  details?: Record<string, unknown>,
  score?: number,
): StrategyMetadata {
  const numbers = [...dezenas].sort((a, b) => a - b);
  const parity = buildParityDistribution(numbers);
  const quadrants = buildQuadrantDistribution(numbers);
  const sum = numbers.reduce((total, current) => total + current, 0);

  return {
    strategy,
    seed,
    k: numbers.length,
    sum,
    parity,
    quadrants,
    score,
    details,
  };
}

export function getQuadrantIndex(value: number): number {
  if (value < MEGASENA_MIN_DEZENA || value > MEGASENA_MAX_DEZENA) {
    throw new Error(`Dezena fora do intervalo permitido: ${value}`);
  }

  return Math.floor((value - 1) / 10);
}

export function getNumbersInQuadrant(index: number): number[] {
  const quadrant = QUADRANT_RANGES[index];
  if (!quadrant) {
    throw new Error(`Quadrante inválido: ${index}`);
  }

  const values: number[] = [];
  for (let dezena = quadrant.start; dezena <= quadrant.end; dezena += 1) {
    values.push(dezena);
  }
  return values;
}

export function range(min: number, max: number): number[] {
  const result: number[] = [];
  for (let value = min; value <= max; value += 1) {
    result.push(value);
  }
  return result;
}
