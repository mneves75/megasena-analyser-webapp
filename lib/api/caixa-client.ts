import { API_CONFIG } from '@/lib/constants';
import { logger } from '@/lib/logger';

export interface MegaSenaDrawData {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  rateioProcessamento?: Array<{
    descricaoFaixa: string;
    numeroDeGanhadores: number;
    valorPremio: number;
  }>;
  valorArrecadado?: number;
  valorAcumuladoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
  acumulado?: boolean;
  tipoJogo?: string;
}

export class CaixaAPIClient {
  private baseURL: string;
  private timeout: number;
  private cache: Map<string, MegaSenaDrawData>;
  private etags: Map<string, string>;

  constructor() {
    this.baseURL = API_CONFIG.CAIXA_BASE_URL;
    this.timeout = API_CONFIG.REQUEST_TIMEOUT;
    this.cache = new Map();
    this.etags = new Map();
  }

  async fetchDraw(contestNumber?: number): Promise<MegaSenaDrawData> {
    // Validate contest number if provided
    if (contestNumber !== undefined) {
      if (!Number.isInteger(contestNumber) || contestNumber < 1) {
        throw new Error(
          `Invalid contest number: ${contestNumber}. Must be a positive integer.`
        );
      }
      if (contestNumber > 10000) {
        throw new Error(
          `Invalid contest number: ${contestNumber}. Contest number too high (max 10000).`
        );
      }
    }

    const url = contestNumber
      ? `${this.baseURL}/megasena/${contestNumber}`
      : `${this.baseURL}/megasena`;

    try {
      const response = await this.fetchWithRetry(url);

      const data = await response.json();

      // Cache the result
      this.cache.set(url, data);

      // Store ETag for future requests
      const etag = response.headers.get('ETag');
      if (etag) {
        this.etags.set(url, etag);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        throw new Error(`Failed to fetch draw: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch with exponential backoff retry logic, ETag caching, and enforced timeout
   */
  private async fetchWithRetry(url: string, maxRetries: number = API_CONFIG.MAX_RETRIES): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const controller = new AbortController();

        timeoutId = setTimeout(() => {
          controller.abort();
        }, this.timeout);

        const headers: HeadersInit = {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://loterias.caixa.gov.br/',
          'Origin': 'https://loterias.caixa.gov.br',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
        };

        // Add ETag header for conditional requests
        const cachedETag = this.etags.get(url);
        if (cachedETag) {
          headers['If-None-Match'] = cachedETag;
        }

        const response = await fetch(url, {
          signal: controller.signal,
          headers,
        });

        // Handle 304 Not Modified - return cached data
        if (response.status === 304) {
          const cachedData = this.cache.get(url);
          if (cachedData) {
            // Create a mock response with cached data
            return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        if (!response.ok) {
          const retryAfterMs = this.parseRetryAfterMs(response.headers.get('Retry-After'));
          const retryable = this.isRetryableStatus(response.status);
          const errorOptions: { status?: number; retryable: boolean; retryAfterMs?: number } = {
            status: response.status,
            retryable,
          };
          if (typeof retryAfterMs === 'number') {
            errorOptions.retryAfterMs = retryAfterMs;
          }
          throw new CaixaAPIError(`HTTP ${response.status}: ${response.statusText}`, errorOptions);
        }

        // Success - return response
        return response;
      } catch (error) {
        if (error instanceof CaixaAPIError && !error.retryable) {
          throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timeout after ${this.timeout}ms`);
        } else {
          lastError = error as Error;
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        if (attempt < maxRetries - 1) {
          const backoffDelay = this.getBackoffDelay(error, attempt + 1);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('caixa.fetch_retry', {
            attempt: attempt + 1,
            maxRetries,
            backoffDelayMs: backoffDelay,
            errorMessage: errorMsg,
            statusCode: error instanceof CaixaAPIError ? error.status : undefined,
            url,
          });
          await this.delay(backoffDelay);
        }
      } finally {
        if (typeof timeoutId !== 'undefined') {
          clearTimeout(timeoutId);
        }
      }
    }

    throw lastError || new Error('Failed to fetch after retries');
  }

  async fetchAllDraws(startContest: number = 1, endContest?: number): Promise<MegaSenaDrawData[]> {
    const draws: MegaSenaDrawData[] = [];

    // First, get the latest draw to know the range
    if (!endContest) {
      logger.info('caixa.fetch_latest_range');
      const latestDraw = await this.fetchDraw();
      endContest = latestDraw.numero;
    }

    logger.info('caixa.fetch_range', {
      startContest,
      endContest,
    });
    const totalDraws = endContest - startContest + 1;
    let successCount = 0;
    let errorCount = 0;

    for (let contest = startContest; contest <= endContest; contest++) {
      try {
        const draw = await this.fetchDraw(contest);
        draws.push(draw);
        successCount++;

        // Progress reporting
        if (contest % 50 === 0 || contest === endContest) {
          logger.info('caixa.fetch_progress', {
            contest,
            endContest,
            successCount,
            errorCount,
          });
        }

        // Progressive rate limiting - increase delay as we fetch more
        let delay = API_CONFIG.RATE_LIMIT_DELAY;
        if (successCount > API_CONFIG.PROGRESSIVE_DELAY_THRESHOLD) {
          const progressiveBatches = Math.floor(
            (successCount - API_CONFIG.PROGRESSIVE_DELAY_THRESHOLD) / 100
          );
          delay += progressiveBatches * API_CONFIG.PROGRESSIVE_DELAY_INCREMENT;
        }

        await this.delay(delay);
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('caixa.fetch_draw_failed', error, {
          contest,
          endContest,
          errorMessage: errorMsg,
        });

        // Add extra delay after errors to avoid triggering rate limits
        await this.delay(API_CONFIG.RATE_LIMIT_DELAY * 3);

        // Continue with next contest instead of failing completely
      }
    }

    logger.info('caixa.fetch_complete', {
      startContest,
      endContest,
      totalDraws,
      successCount,
      errorCount,
    });
    return draws;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRetryableStatus(status: number): boolean {
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }

  private parseRetryAfterMs(retryAfter: string | null): number | undefined {
    if (!retryAfter) {
      return undefined;
    }

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }

    const dateMs = Date.parse(retryAfter);
    if (!Number.isNaN(dateMs)) {
      const delta = dateMs - Date.now();
      if (delta > 0) {
        return delta;
      }
    }

    return undefined;
  }

  private getBackoffDelay(error: unknown, attempt: number): number {
    if (error instanceof CaixaAPIError && typeof error.retryAfterMs === 'number') {
      return error.retryAfterMs;
    }
    const baseDelay = Math.pow(API_CONFIG.BACKOFF_MULTIPLIER, attempt) * 1000;
    const jitter = Math.floor(Math.random() * 250);
    return baseDelay + jitter;
  }
}

export const caixaClient = new CaixaAPIClient();

class CaixaAPIError extends Error {
  status?: number;
  retryable: boolean;
  retryAfterMs?: number;

  constructor(message: string, options: { status?: number; retryable: boolean; retryAfterMs?: number }) {
    super(message);
    this.name = 'CaixaAPIError';
    this.retryable = options.retryable;
    if (typeof options.status === 'number') {
      this.status = options.status;
    }
    if (typeof options.retryAfterMs === 'number') {
      this.retryAfterMs = options.retryAfterMs;
    }
  }
}
