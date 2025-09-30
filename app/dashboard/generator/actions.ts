'use server';

import { type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator';
import { type BetGenerationMode } from '@/lib/constants';

interface GenerateBetsApiResponse {
  success: boolean;
  data?: BetGenerationResult;
  error?: string;
}

export async function generateBets(
  budget: number,
  strategy: BetStrategy,
  mode: BetGenerationMode
): Promise<BetGenerationResult> {
  // Call the Bun API server instead of directly instantiating BetGenerator
  // Server Actions run in Node.js, but database requires Bun runtime
  const apiPort = process.env.API_PORT ?? '3201';
  const baseUrl = `http://localhost:${apiPort}`;
  
  const response = await fetch(`${baseUrl}/api/generate-bets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ budget, strategy, mode }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to generate bets: ${response.statusText}`);
  }

  const json = (await response.json()) as GenerateBetsApiResponse;
  
  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to generate bets');
  }

  return json.data;
}

