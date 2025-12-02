import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DelayAnalysisEngine } from '@/lib/analytics/delay-analysis';
import { getDatabase, runMigrations } from '@/lib/db';
import { MEGASENA_CONSTANTS } from '@/lib/constants';

// Check if running with in-memory database (Vitest without Bun)
const isInMemoryDb = typeof process !== 'undefined' &&
  Boolean(process.env?.VITEST) &&
  typeof globalThis.Bun === 'undefined';

// Skip tests that require complex SQL features not supported by in-memory DB
const describeWithDb = isInMemoryDb ? describe.skip : describe;

describeWithDb('DelayAnalysisEngine', () => {
  let delayEngine: DelayAnalysisEngine;
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    runMigrations();
    db = getDatabase();
  });

  beforeEach(() => {
    // Clear draws table for clean state
    db.prepare('DELETE FROM draws').run();
    delayEngine = new DelayAnalysisEngine();
  });

  describe('getNumberDelays', () => {
    it('should return empty array when no draws exist', () => {
      const delays = delayEngine.getNumberDelays();
      expect(delays).toHaveLength(0);
    });

    it('should return all 60 numbers when draws exist', () => {
      // Insert at least one draw so we have a valid latestContest
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);

      const delays = delayEngine.getNumberDelays();
      expect(delays).toHaveLength(MEGASENA_CONSTANTS.MAX_NUMBER);
    });

    it('should calculate correct delay for number that never appeared', () => {
      // Insert draws without number 60
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);
      insertTestDraw(db, 2, '2025-01-08', [7, 8, 9, 10, 11, 12]);
      insertTestDraw(db, 3, '2025-01-15', [13, 14, 15, 16, 17, 18]);

      const delays = delayEngine.getNumberDelays();
      const num60Delay = delays.find((d) => d.number === 60);

      // Number 60 never appeared, delay should equal latestContest (3)
      expect(num60Delay?.delayDraws).toBe(3);
      expect(num60Delay?.lastDrawnContest).toBeNull();
      expect(num60Delay?.lastDrawnDate).toBeNull();
    });

    it('should calculate correct delay for recently drawn number', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);
      insertTestDraw(db, 2, '2025-01-08', [7, 8, 9, 10, 11, 12]);
      insertTestDraw(db, 3, '2025-01-15', [1, 13, 14, 15, 16, 17]);

      const delays = delayEngine.getNumberDelays();
      const num1Delay = delays.find((d) => d.number === 1);

      // Number 1 appeared in contest 3 (latest), so delay = 0
      expect(num1Delay?.delayDraws).toBe(0);
      expect(num1Delay?.lastDrawnContest).toBe(3);
    });

    it('should calculate correct average delay using totalDraws/frequency formula', () => {
      // Insert 10 draws where number 1 appears 5 times
      // Expected average delay: 10 / 5 = 2 draws between appearances
      const draws = [
        { contest: 1, numbers: [1, 2, 3, 4, 5, 6] },
        { contest: 2, numbers: [1, 7, 8, 9, 10, 11] },
        { contest: 3, numbers: [12, 13, 14, 15, 16, 17] },
        { contest: 4, numbers: [18, 19, 20, 21, 22, 23] },
        { contest: 5, numbers: [1, 24, 25, 26, 27, 28] },
        { contest: 6, numbers: [29, 30, 31, 32, 33, 34] },
        { contest: 7, numbers: [35, 36, 37, 38, 39, 40] },
        { contest: 8, numbers: [1, 41, 42, 43, 44, 45] },
        { contest: 9, numbers: [46, 47, 48, 49, 50, 51] },
        { contest: 10, numbers: [1, 52, 53, 54, 55, 56] },
      ];

      draws.forEach((draw, idx) => {
        insertTestDraw(db, draw.contest, `2025-01-${String(idx + 1).padStart(2, '0')}`, draw.numbers);
      });

      const delays = delayEngine.getNumberDelays();
      const num1Delay = delays.find((d) => d.number === 1);

      // Number 1 appeared 5 times in 10 draws
      // averageDelay = 10 / 5 = 2
      expect(num1Delay?.averageDelay).toBe(2);
    });

    it('should correctly categorize delay as recent', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);
      insertTestDraw(db, 2, '2025-01-08', [1, 7, 8, 9, 10, 11]);
      insertTestDraw(db, 3, '2025-01-15', [12, 13, 14, 15, 16, 17]);

      const delays = delayEngine.getNumberDelays();
      const num1Delay = delays.find((d) => d.number === 1);

      // Number 1 last appeared in contest 2, current is 3, delay = 1 (recent <= 5)
      expect(num1Delay?.delayDraws).toBe(1);
      expect(num1Delay?.delayCategory).toBe('recent');
    });

    it('should correctly categorize delay as overdue', () => {
      // Create scenario where a number is overdue
      // Insert 20 draws where number 1 only appears in first 2
      for (let i = 1; i <= 20; i++) {
        const numbers = i <= 2
          ? [1, 2, 3, 4, 5, 6]
          : [7 + i, 8 + i, 9 + i, 10 + i, 11 + i, 12 + i];
        insertTestDraw(db, i, `2025-01-${String(i).padStart(2, '0')}`, numbers);
      }

      const delays = delayEngine.getNumberDelays();
      const num1Delay = delays.find((d) => d.number === 1);

      // Number 1 appeared 2 times, averageDelay = 20/2 = 10
      // Last appeared in contest 2, current is 20, delay = 18
      // 18 > 10 * 1.5 = 15, so should be 'critical' or 'overdue'
      expect(num1Delay?.delayDraws).toBe(18);
      expect(['overdue', 'critical']).toContain(num1Delay?.delayCategory);
    });

    it('should return delays sorted by delayDraws descending', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);
      insertTestDraw(db, 2, '2025-01-08', [1, 7, 8, 9, 10, 11]);
      insertTestDraw(db, 3, '2025-01-15', [12, 13, 14, 15, 16, 17]);

      const delays = delayEngine.getNumberDelays();

      // Verify sorting: most delayed numbers should come first
      for (let i = 0; i < delays.length - 1; i++) {
        expect(delays[i].delayDraws).toBeGreaterThanOrEqual(delays[i + 1].delayDraws);
      }
    });
  });

  describe('getDelayDistribution', () => {
    it('should return all 4 categories', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);

      const distribution = delayEngine.getDelayDistribution();

      expect(distribution).toHaveLength(4);
      expect(distribution.map((d) => d.category)).toEqual(
        expect.arrayContaining([
          'Recente (<=5)',
          'Normal',
          'Atrasado',
          'Critico',
        ].map(expect.stringMatching))
      );
    });

    it('should count all 60 numbers across categories', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);

      const distribution = delayEngine.getDelayDistribution();
      const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);

      expect(totalCount).toBe(MEGASENA_CONSTANTS.MAX_NUMBER);
    });
  });

  describe('edge cases', () => {
    it('should handle single draw correctly', () => {
      insertTestDraw(db, 1, '2025-01-01', [1, 2, 3, 4, 5, 6]);

      const delays = delayEngine.getNumberDelays();
      const num1Delay = delays.find((d) => d.number === 1);

      // Single draw: averageDelay = 1/1 = 1
      expect(num1Delay?.averageDelay).toBe(1);
      expect(num1Delay?.delayDraws).toBe(0);
    });

    it('should handle number appearing in all positions', () => {
      // Number 5 appears multiple times per draw (edge case, shouldn't happen in real data)
      insertTestDraw(db, 1, '2025-01-01', [5, 5, 5, 5, 5, 5]);

      const delays = delayEngine.getNumberDelays();
      const num5Delay = delays.find((d) => d.number === 5);

      // Number 5 counted 6 times, but appears in 1 draw
      // averageDelay = 1/6 (rounded)
      expect(num5Delay?.delayDraws).toBe(0);
    });
  });
});

/**
 * Helper function to insert a test draw
 */
function insertTestDraw(
  db: ReturnType<typeof getDatabase>,
  contest: number,
  date: string,
  numbers: number[]
): void {
  db.prepare(`
    INSERT INTO draws (
      contest_number, draw_date,
      number_1, number_2, number_3, number_4, number_5, number_6,
      prize_sena, winners_sena
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `).run(contest, date, ...numbers);
}
