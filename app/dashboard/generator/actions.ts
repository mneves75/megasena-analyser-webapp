'use server';

import { type BetGenerationResult, type BetStrategy } from '@/lib/analytics/bet-generator.types';
import { type BetGenerationMode } from '@/lib/constants';
import { fetchApi } from '@/lib/api/api-fetch';
import { logger } from '@/lib/logger';

interface GenerateBetsApiResponse {
  success: boolean;
  data?: BetGenerationResult;
  error?: string;
}

const GENERIC_ERROR = 'Não foi possível gerar as apostas.';

/**
 * Extracts the API's pt-BR `error` field from an error response body, falling
 * back to a generic message when the body is missing, not JSON, or shaped
 * differently. Never surfaces raw response text, which could echo internals.
 */
function readApiErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
      return parsed.error.trim();
    }
  } catch {
    // Non-JSON body: fall through to the generic message.
  }
  return GENERIC_ERROR;
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

    // The API answers validation failures with an actionable pt-BR message
    // (budget above the optimized cap, for example). Surfacing the HTTP reason
    // phrase instead would show the user an untranslated "Bad Request".
    throw new Error(readApiErrorMessage(text));
  }

  const json = (await response.json()) as GenerateBetsApiResponse;
  
  if (!json.success || !json.data) {
    logger.error('generator.api_invalid_response', new Error('Invalid generate bets response'), {
      route: '/api/generate-bets',
      hasData: Boolean(json.data),
      success: json.success,
    });
    throw new Error(json.error ?? GENERIC_ERROR);
  }

  return json.data;
}
