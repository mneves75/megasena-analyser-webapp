import { getDatabase } from '@/lib/db';
import { MEGASENA_CONSTANTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { roundTo } from '@/lib/utils';

export interface PairStats {
  pair: [number, number];
  frequency: number;
  expectedFrequency: number;
  correlation: number;
  lastSeenContest: number | null;
  lastSeenDate: string | null;
}

/**
 * Expected number of draws in which two specific numbers co-occur.
 *
 * `freq1`/`freq2` are how many draws each number appeared in, so
 * `freq / totalDraws` is that number's per-draw marginal probability. Drawing is
 * WITHOUT replacement from 60 balls, which is what the two correction factors
 * capture: once the first number occupies a slot, only 5 of the remaining slots
 * and 59 of the remaining balls are available to the second.
 *
 * Under a uniform history this reduces exactly to the hypergeometric value
 * `totalDraws * (6/60) * (5/59)` — 25.73 over 3.036 draws. The previous form,
 * `(freq/(totalDraws*6))^2 * totalDraws * 15`, returned 12.65 for the same input
 * and therefore inflated every displayed correlation by about 2,03x, making
 * independent pairs look positively correlated.
 */
export function expectedPairFrequency(
  freq1: number,
  freq2: number,
  totalDraws: number
): number {
  if (totalDraws <= 0) {
    return 0;
  }

  const perDraw1 = freq1 / totalDraws;
  const perDraw2 = freq2 / totalDraws;
  const slotsAfterFirst =
    (MEGASENA_CONSTANTS.NUMBERS_PER_BET - 1) / MEGASENA_CONSTANTS.NUMBERS_PER_BET;
  const ballsAfterFirst = MEGASENA_CONSTANTS.MAX_NUMBER / (MEGASENA_CONSTANTS.MAX_NUMBER - 1);

  return totalDraws * perDraw1 * perDraw2 * slotsAfterFirst * ballsAfterFirst;
}

export class PairAnalysisEngine {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  updatePairFrequencies(): void {
    const savepointName = 'update_pair_frequencies';
    try {
      // Atomic rebuild using a savepoint so we do not destroy an outer transaction
      // if this function is called inside one.
      this.db.exec(`SAVEPOINT ${savepointName}`);
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
      const frequencyByNumber = this.getNumberFrequencyMap();

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
        const freq1 = frequencyByNumber.get(num1) ?? 0;
        const freq2 = frequencyByNumber.get(num2) ?? 0;
        const expectedFrequency = expectedPairFrequency(freq1, freq2, totalDraws);
        const correlation = expectedFrequency > 0 ? data.frequency / expectedFrequency : 0;
        
        insertStmt.run(num1, num2, data.frequency, correlation, data.lastContest, data.lastDate);
      }

      this.db.exec(`RELEASE ${savepointName}`);
    } catch (error) {
      try {
        this.db.exec(`ROLLBACK TO ${savepointName}`);
        this.db.exec(`RELEASE ${savepointName}`);
      } catch {
        // Ignore rollback errors when no savepoint was started.
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update pair frequencies: ${errorMessage}`);
    }
  }

  getNumberPairs(minOccurrences: number = 1): PairStats[] {
    const cacheCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM number_pair_frequency').get() as {
        count: number;
      }
    ).count;

    if (cacheCount === 0) {
      logger.warn('analytics.pair_cache_empty', {
        action: 'run_pair_frequency_ingestion',
      });
      return [];
    }

    // Get individual number frequencies for expected calculation
    const totalDraws = (
      this.db.prepare('SELECT COUNT(*) as count FROM draws').get() as { count: number }
    ).count;
    const frequencyByNumber = this.getNumberFrequencyMap();

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
      const freq1 = frequencyByNumber.get(pair.number_1) ?? 0;
      const freq2 = frequencyByNumber.get(pair.number_2) ?? 0;
      const expectedFrequency = expectedPairFrequency(freq1, freq2, totalDraws);

      // Derive the correlation from the expectation shown next to it instead of
      // reading the cached column: a cache written by an older formula would
      // otherwise be displayed beside a freshly computed expectation, and the
      // two would not divide out to the number on screen.
      const correlation = expectedFrequency > 0 ? pair.frequency / expectedFrequency : 0;

      return {
        pair: [pair.number_1, pair.number_2],
        frequency: pair.frequency,
        expectedFrequency: roundTo(expectedFrequency),
        correlation: roundTo(correlation),
        lastSeenContest: pair.last_occurred_contest,
        lastSeenDate: pair.last_occurred_date,
      };
    });
  }

  private getNumberFrequencyMap(): Map<number, number> {
    // Compute from draws directly: depending on the number_frequency cache table
    // here would let a stale/empty cache persist wrong expected frequencies.
    const rows = this.db
      .prepare(
        `WITH all_occurrences AS (
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
         GROUP BY number`
      )
      .all() as Array<{ number: number; frequency: number }>;
    return new Map(rows.map((row) => [row.number, row.frequency] as const));
  }

  getTopPairsForNumber(number: number, limit: number = 10): PairStats[] {
    const allPairs = this.getNumberPairs(1);
    return allPairs
      .filter((pair) => pair.pair.includes(number))
      .slice(0, limit);
  }
}
