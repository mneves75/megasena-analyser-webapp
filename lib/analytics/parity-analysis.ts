import { getDatabase } from '@/lib/db';

export interface ParityStats {
  evenCount: number;
  oddCount: number;
  occurrences: number;
  percentage: number;
  isBalanced: boolean;
}

export class ParityAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getParityDistribution(): ParityStats[] {
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
    const distribution = new Map<number, number>();

    // Count even numbers in each draw
    for (const draw of draws) {
      const numbers = [
        draw.number_1,
        draw.number_2,
        draw.number_3,
        draw.number_4,
        draw.number_5,
        draw.number_6,
      ];

      const evenCount = numbers.filter((n) => n % 2 === 0).length;
      distribution.set(evenCount, (distribution.get(evenCount) || 0) + 1);
    }

    // Build result array for all possible distributions (0-6 even)
    const results: ParityStats[] = [];
    for (let evenCount = 0; evenCount <= 6; evenCount++) {
      const occurrences = distribution.get(evenCount) || 0;
      const oddCount = 6 - evenCount;
      const percentage = totalDraws > 0 ? (occurrences / totalDraws) * 100 : 0;
      const isBalanced = evenCount === 2 || evenCount === 3 || evenCount === 4;

      results.push({
        evenCount,
        oddCount,
        occurrences,
        percentage: Math.round(percentage * 100) / 100,
        isBalanced,
      });
    }

    return results.sort((a, b) => b.occurrences - a.occurrences);
  }

  getParityStats(): {
    mostCommon: ParityStats;
    leastCommon: ParityStats;
    balancedPercentage: number;
  } {
    const distribution = this.getParityDistribution();
    const totalDraws = distribution.reduce((sum, d) => sum + d.occurrences, 0);

    const mostCommon = distribution[0];
    const leastCommon = distribution[distribution.length - 1];

    const balancedCount = distribution
      .filter((d) => d.isBalanced)
      .reduce((sum, d) => sum + d.occurrences, 0);

    const balancedPercentage = totalDraws > 0 ? (balancedCount / totalDraws) * 100 : 0;

    return {
      mostCommon,
      leastCommon,
      balancedPercentage: Math.round(balancedPercentage * 100) / 100,
    };
  }
}

