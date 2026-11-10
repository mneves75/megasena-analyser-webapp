import { getDatabase } from '@/lib/db';
import { withDatabaseTransaction } from '@/lib/db-transaction';
import { MEGASENA_CONSTANTS, STATISTICS_DISPLAY } from '@/lib/constants';

export interface NumberFrequency {
  number: number;
  frequency: number;
  lastDrawnContest: number | null;
  lastDrawnDate: string | null;
}

export interface DrawStatistics {
  totalDraws: number;
  lastDrawDate: string | null;
  lastContestNumber: number | null;
  mostFrequentNumbers: NumberFrequency[];
  leastFrequentNumbers: NumberFrequency[];
  averagePrizeSena: number;
  averagePrizeQuina: number;
  accumulatedCount: number;
  accumulationRate: number;
}

export interface Pattern {
  type: string;
  description: string;
  occurrences: number;
  lastSeen: string | null;
}

export class StatisticsEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  getNumberFrequencies(): NumberFrequency[] {
    return this.db
      .prepare(
        `SELECT 
          number, 
          frequency, 
          last_drawn_contest as lastDrawnContest, 
          last_drawn_date as lastDrawnDate
         FROM number_frequency 
         ORDER BY frequency DESC`
      )
      .all() as NumberFrequency[];
  }

  updateNumberFrequencies(): void {
    try {
      // Preserve the outer transaction while rebuilding this cache atomically.
      withDatabaseTransaction(this.db, () => {

        // One pass over the six number columns: occurrences and the latest
        // contest per number, joined back to that contest for its date.
        const aggregates = this.db
          .prepare(
            `WITH drawn(number, contest_number) AS (
               SELECT number_1, contest_number FROM draws
               UNION ALL SELECT number_2, contest_number FROM draws
               UNION ALL SELECT number_3, contest_number FROM draws
               UNION ALL SELECT number_4, contest_number FROM draws
               UNION ALL SELECT number_5, contest_number FROM draws
               UNION ALL SELECT number_6, contest_number FROM draws
             ), totals AS (
               SELECT number, COUNT(*) AS frequency, MAX(contest_number) AS last_contest
               FROM drawn GROUP BY number
             )
             SELECT totals.number, totals.frequency, totals.last_contest, draws.draw_date AS last_date
             FROM totals JOIN draws ON draws.contest_number = totals.last_contest`
          )
          .all() as Array<{ number: number; frequency: number; last_contest: number; last_date: string }>;
        const byNumber = new Map(aggregates.map((row) => [row.number, row]));
        const updateStatement = this.db.prepare(
          `UPDATE number_frequency
           SET frequency = ?,
               last_drawn_contest = ?,
               last_drawn_date = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE number = ?`
        );

        // Every number is written, so a number no longer drawn resets to 0/NULL.
        for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
          const row = byNumber.get(num);
          updateStatement.run(row?.frequency ?? 0, row?.last_contest ?? null, row?.last_date ?? null, num);
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update number frequencies: ${errorMessage}`);
    }
  }

  /** Draw count and latest draw: all the health check needs. */
  getDrawSummary(): Pick<DrawStatistics, 'totalDraws' | 'lastDrawDate' | 'lastContestNumber'> {
    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;

    const lastDraw = this.db
      .prepare('SELECT contest_number, draw_date FROM draws ORDER BY contest_number DESC LIMIT 1')
      .get() as { contest_number: number; draw_date: string } | undefined;

    return {
      totalDraws,
      lastDrawDate: lastDraw?.draw_date || null,
      lastContestNumber: lastDraw?.contest_number || null,
    };
  }

  getDrawStatistics(): DrawStatistics {
    const { totalDraws, lastDrawDate, lastContestNumber } = this.getDrawSummary();

    const frequencies = this.getNumberFrequencies();
    const mostFrequent = frequencies.slice(0, STATISTICS_DISPLAY.DASHBOARD_TOP_COUNT);
    const leastFrequent = [...frequencies].reverse().slice(0, STATISTICS_DISPLAY.DASHBOARD_TOP_COUNT);

    const avgSena = (
      this.db
        .prepare('SELECT AVG(prize_sena) as avg FROM draws WHERE prize_sena > 0')
        .get() as { avg: number | null }
    ).avg || 0;

    const avgQuina = (
      this.db
        .prepare('SELECT AVG(prize_quina) as avg FROM draws WHERE prize_quina > 0')
        .get() as { avg: number | null }
    ).avg || 0;

    const accumulated = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws WHERE accumulated = 1').get() as {
        count: number;
      }
    ).count;

    return {
      totalDraws,
      lastDrawDate,
      lastContestNumber,
      mostFrequentNumbers: mostFrequent,
      leastFrequentNumbers: leastFrequent,
      averagePrizeSena: avgSena,
      averagePrizeQuina: avgQuina,
      accumulatedCount: accumulated,
      accumulationRate: totalDraws > 0 ? (accumulated / totalDraws) * 100 : 0,
    };
  }

  detectPatterns(): Pattern[] {
    const patterns: Pattern[] = [];

    // Consecutive numbers pattern
    const consecutiveQuery = `
      SELECT 
        COUNT(*) as occurrences,
        (
          SELECT draw_date
          FROM draws AS latest
          WHERE
            (latest.number_2 = latest.number_1 + 1) OR
            (latest.number_3 = latest.number_2 + 1) OR
            (latest.number_4 = latest.number_3 + 1) OR
            (latest.number_5 = latest.number_4 + 1) OR
            (latest.number_6 = latest.number_5 + 1)
          ORDER BY latest.contest_number DESC
          LIMIT 1
        ) as last_seen
      FROM draws
      WHERE 
        (number_2 = number_1 + 1) OR
        (number_3 = number_2 + 1) OR
        (number_4 = number_3 + 1) OR
        (number_5 = number_4 + 1) OR
        (number_6 = number_5 + 1)
    `;

    const consecutive = this.db.prepare(consecutiveQuery).get() as {
      occurrences: number;
      last_seen: string | null;
    };

    patterns.push({
      type: 'consecutive',
      description: 'Números consecutivos no sorteio',
      occurrences: consecutive.occurrences,
      lastSeen: consecutive.last_seen,
    });

    // Even/Odd distribution patterns
    const evenOddQuery = `
      SELECT 
        COUNT(*) as occurrences,
        (
          SELECT draw_date
          FROM draws AS latest
          WHERE
            latest.number_1 % 2 = 0 AND latest.number_2 % 2 = 0 AND
            latest.number_3 % 2 = 0 AND latest.number_4 % 2 = 0 AND
            latest.number_5 % 2 = 0 AND latest.number_6 % 2 = 0
          ORDER BY latest.contest_number DESC
          LIMIT 1
        ) as last_seen
      FROM draws
      WHERE 
        (number_1 % 2 = 0 AND number_2 % 2 = 0 AND number_3 % 2 = 0 AND 
         number_4 % 2 = 0 AND number_5 % 2 = 0 AND number_6 % 2 = 0)
    `;

    const allEven = this.db.prepare(evenOddQuery).get() as {
      occurrences: number;
      last_seen: string | null;
    };

    patterns.push({
      type: 'all_even',
      description: 'Todos os números pares',
      occurrences: allEven.occurrences,
      lastSeen: allEven.last_seen,
    });

    return patterns;
  }

  getDrawHistory(limit: number = STATISTICS_DISPLAY.RECENT_DRAWS_DEFAULT): Array<{
    contestNumber: number;
    drawDate: string;
    numbers: number[];
    prizeSena: number;
    accumulated: boolean;
  }> {
    const draws = this.db
      .prepare(
        `SELECT 
          contest_number as contestNumber,
          draw_date as drawDate,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena as prizeSena,
          accumulated
         FROM draws 
         ORDER BY contest_number DESC 
         LIMIT ?`
      )
      .all(limit) as Array<{
      contestNumber: number;
      drawDate: string;
      number_1: number;
      number_2: number;
      number_3: number;
      number_4: number;
      number_5: number;
      number_6: number;
      prizeSena: number;
      accumulated: boolean;
    }>;

    return draws.map((draw) => ({
      contestNumber: draw.contestNumber,
      drawDate: draw.drawDate,
      numbers: [
        draw.number_1,
        draw.number_2,
        draw.number_3,
        draw.number_4,
        draw.number_5,
        draw.number_6,
      ],
      prizeSena: draw.prizeSena,
      accumulated: Boolean(draw.accumulated),
    }));
  }
}
