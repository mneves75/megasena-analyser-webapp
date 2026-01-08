import { getDatabase } from '@/lib/db';
import { MEGASENA_CONSTANTS } from '@/lib/constants';

export interface DelayStats {
  number: number;
  delayDraws: number;
  lastDrawnContest: number | null;
  lastDrawnDate: string | null;
  averageDelay: number;
  delayCategory: 'recent' | 'normal' | 'overdue' | 'critical';
}

export class DelayAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getNumberDelays(): DelayStats[] {
    const maxResult = this.db
      .prepare('SELECT MAX(contest_number) as max FROM draws')
      .get() as { max: number | null } | undefined;

    // Handle empty database case
    const latestContest = maxResult?.max ?? 0;
    if (latestContest === 0) {
      // No draws in database - return empty array or default stats
      return [];
    }

    // Single optimized query using UNION ALL to get all number occurrences
    const query = `
      WITH all_occurrences AS (
        SELECT number_1 as num, contest_number, draw_date FROM draws
        UNION ALL
        SELECT number_2, contest_number, draw_date FROM draws
        UNION ALL
        SELECT number_3, contest_number, draw_date FROM draws
        UNION ALL
        SELECT number_4, contest_number, draw_date FROM draws
        UNION ALL
        SELECT number_5, contest_number, draw_date FROM draws
        UNION ALL
        SELECT number_6, contest_number, draw_date FROM draws
      ),
      number_stats AS (
        SELECT 
          num,
          COUNT(*) as total_occurrences,
          MAX(contest_number) as last_contest,
          MAX(draw_date) as last_date
        FROM all_occurrences
        GROUP BY num
      )
      SELECT * FROM number_stats ORDER BY num
    `;

    const numberStats = this.db.prepare(query).all() as Array<{
      num: number;
      total_occurrences: number;
      last_contest: number;
      last_date: string;
    }>;

    // Create a map for quick lookup
    const statsMap = new Map<number, typeof numberStats[0]>();
    numberStats.forEach((stat) => statsMap.set(stat.num, stat));

    const results: DelayStats[] = [];

    // Process all numbers 1-60
    for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
      const stat = statsMap.get(num);
      const totalOccurrences = stat?.total_occurrences || 0;
      const lastDrawnContest = stat?.last_contest || null;
      const lastDrawnDate = stat?.last_date || null;

      const delayDraws = lastDrawnContest ? latestContest - lastDrawnContest : latestContest;

      // Calculate expected average delay between occurrences
      // Formula: totalDraws / frequency = expected draws per occurrence
      // This represents how often we statistically expect to see this number
      // Note: For uniform distribution, expected value is totalDraws / (60/6) = totalDraws / 10
      const averageDelay = totalOccurrences > 0
        ? latestContest / totalOccurrences
        : latestContest;

      // Categorize delay
      let delayCategory: DelayStats['delayCategory'];
      if (delayDraws <= 5) {
        delayCategory = 'recent';
      } else if (delayDraws <= averageDelay) {
        delayCategory = 'normal';
      } else if (delayDraws <= averageDelay * 1.5) {
        delayCategory = 'overdue';
      } else {
        delayCategory = 'critical';
      }

      results.push({
        number: num,
        delayDraws,
        lastDrawnContest,
        lastDrawnDate,
        averageDelay: Math.round(averageDelay),
        delayCategory,
      });
    }

    return results.sort((a, b) => b.delayDraws - a.delayDraws);
  }

  getDelayDistribution(): Array<{ category: string; count: number }> {
    const delays = this.getNumberDelays();
    
    const distribution = {
      recent: 0,
      normal: 0,
      overdue: 0,
      critical: 0,
    };

    delays.forEach((d) => {
      distribution[d.delayCategory]++;
    });

    return [
      { category: 'Recente (≤5)', count: distribution.recent },
      { category: 'Normal', count: distribution.normal },
      { category: 'Atrasado', count: distribution.overdue },
      { category: 'Crítico', count: distribution.critical },
    ];
  }
}

