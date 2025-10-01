import { getDatabase } from '@/lib/db';
import { CHART_CONFIG } from '@/lib/constants';

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

    const results: StreakStats[] = [];

    // Analyze each number
    for (let num = 1; num <= 60; num++) {
      // Count recent occurrences
      let recentOccurrences = 0;
      let lastDrawnContest: number | null = null;

      for (const draw of recentDraws) {
        const numbers = [
          draw.number_1,
          draw.number_2,
          draw.number_3,
          draw.number_4,
          draw.number_5,
          draw.number_6,
        ];

        if (numbers.includes(num)) {
          recentOccurrences++;
          if (!lastDrawnContest || draw.contest_number > lastDrawnContest) {
            lastDrawnContest = draw.contest_number;
          }
        }
      }

      // Get overall frequency
      let overallFrequency = 0;
      for (let col = 1; col <= 6; col++) {
        const count = (
          this.db
            .prepare(`SELECT COUNT(*) as count FROM draws WHERE number_${col} = ?`)
            .get(num) as { count: number }
        ).count;
        overallFrequency += count;
      }

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
        streakIntensity: Math.round(streakIntensity * 100) / 100,
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

