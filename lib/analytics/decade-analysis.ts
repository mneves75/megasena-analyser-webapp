import { getDatabase } from '@/lib/db';
import { DECADES } from '@/lib/constants';
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
    const frequencyRows = this.db.prepare(NUMBER_FREQUENCY_QUERY).all() as Array<{
      number: number;
      frequency: number;
    }>;
    const frequencyByNumber = new Map(
      frequencyRows.map((row) => [row.number, row.frequency] as const)
    );
    const totalNumbersDrawn = frequencyRows.reduce((sum, row) => sum + row.frequency, 0);
    const expectedPercentage = 100 / DECADES.length;

    const results: DecadeStats[] = [];

    for (const decade of DECADES) {
      const [min, max] = decade.range;
      const topNumbers = Array.from({ length: max - min + 1 }, (_, index) => {
        const number = min + index;
        return { number, frequency: frequencyByNumber.get(number) ?? 0 };
      });
      const totalOccurrences = topNumbers.reduce((sum, row) => sum + row.frequency, 0);
      const percentage = totalNumbersDrawn > 0 ? (totalOccurrences / totalNumbersDrawn) * 100 : 0;
      const deviation = percentage - expectedPercentage;

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
