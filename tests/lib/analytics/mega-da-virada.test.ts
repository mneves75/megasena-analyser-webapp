import { describe, expect, it } from 'vitest';
import {
  MEGA_DA_VIRADA_CONTESTS,
  countNumbers,
  groupByCount,
  megaDaViradaEdition,
} from '@/lib/analytics/mega-da-virada';

describe('megaDaViradaEdition', () => {
  it('is the draw year for a draw on 31/12', () => {
    expect(megaDaViradaEdition('2024-12-31')).toBe(2024);
  });

  it('is the previous year for an edition postponed into January', () => {
    // The 2025 edition (contest 2955) was drawn on the morning of 01/01/2026.
    expect(megaDaViradaEdition('2026-01-01')).toBe(2025);
  });
});

describe('MEGA_DA_VIRADA_CONTESTS', () => {
  it('lists one contest per edition from 2009 to 2025, in order', () => {
    expect(MEGA_DA_VIRADA_CONTESTS).toHaveLength(2025 - 2009 + 1);
    expect([...MEGA_DA_VIRADA_CONTESTS].sort((a, b) => a - b)).toEqual(MEGA_DA_VIRADA_CONTESTS);
  });

  it('only holds contests ending in 0 or 5, as the CAIXA rule requires', () => {
    for (const contest of MEGA_DA_VIRADA_CONTESTS) {
      expect(contest % 5, `contest ${contest}`).toBe(0);
    }
  });
});

describe('countNumbers', () => {
  it('counts every number from 1 to 60, including those never drawn', () => {
    const counts = countNumbers([{ numbers: [1, 2, 3, 4, 5, 60] }, { numbers: [1, 7, 8, 9, 10, 60] }]);

    expect(counts).toHaveLength(60);
    expect(counts[0]).toEqual({ number: 1, count: 2 });
    expect(counts[5]).toEqual({ number: 6, count: 0 });
    expect(counts[59]).toEqual({ number: 60, count: 2 });
    expect(counts.reduce((sum, entry) => sum + entry.count, 0)).toBe(12);
  });
});

describe('groupByCount', () => {
  it('groups drawn numbers by frequency, most frequent first, and leaves out zeros', () => {
    const counts = countNumbers([
      { numbers: [10, 33, 5, 1, 2, 3] },
      { numbers: [10, 33, 5, 4, 6, 7] },
      { numbers: [10, 33, 8, 9, 11, 12] },
    ]);

    expect(groupByCount(counts).slice(0, 2)).toEqual([
      { count: 3, numbers: [10, 33] },
      { count: 2, numbers: [5] },
    ]);
    expect(groupByCount(counts).some((group) => group.count === 0)).toBe(false);
  });
});
