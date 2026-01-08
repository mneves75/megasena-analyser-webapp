import { describe, it, expect, beforeAll } from 'vitest';
import { BetGenerator } from '@/lib/analytics/bet-generator';
import { runMigrations } from '@/lib/db';
import { BET_GENERATION_MODE, BET_GENERATION_LIMITS, MEGASENA_CONSTANTS } from '@/lib/constants';

describe('BetGenerator - optimized mode', () => {
  beforeAll(() => {
    runMigrations();
  });

  it('should minimize budget waste for non-multiple budgets', () => {
    const generator = new BetGenerator();
    const budget = 50;
    const result = generator.generateOptimizedBets(budget, BET_GENERATION_MODE.OPTIMIZED, 'random');

    expect(result.totalCost).toBeLessThanOrEqual(budget);
    expect(result.remainingBudget).toBeGreaterThanOrEqual(0);
    expect(result.totalCost).toBe(48);
    expect(result.remainingBudget).toBe(2);
  });

  it('should cap total bets and keep sizes within official limits', () => {
    const generator = new BetGenerator();
    const budget = 100000;
    const result = generator.generateOptimizedBets(budget, BET_GENERATION_MODE.OPTIMIZED, 'random');

    expect(result.bets.length).toBeGreaterThan(0);
    expect(result.bets.length).toBeLessThanOrEqual(BET_GENERATION_LIMITS.MAX_BETS_PER_GENERATION);
    result.bets.forEach((bet) => {
      expect(bet.numberCount).toBeGreaterThanOrEqual(MEGASENA_CONSTANTS.MIN_NUMBERS_MULTIPLE);
      expect(bet.numberCount).toBeLessThanOrEqual(MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE);
    });
  });
});
