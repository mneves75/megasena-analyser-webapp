export const BETTING_LIMITS = {
  minDezenaCount: 6,
  maxDezenaCount: 15,
  defaultDezenaCount: 6,
  maxTicketsPerBatch: 100,
  maxBudgetCents: 50_000,
  minBudgetCents: 600,
} as const;

export type BettingLimits = typeof BETTING_LIMITS;
