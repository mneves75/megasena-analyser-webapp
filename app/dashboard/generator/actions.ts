'use server';

import { BetGenerator, type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator';
import { type BetGenerationMode } from '@/lib/constants';

export async function generateBets(
  budget: number,
  strategy: BetStrategy,
  mode: BetGenerationMode
): Promise<BetGenerationResult> {
  const generator = new BetGenerator();
  const result = generator.generateOptimizedBets(budget, mode, strategy);
  return result;
}

