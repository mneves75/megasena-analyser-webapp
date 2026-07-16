import { getDatabase } from '@/lib/db';
import { PRIME_NUMBERS } from '@/lib/constants';
import { roundTo } from '@/lib/utils';

const NUMBER_FREQUENCY_QUERY = `
  WITH all_occurrences AS (
    SELECT number_1 as number FROM draws
    UNION ALL
    SELECT number_2 FROM draws
    UNION ALL
    SELECT number_3 FROM draws
    UNION ALL
    SELECT number_4 FROM draws
    UNION ALL
    SELECT number_5 FROM draws
    UNION ALL
    SELECT number_6 FROM draws
  )
  SELECT number, COUNT(*) as frequency
  FROM all_occurrences
  GROUP BY number
  ORDER BY number
`;

export interface PrimeStats {
  totalPrimes: number;
  averagePrimesPerDraw: number;
  distribution: Array<{
    primeCount: number;
    occurrences: number;
    percentage: number;
  }>;
  mostCommonCount: number;
  primeFrequencies: Array<{
    number: number;
    frequency: number;
    isPrime: boolean;
  }>;
}

export class PrimeAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;
  private primeSet: Set<number>;

  constructor() {
    this.db = getDatabase();
    this.primeSet = new Set(PRIME_NUMBERS);
  }

  isPrime(num: number): boolean {
    return this.primeSet.has(num);
  }

  getPrimeDistribution(): PrimeStats {
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
    const primeCountMap = new Map<number, number>();
    let totalPrimeCount = 0;

    // Count primes in each draw
    for (const draw of draws) {
      const numbers = [
        draw.number_1,
        draw.number_2,
        draw.number_3,
        draw.number_4,
        draw.number_5,
        draw.number_6,
      ];

      const primeCount = numbers.filter((n) => this.isPrime(n)).length;
      totalPrimeCount += primeCount;
      primeCountMap.set(primeCount, (primeCountMap.get(primeCount) || 0) + 1);
    }

    // Build distribution array
    const distribution: Array<{ primeCount: number; occurrences: number; percentage: number }> = [];
    for (let i = 0; i <= 6; i++) {
      const occurrences = primeCountMap.get(i) || 0;
      const percentage = totalDraws > 0 ? (occurrences / totalDraws) * 100 : 0;
      distribution.push({
        primeCount: i,
        occurrences,
        percentage: roundTo(percentage),
      });
    }

    // Find most common prime count
    const mostCommon = distribution.reduce((prev, curr) =>
      curr.occurrences > prev.occurrences ? curr : prev
    );

    const frequencyRows = this.db.prepare(NUMBER_FREQUENCY_QUERY).all() as Array<{
      number: number;
      frequency: number;
    }>;
    const frequencyByNumber = new Map(
      frequencyRows.map((row) => [row.number, row.frequency] as const)
    );
    const primeFrequencies = PRIME_NUMBERS.map((number) => ({
      number,
      frequency: frequencyByNumber.get(number) ?? 0,
      isPrime: true,
    }));

    // Sort by frequency
    primeFrequencies.sort((a, b) => b.frequency - a.frequency);

    return {
      totalPrimes: PRIME_NUMBERS.length,
      averagePrimesPerDraw: totalDraws > 0 ? totalPrimeCount / totalDraws : 0,
      distribution: distribution.sort((a, b) => b.occurrences - a.occurrences),
      mostCommonCount: mostCommon.primeCount,
      primeFrequencies: primeFrequencies.slice(0, 10),
    };
  }
}
