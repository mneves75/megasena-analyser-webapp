import { getDatabase } from '@/lib/db';
import { CHART_CONFIG } from '@/lib/constants';
import { roundTo } from '@/lib/utils';

export interface StreakStats {
  number: number;
  recentOccurrences: number;
  overallFrequency: number;
  trend: 'hot' | 'normal' | 'cold';
  streakIntensity: number;
  lastDrawnContest: number | null;
}

export class StreakAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;
  private windowSize: number;

  constructor(windowSize: number = CHART_CONFIG.DEFAULT_STREAK_WINDOW) {
    this.db = getDatabase();
    this.windowSize = windowSize;
  }

  getHotStreaks(): StreakStats[] {
    // Get the most recent N draws
    const recentDraws = this.db
      .prepare(
        `SELECT 
          number_1, number_2, number_3, number_4, number_5, number_6,
          contest_number
         FROM draws
         ORDER BY contest_number DESC
         LIMIT ?`
      )
      .all(this.windowSize) as Array<{
      number_1: number;
      number_2: number;
      number_3: number;
      number_4: number;
      number_5: number;
      number_6: number;
      contest_number: number;
    }>;

    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;

    // Build frequency map in single pass through recent draws (optimized)
    const recentFrequency = new Map<
      number,
      { count: number; lastContest: number | null }
    >();

    for (const draw of recentDraws) {
      const numbers = [
        draw.number_1,
        draw.number_2,
        draw.number_3,
        draw.number_4,
        draw.number_5,
        draw.number_6,
      ];

      for (const num of numbers) {
        const existing = recentFrequency.get(num);
        if (existing) {
          existing.count++;
          if (!existing.lastContest || draw.contest_number > existing.lastContest) {
            existing.lastContest = draw.contest_number;
          }
        } else {
          recentFrequency.set(num, { count: 1, lastContest: draw.contest_number });
        }
      }
    }

    // Get overall frequencies in single optimized query
    const overallQuery = `
      WITH all_occurrences AS (
        SELECT number_1 as num FROM draws
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
      SELECT num, COUNT(*) as frequency
      FROM all_occurrences
      GROUP BY num
    `;

    const overallFrequencies = this.db.prepare(overallQuery).all() as Array<{
      num: number;
      frequency: number;
    }>;

    const overallMap = new Map<number, number>();
    overallFrequencies.forEach((row) => overallMap.set(row.num, row.frequency));

    const results: StreakStats[] = [];

    // Now process all 60 numbers (single iteration)
    for (let num = 1; num <= 60; num++) {
      const recent = recentFrequency.get(num);
      const recentOccurrences = recent?.count || 0;
      const lastDrawnContest = recent?.lastContest || null;
      const overallFrequency = overallMap.get(num) || 0;

      // Calculate expected occurrences in recent window
      const overallRate = overallFrequency / totalDraws;
      const expectedRecent = overallRate * this.windowSize;

      // Calculate streak intensity (actual / expected)
      const streakIntensity = expectedRecent > 0 ? recentOccurrences / expectedRecent : 0;

      // Determine trend
      let trend: StreakStats['trend'];
      if (streakIntensity >= 1.5) {
        trend = 'hot';
      } else if (streakIntensity <= 0.5) {
        trend = 'cold';
      } else {
        trend = 'normal';
      }

      results.push({
        number: num,
        recentOccurrences,
        overallFrequency,
        trend,
        streakIntensity: roundTo(streakIntensity),
        lastDrawnContest,
      });
    }

    // Sort by streak intensity (hottest first)
    return results.sort((a, b) => b.streakIntensity - a.streakIntensity);
  }

  getHotNumbers(limit: number = 10): StreakStats[] {
    const allStreaks = this.getHotStreaks();
    return allStreaks.filter((s) => s.trend === 'hot').slice(0, limit);
  }

  getColdNumbers(limit: number = 10): StreakStats[] {
    const allStreaks = this.getHotStreaks();
    return allStreaks.filter((s) => s.trend === 'cold').slice(0, limit);
  }
}

