import { describe, expect, it } from 'vitest';
import {
  MAX_TREND_NUMBERS,
  MAX_TREND_NUMBERS_PARAM_LENGTH,
  parseTrendNumbers,
  parseTrendsQuery,
} from '@/lib/security/trends-input';

describe('parseTrendNumbers', () => {
  it('accepts all Mega-Sena numbers once and keeps deterministic order', () => {
    const numbersParam = Array.from({ length: MAX_TREND_NUMBERS }, (_, index) => String(index + 1)).join(',');

    expect(numbersParam.length).toBeLessThanOrEqual(MAX_TREND_NUMBERS_PARAM_LENGTH);
    expect(parseTrendNumbers(numbersParam)).toEqual({
      success: true,
      numbers: Array.from({ length: MAX_TREND_NUMBERS }, (_, index) => index + 1),
    });
  });

  it('deduplicates repeated valid numbers before analysis', () => {
    expect(parseTrendNumbers('1,2,2,3')).toEqual({ success: true, numbers: [1, 2, 3] });
  });

  it('rejects more than the full 60-number domain', () => {
    const numbersParam = Array.from({ length: MAX_TREND_NUMBERS + 1 }, () => '1').join(',');

    expect(parseTrendNumbers(numbersParam)).toEqual({ success: false, reason: 'too_many_numbers' });
  });

  it('rejects out-of-range numbers instead of silently dropping them', () => {
    expect(parseTrendNumbers('1,2,61')).toEqual({ success: false, reason: 'number_out_of_range' });
  });
});

describe('parseTrendsQuery', () => {
  it('defaults period to yearly when the query omits it', () => {
    // URLSearchParams.get returns null for an absent key, and a zod enum default
    // applies only to undefined; the parser must normalize before validating.
    const result = parseTrendsQuery(new URLSearchParams('numbers=1,2,3'));

    expect(result).toEqual({ success: true, data: { numbers: '1,2,3', period: 'yearly' } });
  });

  it('keeps an explicit valid period and rejects an unknown one', () => {
    expect(parseTrendsQuery(new URLSearchParams('numbers=5&period=monthly'))).toEqual({
      success: true,
      data: { numbers: '5', period: 'monthly' },
    });
    expect(parseTrendsQuery(new URLSearchParams('numbers=5&period=daily')).success).toBe(false);
  });

  it('rejects malformed or oversized number lists', () => {
    expect(parseTrendsQuery(new URLSearchParams('numbers=1;2')).success).toBe(false);
    const oversized = Array.from({ length: MAX_TREND_NUMBERS_PARAM_LENGTH }, () => '1').join(',');
    expect(parseTrendsQuery(new URLSearchParams(`numbers=${oversized}`)).success).toBe(false);
  });
});
