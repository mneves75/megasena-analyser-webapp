import { describe, it, expect, beforeAll } from 'vitest';
import { BetGenerator } from '@/lib/analytics/bet-generator';
import { runMigrations } from '@/lib/db';
import {
  MEGASENA_CONSTANTS,
  BET_GENERATION_MODE,
  BET_GENERATION_LIMITS,
  BET_PRICES,
} from '@/lib/constants';

describe('BetGenerator', () => {
  beforeAll(() => {
    runMigrations();
  });

  it('should generate valid simple bets', () => {
    const generator = new BetGenerator();
    const result = generator.generateBets(50, 'random');

    expect(result.bets.length).toBeGreaterThan(0);
    expect(result.totalCost).toBeLessThanOrEqual(50);

    result.bets.forEach((bet) => {
      expect(bet.numbers.length).toBe(MEGASENA_CONSTANTS.NUMBERS_PER_BET);
      expect(bet.numbers.every((n) => n >= 1 && n <= 60)).toBe(true);
      expect(new Set(bet.numbers).size).toBe(bet.numbers.length); // No duplicates
    });
  });

  it('should generate valid multiple bets', () => {
    const generator = new BetGenerator();
    const result = generator.generateMultipleBet(100, 'balanced');

    expect(result.bets.length).toBe(1);
    expect(result.totalCost).toBeLessThanOrEqual(100);

    const bet = result.bets[0];
    expect(bet.numbers.length).toBeGreaterThanOrEqual(6);
    expect(bet.numbers.every((n) => n >= 1 && n <= 60)).toBe(true);
  });

  it('should allow 20-number multiple bets when budget allows', () => {
    const generator = new BetGenerator();
    const budget = BET_PRICES[20] ?? 0;
    const result = generator.generateMultipleBet(budget, 'balanced');

    expect(result.bets.length).toBe(1);
    const bet = result.bets[0];
    expect(bet.numberCount).toBe(MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE);
    expect(bet.cost).toBe(budget);
  });

  it('should throw error for insufficient budget', () => {
    const generator = new BetGenerator();
    expect(() => generator.generateBets(2, 'random')).toThrow();
  });

  it('should respect budget constraints', () => {
    const generator = new BetGenerator();
    const budget = 100;
    const result = generator.generateBets(budget, 'hot_numbers');

    expect(result.totalCost).toBeLessThanOrEqual(budget);
    expect(result.remainingBudget).toBeGreaterThanOrEqual(0);
    expect(result.totalCost + result.remainingBudget).toBe(budget);
  });

  it('should reject multiple_only mode when budget cannot fund a multiple bet', () => {
    const generator = new BetGenerator();

    expect(() =>
      generator.generateOptimizedBets(10, BET_GENERATION_MODE.MULTIPLE_ONLY, 'balanced')
    ).toThrow('Orçamento insuficiente para aposta múltipla');
  });
});

/**
 * Exact-plan tests for the dynamic-programming bet sizer (buildOptimizedBetSizes,
 * exercised through OPTIMIZED mode). The DP objective, in priority order, is:
 *   1. maximize coverage = min(60, sum of bet sizes)
 *   2. minimize bet count
 *   3. maximize total numbers
 * ...while spending the most units possible (minimizing R$ waste). Because the
 * cheapest bet is R$6 (six numbers) and every price is a whole multiple of R$6,
 * the minimal achievable waste for any budget is exactly `budget % 6`.
 *
 * Expected plans below are derived by hand from BET_PRICES (6 -> R$6, 7 -> R$42):
 *   - Only sizes 6 and 7 are affordable until the budget passes R$168 (size 8),
 *     so plans compose from those two coins.
 *   - A size-7 bet buys 7 numbers for R$42; six size-6 bets buy 36 numbers for
 *     the same R$42. So a 7 is only ever chosen once coverage is already
 *     saturated at 60, where it then lowers the bet count.
 */
describe('BetGenerator.buildOptimizedBetSizes (via OPTIMIZED mode)', () => {
  function sizeCounts(bets: ReadonlyArray<{ numberCount: number }>): Record<number, number> {
    const counts: Record<number, number> = {};
    for (const bet of bets) {
      counts[bet.numberCount] = (counts[bet.numberCount] ?? 0) + 1;
    }
    return counts;
  }

  function totalNumbers(bets: ReadonlyArray<{ numberCount: number }>): number {
    return bets.reduce((sum, bet) => sum + bet.numberCount, 0);
  }

  const simpleCost = BET_PRICES[6] ?? 6;

  it('spends the whole budget as a single simple bet at the minimum budget (R$6)', () => {
    const generator = new BetGenerator();
    const result = generator.generateOptimizedBets(6, BET_GENERATION_MODE.OPTIMIZED, 'balanced');

    expect(sizeCounts(result.bets)).toEqual({ 6: 1 });
    expect(result.totalCost).toBe(6);
    expect(result.remainingBudget).toBe(0);
  });

  it('prefers seven simple bets over one 7-number bet at R$42 (coverage beats bet count)', () => {
    const generator = new BetGenerator();
    const result = generator.generateOptimizedBets(42, BET_GENERATION_MODE.OPTIMIZED, 'balanced');

    // One 7-number bet (R$42) covers only 7 numbers; seven size-6 bets cover 42.
    expect(sizeCounts(result.bets)).toEqual({ 6: 7 });
    expect(result.totalCost).toBe(42);
    expect(result.remainingBudget).toBe(0);
    expect(totalNumbers(result.bets)).toBe(42);
  });

  it('maximizes coverage with eight simple bets at R$50, leaving only the R$2 remainder', () => {
    const generator = new BetGenerator();
    const budget = 50;
    const result = generator.generateOptimizedBets(budget, BET_GENERATION_MODE.OPTIMIZED, 'balanced');

    expect(sizeCounts(result.bets)).toEqual({ 6: 8 });
    expect(result.totalCost).toBe(48);
    // Minimal possible waste: cannot afford a 9th R$6 bet with the R$2 remainder.
    expect(result.remainingBudget).toBe(budget % simpleCost);
    expect(result.remainingBudget).toBeLessThan(simpleCost);
  });

  it('adds one 7-number bet at R$100 to hit full coverage with the fewest bets', () => {
    const generator = new BetGenerator();
    const budget = 100;
    const result = generator.generateOptimizedBets(budget, BET_GENERATION_MODE.OPTIMIZED, 'balanced');

    // budget/6 = 16 spendable units. The unique coverage-60 plan with the fewest
    // bets at 16 units is nine size-6 (R$54) + one size-7 (R$42) = R$96, 10 bets,
    // 61 numbers. All-size-6 (16 bets) also reaches coverage 60 but with more bets.
    expect(sizeCounts(result.bets)).toEqual({ 6: 9, 7: 1 });
    expect(result.totalCost).toBe(96);
    expect(result.totalCost).toBeLessThanOrEqual(budget);
    expect(result.remainingBudget).toBe(budget % simpleCost);
    expect(result.remainingBudget).toBeLessThan(simpleCost);
    // Coverage saturated at the 60-number cap.
    expect(Math.min(60, totalNumbers(result.bets))).toBe(60);
    expect(result.bets).toHaveLength(10);
  });

  it('stays cheap at the optimized budget cap', () => {
    // The (betCount, coverage) -> Map<cost> formulation allocated ~106 MB and
    // took ~75 ms here, enough for concurrent requests to OOM the 384 MB
    // production container. The (coverage, cost) formulation with bet count as
    // the minimized value is bounded by 61 * (budget/6 + 1) typed-array cells.
    const generator = new BetGenerator();
    const budget = BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET;

    const startedAt = performance.now();
    const result = generator.generateOptimizedBets(budget, BET_GENERATION_MODE.OPTIMIZED, 'random');
    const elapsedMs = performance.now() - startedAt;

    // Generous bound: the measured cost is ~1 ms, so this only trips on a
    // regression back to a formulation that scales with the bet-count dimension.
    expect(elapsedMs).toBeLessThan(400);

    // Objective unchanged: spend as close to the budget as the R$6 unit allows,
    // saturate coverage, and stay inside the bet-count ceiling.
    expect(result.totalCost).toBe(19998);
    expect(result.remainingBudget).toBe(2);
    expect(Math.min(60, totalNumbers(result.bets))).toBe(60);
    expect(result.bets.length).toBeLessThanOrEqual(
      BET_GENERATION_LIMITS.MAX_BETS_PER_GENERATION
    );
  });

  it('rejects an optimized budget above the documented cap', () => {
    const generator = new BetGenerator();

    expect(() =>
      generator.generateOptimizedBets(
        BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET + 1,
        BET_GENERATION_MODE.OPTIMIZED,
        'random'
      )
    ).toThrow(/Orçamento otimizado limitado/);
  });
});
