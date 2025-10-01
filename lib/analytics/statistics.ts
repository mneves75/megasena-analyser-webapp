import { getDatabase } from '@/lib/db';
import { MEGASENA_CONSTANTS, STATISTICS_DISPLAY } from '@/lib/constants';

// Pre-generated safe SQL queries to avoid string interpolation
const NUMBER_COLUMN_COUNT_QUERIES = Array.from(
  { length: 6 },
  (_, i) => `SELECT COUNT(*) as count FROM draws WHERE number_${i + 1} = ?`
);

const NUMBER_COLUMN_LAST_DRAWN_QUERIES = Array.from(
  { length: 6 },
  (_, i) =>
    `SELECT contest_number, draw_date FROM draws WHERE number_${i + 1} = ? ORDER BY contest_number DESC LIMIT 1`
);

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
      // Begin transaction to ensure atomicity
      // If any part fails, the entire update is rolled back
      this.db.exec('BEGIN IMMEDIATE TRANSACTION');
      
      try {
        // Reset frequencies
        this.db.prepare('UPDATE number_frequency SET frequency = 0').run();

        // Count occurrences for each number
        for (let num = MEGASENA_CONSTANTS.MIN_NUMBER; num <= MEGASENA_CONSTANTS.MAX_NUMBER; num++) {
          let frequency = 0;
          let lastContest: number | null = null;
          let lastDate: string | null = null;

          // Count occurrences across all number columns using pre-generated safe queries
          for (let col = 0; col < 6; col++) {
            // Count ALL occurrences in this column
            const countResult = this.db
              .prepare(NUMBER_COLUMN_COUNT_QUERIES[col])
              .get(num) as { count: number };

            frequency += countResult.count;

            // Separately get the last drawn info
            const lastDrawn = this.db
              .prepare(NUMBER_COLUMN_LAST_DRAWN_QUERIES[col])
              .get(num) as { contest_number: number; draw_date: string } | undefined;

            if (lastDrawn && (!lastContest || lastDrawn.contest_number > lastContest)) {
              lastContest = lastDrawn.contest_number;
              lastDate = lastDrawn.draw_date;
            }
          }

          // Update frequency table
          this.db
            .prepare(
              `UPDATE number_frequency
               SET frequency = ?,
                   last_drawn_contest = ?,
                   last_drawn_date = ?,
                   updated_at = CURRENT_TIMESTAMP
               WHERE number = ?`
            )
            .run(frequency, lastContest, lastDate, num);
        }
        
        // Commit transaction if all updates succeeded
        this.db.exec('COMMIT');
      } catch (innerError) {
        // Rollback transaction on any error
        this.db.exec('ROLLBACK');
        throw innerError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update number frequencies: ${errorMessage}`);
    }
  }

  getDrawStatistics(): DrawStatistics {
    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;

    const lastDraw = this.db
      .prepare('SELECT contest_number, draw_date FROM draws ORDER BY contest_number DESC LIMIT 1')
      .get() as { contest_number: number; draw_date: string } | undefined;

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
      lastDrawDate: lastDraw?.draw_date || null,
      lastContestNumber: lastDraw?.contest_number || null,
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
        MAX(draw_date) as last_seen
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
        MAX(draw_date) as last_seen
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

