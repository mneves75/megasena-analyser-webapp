import { describe, it, expect, beforeAll } from 'vitest';
import { BetGenerator } from '@/lib/analytics/bet-generator';
import { runMigrations } from '@/lib/db';
import { MEGASENA_CONSTANTS } from '@/lib/constants';

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
});

