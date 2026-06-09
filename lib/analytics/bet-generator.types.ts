import { type BetGenerationMode } from '@/lib/constants';

export interface Bet {
  id: string;
  numbers: number[];
  cost: number;
  type: 'simple' | 'multiple';
  numberCount: number;
  strategy: string;
}

export interface BetGenerationResult {
  bets: Bet[];
  totalCost: number;
  remainingBudget: number | null;
  budgetUtilization: number | null;
  totalNumbers: number;
  strategy: string;
  mode: BetGenerationMode;
  summary: {
    simpleBets: number;
    multipleBets: number;
    averageCost: number;
  };
}

export type BetStrategy =
  | 'random'
  | 'hot_numbers'
  | 'cold_numbers'
  | 'balanced'
  | 'fibonacci'
  | 'custom';
