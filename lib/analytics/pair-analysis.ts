import { getDatabase } from '@/lib/db';
import { roundTo } from '@/lib/utils';

export interface PairStats {
  pair: [number, number];
  frequency: number;
  expectedFrequency: number;
  correlation: number;
  lastSeenContest: number | null;
  lastSeenDate: string | null;
}

export class PairAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  updatePairFrequencies(): void {
    try {
      // Clear existing cache
      this.db.prepare('DELETE FROM number_pair_frequency').run();

      // Get all draws
      const draws = this.db
        .prepare(
          `SELECT 
            number_1, number_2, number_3, number_4, number_5, number_6,
            contest_number, draw_date
           FROM draws
           ORDER BY contest_number DESC`
        )
        .all() as Array<{
        number_1: number;
        number_2: number;
        number_3: number;
        number_4: number;
        number_5: number;
        number_6: number;
        contest_number: number;
        draw_date: string;
      }>;

      // Map to store pair frequencies
      const pairMap = new Map<string, { frequency: number; lastContest: number; lastDate: string }>();

      // Process each draw
      for (const draw of draws) {
        const numbers = [
          draw.number_1,
          draw.number_2,
          draw.number_3,
          draw.number_4,
          draw.number_5,
          draw.number_6,
        ];

        // Generate all pairs (combinations)
        for (let i = 0; i < numbers.length; i++) {
          for (let j = i + 1; j < numbers.length; j++) {
            const first = numbers[i];
            const second = numbers[j];
            if (first === undefined || second === undefined) {
              continue;
            }
            const num1 = Math.min(first, second);
            const num2 = Math.max(first, second);
            const key = `${num1}-${num2}`;

            const existing = pairMap.get(key);
            if (existing) {
              existing.frequency++;
              // Keep the most recent occurrence
              if (draw.contest_number > existing.lastContest) {
                existing.lastContest = draw.contest_number;
                existing.lastDate = draw.draw_date;
              }
            } else {
              pairMap.set(key, {
                frequency: 1,
                lastContest: draw.contest_number,
                lastDate: draw.draw_date,
              });
            }
          }
        }
      }

      // Calculate total draws for correlation
      const totalDraws = draws.length;

      // Insert into database with correlation
      const insertStmt = this.db.prepare(
        `INSERT INTO number_pair_frequency 
         (number_1, number_2, frequency, correlation, last_occurred_contest, last_occurred_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      );

      for (const [key, data] of pairMap.entries()) {
        const [num1Raw, num2Raw] = key.split('-');
        const num1 = Number(num1Raw);
        const num2 = Number(num2Raw);
        if (!Number.isFinite(num1) || !Number.isFinite(num2)) {
          continue;
        }
        
        // Calculate correlation: actual frequency vs expected frequency
        const freq1 = this.getNumberFrequency(num1);
        const freq2 = this.getNumberFrequency(num2);
        const prob1 = freq1 / (totalDraws * 6);
        const prob2 = freq2 / (totalDraws * 6);
        const expectedFrequency = prob1 * prob2 * totalDraws * 15; // 15 pairs per draw
        const correlation = expectedFrequency > 0 ? data.frequency / expectedFrequency : 0;
        
        insertStmt.run(num1, num2, data.frequency, correlation, data.lastContest, data.lastDate);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update pair frequencies: ${errorMessage}`);
    }
  }

  getNumberPairs(minOccurrences: number = 1): PairStats[] {
    // Check if cache is populated with transaction to prevent race conditions
    try {
      this.db.exec('BEGIN IMMEDIATE TRANSACTION');
      
      const cacheCount = (
        this.db.prepare('SELECT COUNT(*) as count FROM number_pair_frequency').get() as {
          count: number;
        }
      ).count;

      if (cacheCount === 0) {
        // Cache is empty, populate it
        this.updatePairFrequencies();
      }
      
      this.db.exec('COMMIT');
    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Transaction was already rolled back by SQLite
      }
      throw error;
    }

    // Get individual number frequencies for expected calculation
    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;

    const pairs = this.db
      .prepare(
        `SELECT 
          number_1, number_2, frequency, correlation,
          last_occurred_contest, last_occurred_date
         FROM number_pair_frequency
         WHERE frequency >= ?
         ORDER BY frequency DESC
         LIMIT 50`
      )
      .all(minOccurrences) as Array<{
      number_1: number;
      number_2: number;
      frequency: number;
      correlation: number;
      last_occurred_contest: number | null;
      last_occurred_date: string | null;
    }>;

    return pairs.map((pair) => {
      // Calculate expected frequency for display (correlation is already cached)
      const freq1 = this.getNumberFrequency(pair.number_1);
      const freq2 = this.getNumberFrequency(pair.number_2);
      const prob1 = freq1 / (totalDraws * 6);
      const prob2 = freq2 / (totalDraws * 6);
      const expectedFrequency = prob1 * prob2 * totalDraws * 15; // 15 pairs per draw (6 choose 2)

      return {
        pair: [pair.number_1, pair.number_2],
        frequency: pair.frequency,
        expectedFrequency: roundTo(expectedFrequency),
        correlation: roundTo(pair.correlation),
        lastSeenContest: pair.last_occurred_contest,
        lastSeenDate: pair.last_occurred_date,
      };
    });
  }

  private getNumberFrequency(num: number): number {
    let frequency = 0;
    for (let col = 1; col <= 6; col++) {
      const count = (
        this.db
          .prepare(`SELECT COUNT(*) as count FROM draws WHERE number_${col} = ?`)
          .get(num) as { count: number }
      ).count;
      frequency += count;
    }
    return frequency;
  }

  getTopPairsForNumber(number: number, limit: number = 10): PairStats[] {
    const allPairs = this.getNumberPairs(1);
    return allPairs
      .filter((pair) => pair.pair.includes(number))
      .slice(0, limit);
  }
}
