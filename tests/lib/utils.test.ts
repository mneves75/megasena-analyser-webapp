import { describe, expect, it } from 'vitest';
import { formatDate, toIsoDate } from '@/lib/utils';

describe('date utilities', () => {
  describe('toIsoDate', () => {
    it('converts a Brazilian draw date to ISO', () => {
      expect(toIsoDate('14/07/2026')).toBe('2026-07-14');
    });

    it('keeps an already normalized ISO date unchanged', () => {
      expect(toIsoDate('2026-07-14')).toBe('2026-07-14');
    });

    it.each(['14-07-2026', '2026/07/14', '31/02/2026', '']) (
      'rejects an invalid date: %s',
      (value) => {
        expect(() => toIsoDate(value)).toThrow('Invalid draw date');
      }
    );
  });

  describe('formatDate', () => {
    it('formats an ISO date as DD/MM/YYYY', () => {
      expect(formatDate('2026-07-14')).toBe('14/07/2026');
    });

    it('does not shift a UTC date across the day boundary', () => {
      expect(formatDate('2026-01-01')).toBe('01/01/2026');
    });
  });
});
