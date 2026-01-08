'use server';

import { type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator';
import { type BetGenerationMode } from '@/lib/constants';
import { fetchApi } from '@/lib/api/api-fetch';
import { logger } from '@/lib/logger';

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
  const response = await fetchApi('/api/generate-bets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ budget, strategy, mode }),
    cache: 'no-store',
    timeoutMs: 12000,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('generator.api_response_error', new Error('Generate bets API error'), {
      statusCode: response.status,
      statusText: response.statusText,
      route: '/api/generate-bets',
      responseBodyLength: text.length,
      responseBodySnippet: text.slice(0, 120),
    });
    throw new Error(`Failed to generate bets: ${response.statusText}`);
  }

  const json = (await response.json()) as GenerateBetsApiResponse;
  
  if (!json.success || !json.data) {
    logger.error('generator.api_invalid_response', new Error('Invalid generate bets response'), {
      route: '/api/generate-bets',
      hasData: Boolean(json.data),
      success: json.success,
    });
    throw new Error(json.error ?? 'Failed to generate bets');
  }

  return json.data;
}
