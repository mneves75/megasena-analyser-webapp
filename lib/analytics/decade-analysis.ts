import { getDatabase } from '@/lib/db';
import { DECADES } from '@/lib/constants';
import { roundTo } from '@/lib/utils';

export interface DecadeStats {
  decade: string;
  totalOccurrences: number;
  percentage: number;
  expectedPercentage: number;
  deviation: number;
  topNumbers: Array<{ number: number; frequency: number }>;
}

export class DecadeAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getDecadeDistribution(): DecadeStats[] {
    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;

    const totalNumbersDrawn = totalDraws * 6;
    const expectedPercentage = 100 / DECADES.length;

    const results: DecadeStats[] = [];

    for (const decade of DECADES) {
      const [min, max] = decade.range;
      let totalOccurrences = 0;

      // Count all occurrences in this decade range
      for (let col = 1; col <= 6; col++) {
        const count = (
          this.db
            .prepare(
              `SELECT COUNT(*) as count
               FROM draws
               WHERE number_${col} BETWEEN ? AND ?`
            )
            .get(min, max) as { count: number }
        ).count;
        totalOccurrences += count;
      }

      const percentage = (totalOccurrences / totalNumbersDrawn) * 100;
      const deviation = percentage - expectedPercentage;

      // Get top 3 numbers from this decade
      const topNumbers: Array<{ number: number; frequency: number }> = [];
      for (let num = min; num <= max; num++) {
        let frequency = 0;
        for (let col = 1; col <= 6; col++) {
          const count = (
            this.db
              .prepare(`SELECT COUNT(*) as count FROM draws WHERE number_${col} = ?`)
              .get(num) as { count: number }
          ).count;
          frequency += count;
        }
        topNumbers.push({ number: num, frequency });
      }

      topNumbers.sort((a, b) => b.frequency - a.frequency);

      results.push({
        decade: decade.label,
        totalOccurrences,
        percentage: roundTo(percentage),
        expectedPercentage: roundTo(expectedPercentage),
        deviation: roundTo(deviation),
        topNumbers: topNumbers.slice(0, 3),
      });
    }

    return results;
  }
}

