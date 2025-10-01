import { getDatabase } from '@/lib/db';

export interface SumStats {
  distribution: Array<{ sum: number; count: number }>;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  minSum: number;
  maxSum: number;
  totalDraws: number;
}

export class SumAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getSumDistribution(): SumStats {
    const draws = this.db
      .prepare(
        `SELECT 
          number_1, number_2, number_3, number_4, number_5, number_6
         FROM draws`
      )
      .all() as Array<{
      number_1: number;
      number_2: number;
      number_3: number;
      number_4: number;
      number_5: number;
      number_6: number;
    }>;

    const totalDraws = draws.length;
    const sums: number[] = [];
    const sumCounts = new Map<number, number>();

    // Calculate sum for each draw
    for (const draw of draws) {
      const sum = draw.number_1 + draw.number_2 + draw.number_3 + draw.number_4 + draw.number_5 + draw.number_6;
      sums.push(sum);
      sumCounts.set(sum, (sumCounts.get(sum) || 0) + 1);
    }

    // Sort sums for percentile calculations
    sums.sort((a, b) => a - b);

    // Calculate statistics
    const mean = sums.reduce((acc, val) => acc + val, 0) / sums.length;
    const median = this.calculateMedian(sums);
    const mode = this.calculateMode(sumCounts);
    const stdDev = this.calculateStdDev(sums, mean);

    // Calculate percentiles
    const percentiles = {
      p5: this.calculatePercentile(sums, 5),
      p25: this.calculatePercentile(sums, 25),
      p50: this.calculatePercentile(sums, 50),
      p75: this.calculatePercentile(sums, 75),
      p95: this.calculatePercentile(sums, 95),
    };

    // Build distribution array (grouped by ranges for display)
    const distribution: Array<{ sum: number; count: number }> = [];
    const sortedSums = Array.from(sumCounts.entries()).sort((a, b) => a[0] - b[0]);
    
    for (const [sum, count] of sortedSums) {
      distribution.push({ sum, count });
    }

    return {
      distribution,
      mean: Math.round(mean * 100) / 100,
      median,
      mode,
      stdDev: Math.round(stdDev * 100) / 100,
      percentiles,
      minSum: sums[0],
      maxSum: sums[sums.length - 1],
      totalDraws,
    };
  }

  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
    }
    return sortedArray[mid];
  }

  private calculateMode(sumCounts: Map<number, number>): number {
    let maxCount = 0;
    let mode = 0;

    for (const [sum, count] of sumCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mode = sum;
      }
    }

    return mode;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  getSumCategory(sum: number): 'low' | 'normal' | 'high' {
    const stats = this.getSumDistribution();
    
    if (sum < stats.percentiles.p25) {
      return 'low';
    } else if (sum > stats.percentiles.p75) {
      return 'high';
    }
    return 'normal';
  }
}

