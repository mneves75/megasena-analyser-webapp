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
    const latestContest = (
      this.db
        .prepare('SELECT MAX(contest_number) as max FROM draws')
        .get() as { max: number }
    ).max;

    const results: DelayStats[] = [];

    for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
      // Get last occurrence
      let lastDrawn: { contest_number: number; draw_date: string } | null = null;
      let totalOccurrences = 0;

      for (let col = 1; col <= 6; col++) {
        const lastOccurrence = this.db
          .prepare(
            `SELECT contest_number, draw_date
             FROM draws
             WHERE number_${col} = ?
             ORDER BY contest_number DESC
             LIMIT 1`
          )
          .get(num) as { contest_number: number; draw_date: string } | undefined;

        if (lastOccurrence && (!lastDrawn || lastOccurrence.contest_number > lastDrawn.contest_number)) {
          lastDrawn = lastOccurrence;
        }

        // Count total occurrences
        const count = (
          this.db
            .prepare(`SELECT COUNT(*) as count FROM draws WHERE number_${col} = ?`)
            .get(num) as { count: number }
        ).count;
        totalOccurrences += count;
      }

      const delayDraws = lastDrawn ? latestContest - lastDrawn.contest_number : latestContest;
      const averageDelay = totalOccurrences > 0 ? latestContest / totalOccurrences : latestContest;

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
        lastDrawnContest: lastDrawn?.contest_number || null,
        lastDrawnDate: lastDrawn?.draw_date || null,
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

