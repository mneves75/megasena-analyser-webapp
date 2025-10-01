import { API_CONFIG } from '@/lib/constants';

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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
   * Uses Promise.race to ensure timeout fires even if response stalls
   */
  private async fetchWithRetry(url: string, maxRetries: number = API_CONFIG.MAX_RETRIES): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();

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

        // Create timeout promise that aborts the request
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${this.timeout}ms`));
          }, this.timeout);
        });

        // Create fetch promise
        const fetchPromise = fetch(url, {
          signal: controller.signal,
          headers,
        });

        // Race between fetch and timeout
        const response = await Promise.race([fetchPromise, timeoutPromise]);

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

        // Success - return response
        return response;
      } catch (error) {
        lastError = error as Error;

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.pow(API_CONFIG.BACKOFF_MULTIPLIER, attempt + 1) * 1000;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.warn(
            `[Attempt ${attempt + 1}/${maxRetries}] Request failed: ${errorMsg}. Retrying in ${backoffDelay}ms...`
          );
          await this.delay(backoffDelay);
        }
      }
    }

    throw lastError || new Error('Failed to fetch after retries');
  }

  async fetchAllDraws(startContest: number = 1, endContest?: number): Promise<MegaSenaDrawData[]> {
    const draws: MegaSenaDrawData[] = [];

    // First, get the latest draw to know the range
    if (!endContest) {
      console.log('Fetching latest draw to determine range...');
      const latestDraw = await this.fetchDraw();
      endContest = latestDraw.numero;
    }

    console.log(`Fetching draws from ${startContest} to ${endContest}...`);
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
          console.log(
            `Progress: ${contest}/${endContest} (${successCount} success, ${errorCount} errors)`
          );
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
        console.error(`[${contest}/${endContest}] Error fetching contest ${contest}: ${errorMsg}`);

        // Add extra delay after errors to avoid triggering rate limits
        await this.delay(API_CONFIG.RATE_LIMIT_DELAY * 3);

        // Continue with next contest instead of failing completely
      }
    }

    console.log(`\nCompleted: ${successCount}/${totalDraws} draws fetched successfully, ${errorCount} errors`);
    return draws;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const caixaClient = new CaixaAPIClient();
