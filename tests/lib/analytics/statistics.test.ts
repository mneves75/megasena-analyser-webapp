import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { getDatabase, runMigrations } from '@/lib/db';
import { MEGASENA_CONSTANTS, STATISTICS_DISPLAY } from '@/lib/constants';

describe('StatisticsEngine', () => {
  let stats: StatisticsEngine;
  let db: ReturnType<typeof getDatabase>;

  beforeAll(() => {
    runMigrations();
    db = getDatabase();
  });

  beforeEach(() => {
    // Clear draws table for clean state
    db.prepare('DELETE FROM draws').run();
    db.prepare('DELETE FROM number_frequency').run();

    // Re-initialize frequency table
    for (let num = 1; num <= 60; num++) {
      db.prepare(
        'INSERT INTO number_frequency (number, frequency) VALUES (?, 0)'
      ).run(num);
    }

    stats = new StatisticsEngine();
  });

  describe('updateNumberFrequencies', () => {
    it('should correctly count number frequencies across all draws', () => {
      // Insert test draws
      const testDraws = [
        { contest: 1, date: '2025-01-01', numbers: [1, 2, 3, 4, 5, 6] },
        { contest: 2, date: '2025-01-08', numbers: [1, 7, 8, 9, 10, 11] },
        { contest: 3, date: '2025-01-15', numbers: [1, 12, 13, 14, 15, 16] },
      ];

      testDraws.forEach((draw) => {
        db.prepare(`
          INSERT INTO draws (
            contest_number, draw_date,
            number_1, number_2, number_3, number_4, number_5, number_6,
            prize_sena, winners_sena
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        `).run(
          draw.contest,
          draw.date,
          ...draw.numbers
        );
      });

      // Update frequencies
      stats.updateNumberFrequencies();

      // Get frequencies
      const frequencies = stats.getNumberFrequencies();

      // Number 1 appears in all 3 draws - should have frequency 3
      const num1Freq = frequencies.find((f) => f.number === 1);
      expect(num1Freq?.frequency).toBe(3);
      expect(num1Freq?.lastDrawnContest).toBe(3);

      // Number 2 appears once - should have frequency 1
      const num2Freq = frequencies.find((f) => f.number === 2);
      expect(num2Freq?.frequency).toBe(1);
      expect(num2Freq?.lastDrawnContest).toBe(1);

      // Number 60 never appears - should have frequency 0
      const num60Freq = frequencies.find((f) => f.number === 60);
      expect(num60Freq?.frequency).toBe(0);
      expect(num60Freq?.lastDrawnContest).toBeNull();
    });

    it('should handle draws with duplicate numbers gracefully', () => {
      // Insert draw with same number in multiple positions (shouldn't happen in real data but test robustness)
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena
        ) VALUES (1, '2025-01-01', 1, 1, 1, 1, 1, 1, 0, 0)
      `).run();

      stats.updateNumberFrequencies();
      const frequencies = stats.getNumberFrequencies();

      const num1Freq = frequencies.find((f) => f.number === 1);
      expect(num1Freq?.frequency).toBe(6);
    });

    it('should throw error on database failure', () => {
      // Close database to simulate failure
      db.close();

      expect(() => {
        stats.updateNumberFrequencies();
      }).toThrow();

      // Reopen for other tests
      db = getDatabase();
    });
  });

  describe('getNumberFrequencies', () => {
    it('should return all 60 numbers', () => {
      const frequencies = stats.getNumberFrequencies();
      expect(frequencies).toHaveLength(60);
    });

    it('should return numbers ordered by frequency DESC', () => {
      // Insert draws with known frequency distribution
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena
        ) VALUES (1, '2025-01-01', 10, 20, 30, 40, 50, 60, 0, 0)
      `).run();

      // Manually set frequencies
      db.prepare('UPDATE number_frequency SET frequency = 100 WHERE number = 10').run();
      db.prepare('UPDATE number_frequency SET frequency = 50 WHERE number = 20').run();

      const frequencies = stats.getNumberFrequencies();

      expect(frequencies[0].number).toBe(10);
      expect(frequencies[0].frequency).toBe(100);
      expect(frequencies[1].number).toBe(20);
      expect(frequencies[1].frequency).toBe(50);
    });
  });

  describe('getDrawStatistics', () => {
    it('should return correct statistics for empty database', () => {
      const result = stats.getDrawStatistics();

      expect(result.totalDraws).toBe(0);
      expect(result.lastContestNumber).toBeNull();
      expect(result.lastDrawDate).toBeNull();
      expect(result.accumulatedCount).toBe(0);
      expect(result.accumulationRate).toBe(0);
    });

    it('should return correct statistics with draws', () => {
      // Insert test draws
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena, accumulated
        ) VALUES (1, '2025-01-01', 1, 2, 3, 4, 5, 6, 1000000, 1, 0)
      `).run();

      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena, accumulated
        ) VALUES (2, '2025-01-08', 7, 8, 9, 10, 11, 12, 0, 0, 1)
      `).run();

      stats.updateNumberFrequencies();
      const result = stats.getDrawStatistics();

      expect(result.totalDraws).toBe(2);
      expect(result.lastContestNumber).toBe(2);
      expect(result.lastDrawDate).toBe('2025-01-08');
      expect(result.accumulatedCount).toBe(1);
      expect(result.accumulationRate).toBe(50); // 1 out of 2 = 50%
      expect(result.mostFrequentNumbers).toHaveLength(STATISTICS_DISPLAY.DASHBOARD_TOP_COUNT);
      expect(result.leastFrequentNumbers).toHaveLength(STATISTICS_DISPLAY.DASHBOARD_TOP_COUNT);
    });

    it('should calculate average prizes correctly', () => {
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, prize_quina, winners_sena
        ) VALUES (1, '2025-01-01', 1, 2, 3, 4, 5, 6, 1000000, 50000, 1)
      `).run();

      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, prize_quina, winners_sena
        ) VALUES (2, '2025-01-08', 7, 8, 9, 10, 11, 12, 2000000, 60000, 1)
      `).run();

      const result = stats.getDrawStatistics();

      expect(result.averagePrizeSena).toBe(1500000); // (1M + 2M) / 2
      expect(result.averagePrizeQuina).toBe(55000); // (50k + 60k) / 2
    });
  });

  describe('detectPatterns', () => {
    it('should detect consecutive numbers pattern', () => {
      // Insert draw with consecutive numbers (23, 24)
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena
        ) VALUES (1, '2025-01-01', 1, 23, 24, 40, 50, 60, 0, 0)
      `).run();

      const patterns = stats.detectPatterns();

      const consecutivePattern = patterns.find((p) => p.type === 'consecutive');
      expect(consecutivePattern).toBeDefined();
      expect(consecutivePattern?.occurrences).toBeGreaterThan(0);
    });

    it('should detect all even numbers pattern', () => {
      // Insert draw with all even numbers
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena
        ) VALUES (1, '2025-01-01', 2, 4, 6, 8, 10, 12, 0, 0)
      `).run();

      const patterns = stats.detectPatterns();

      const allEvenPattern = patterns.find((p) => p.type === 'all_even');
      expect(allEvenPattern).toBeDefined();
      expect(allEvenPattern?.occurrences).toBe(1);
    });
  });

  describe('getDrawHistory', () => {
    it('should return draws in descending order by contest number', () => {
      // Insert multiple draws
      for (let i = 1; i <= 10; i++) {
        db.prepare(`
          INSERT INTO draws (
            contest_number, draw_date,
            number_1, number_2, number_3, number_4, number_5, number_6,
            prize_sena, winners_sena, accumulated
          ) VALUES (?, ?, 1, 2, 3, 4, 5, 6, 1000000, 1, 0)
        `).run(i, `2025-01-${String(i).padStart(2, '0')}`);
      }

      const history = stats.getDrawHistory(5);

      expect(history).toHaveLength(5);
      expect(history[0].contestNumber).toBe(10);
      expect(history[1].contestNumber).toBe(9);
      expect(history[4].contestNumber).toBe(6);
    });

    it('should default to RECENT_DRAWS_DEFAULT limit', () => {
      // Insert more draws than default limit
      for (let i = 1; i <= 100; i++) {
        db.prepare(`
          INSERT INTO draws (
            contest_number, draw_date,
            number_1, number_2, number_3, number_4, number_5, number_6,
            prize_sena, winners_sena, accumulated
          ) VALUES (?, ?, 1, 2, 3, 4, 5, 6, 1000000, 1, 0)
        `).run(i, `2025-01-01`);
      }

      const history = stats.getDrawHistory();

      expect(history).toHaveLength(STATISTICS_DISPLAY.RECENT_DRAWS_DEFAULT);
    });

    it('should return draw with all 6 numbers', () => {
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena, accumulated
        ) VALUES (1, '2025-01-01', 5, 12, 23, 34, 45, 56, 1000000, 1, 0)
      `).run();

      const history = stats.getDrawHistory(1);

      expect(history[0].numbers).toEqual([5, 12, 23, 34, 45, 56]);
      expect(history[0].numbers).toHaveLength(MEGASENA_CONSTANTS.NUMBERS_PER_BET);
    });

    it('should correctly convert accumulated boolean', () => {
      db.prepare(`
        INSERT INTO draws (
          contest_number, draw_date,
          number_1, number_2, number_3, number_4, number_5, number_6,
          prize_sena, winners_sena, accumulated
        ) VALUES (1, '2025-01-01', 1, 2, 3, 4, 5, 6, 0, 0, 1)
      `).run();

      const history = stats.getDrawHistory(1);

      expect(history[0].accumulated).toBe(true);
    });
  });
});
