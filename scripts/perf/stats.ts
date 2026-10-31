/** Order statistics for harness samples; nearest-rank on the sorted values. */
export interface Summary {
  n: number;
  min: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  max: number;
  iqr: number;
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error('percentile de amostra vazia');
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]!;
}

export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const p25 = percentile(sorted, 25);
  const p75 = percentile(sorted, 75);
  return {
    n: sorted.length,
    min: sorted[0]!,
    p25,
    p50: percentile(sorted, 50),
    p75,
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1]!,
    iqr: p75 - p25,
  };
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
