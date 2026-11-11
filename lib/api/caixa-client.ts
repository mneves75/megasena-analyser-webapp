import { API_CONFIG } from '@/lib/constants';
import type { Draw } from '@/lib/draw-ingestion';
import { logger } from '@/lib/logger';
import { toIsoDate } from '@/lib/utils';

interface CaixaPrizeTier {
  descricaoFaixa?: string;
  faixa?: number;
  numeroDeGanhadores?: number;
  valorPremio?: number;
}

interface CaixaRawDrawData {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  rateioProcessamento?: CaixaPrizeTier[];
  listaRateioPremio?: CaixaPrizeTier[];
  valorArrecadado?: number;
  valorAcumuladoConcurso?: number;
  valorAcumuladoProximoConcurso?: number;
  valorEstimadoProximoConcurso?: number;
  acumulado?: boolean;
  tipoJogo?: string;
  /** 2 marks a special contest (from 2017 on); regular contests carry 1. */
  indicadorConcursoEspecial?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateNonNegativeNumber(value: unknown, field: string): void {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `Resposta da CAIXA inválida: ${field} deve ser um número finito maior ou igual a zero.`
    );
  }
}

function validatePrizeTiers(value: unknown, field: string): void {
  if (typeof value === 'undefined') {
    return;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Resposta da CAIXA inválida: ${field} deve ser uma lista.`);
  }

  value.forEach((tier, index) => {
    if (!isRecord(tier)) {
      throw new Error(
        `Resposta da CAIXA inválida: ${field}[${index}] deve ser um objeto.`
      );
    }
    if (typeof tier['valorPremio'] !== 'undefined') {
      validateNonNegativeNumber(tier['valorPremio'], `${field}[${index}].valorPremio`);
    }
    if (typeof tier['numeroDeGanhadores'] !== 'undefined') {
      validateNonNegativeNumber(
        tier['numeroDeGanhadores'],
        `${field}[${index}].numeroDeGanhadores`
      );
    }
  });
}

function validateMegaSenaDrawData(
  value: unknown,
  requestedContest?: number
): CaixaRawDrawData {
  if (!isRecord(value)) {
    throw new Error('Resposta da CAIXA inválida: o payload deve ser um objeto.');
  }

  const numero = value['numero'];
  if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 1) {
    throw new Error(
      'Resposta da CAIXA inválida: numero deve ser um número inteiro positivo.'
    );
  }
  if (typeof requestedContest === 'number' && numero !== requestedContest) {
    throw new Error(
      `Resposta da CAIXA inválida: concurso solicitado ${requestedContest}, recebido ${numero}.`
    );
  }

  const dataApuracao = value['dataApuracao'];
  if (typeof dataApuracao !== 'string' || dataApuracao.trim().length === 0) {
    throw new Error(
      'Resposta da CAIXA inválida: dataApuracao deve ser uma string não vazia.'
    );
  }

  const rawDezenas = value['listaDezenas'];
  if (!Array.isArray(rawDezenas) || rawDezenas.length !== 6) {
    throw new Error(
      'Resposta da CAIXA inválida: listaDezenas deve conter exatamente 6 dezenas.'
    );
  }

  const parsedDezenas = rawDezenas.map((entry, index) => {
    if (typeof entry !== 'string' && typeof entry !== 'number') {
      throw new Error(
        `Resposta da CAIXA inválida: listaDezenas[${index}] deve representar um número inteiro.`
      );
    }
    const parsed = Number(entry);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
      throw new Error(
        `Resposta da CAIXA inválida: listaDezenas[${index}] deve estar entre 1 e 60.`
      );
    }
    return parsed;
  });
  if (new Set(parsedDezenas).size !== parsedDezenas.length) {
    throw new Error(
      'Resposta da CAIXA inválida: listaDezenas deve conter dezenas distintas.'
    );
  }

  validatePrizeTiers(value['rateioProcessamento'], 'rateioProcessamento');
  validatePrizeTiers(value['listaRateioPremio'], 'listaRateioPremio');

  return {
    ...value,
    numero,
    dataApuracao,
    listaDezenas: rawDezenas.map(String),
  };
}

function normalizePrizeDescription(
  description: string | undefined,
  faixa: number | undefined
): string {
  const normalized = description?.trim().toLowerCase();

  if (faixa === 1 || normalized === 'sena' || normalized === '6 acertos') {
    return 'Sena';
  }
  if (faixa === 2 || normalized === 'quina' || normalized === '5 acertos') {
    return 'Quina';
  }
  if (faixa === 3 || normalized === 'quadra' || normalized === '4 acertos') {
    return 'Quadra';
  }

  return description?.trim() || `Faixa ${faixa ?? 'desconhecida'}`;
}

function validateWinnerCount(value: number, field: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`Resposta da CAIXA inválida: ${field} deve ser um número inteiro.`);
  }
}

/**
 * Convert a validated CAIXA payload into a storage-ready draw. Only the tiers
 * and fields that are stored are checked here; an unused tier was already
 * shape-checked by validateMegaSenaDrawData.
 */
function toDraw(raw: CaixaRawDrawData): Draw {
  const prizeBreakdown = raw.rateioProcessamento?.length
    ? raw.rateioProcessamento
    : raw.listaRateioPremio ?? [];
  // The first tier that maps to the name wins.
  const tier = (name: string) => prizeBreakdown.find(
    (entry) => normalizePrizeDescription(entry.descricaoFaixa, entry.faixa) === name
  );
  const sena = tier('Sena');
  const quina = tier('Quina');
  const quadra = tier('Quadra');
  const draw: Draw = {
    contest: raw.numero,
    date: toIsoDate(raw.dataApuracao),
    numbers: raw.listaDezenas.map(Number).sort((a, b) => a - b),
    prizeSena: sena?.valorPremio ?? 0,
    winnersSena: sena?.numeroDeGanhadores ?? 0,
    prizeQuina: quina?.valorPremio ?? 0,
    winnersQuina: quina?.numeroDeGanhadores ?? 0,
    prizeQuadra: quadra?.valorPremio ?? 0,
    winnersQuadra: quadra?.numeroDeGanhadores ?? 0,
    // A non-numeric collection or estimate is ignored and stored as 0.
    totalCollection: typeof raw.valorArrecadado === 'number' ? raw.valorArrecadado : 0,
    accumulated: raw.acumulado === true,
    // The current CAIXA payload exposes carry-over value as valorAcumuladoProximoConcurso.
    accumulatedValue: raw.valorAcumuladoConcurso ?? raw.valorAcumuladoProximoConcurso ?? 0,
    nextEstimatedPrize: typeof raw.valorEstimadoProximoConcurso === 'number' ? raw.valorEstimadoProximoConcurso : 0,
    // tipoJogo is MEGA_SENA even for special contests; the indicator is what marks them.
    specialDraw: raw.indicadorConcursoEspecial === 2,
  };
  validateNonNegativeNumber(draw.totalCollection, 'valorArrecadado');
  validateNonNegativeNumber(draw.accumulatedValue, 'valorAcumuladoConcurso');
  validateNonNegativeNumber(draw.nextEstimatedPrize, 'valorEstimadoProximoConcurso');
  validateWinnerCount(draw.winnersSena, 'numeroDeGanhadores (Sena)');
  validateWinnerCount(draw.winnersQuina, 'numeroDeGanhadores (Quina)');
  validateWinnerCount(draw.winnersQuadra, 'numeroDeGanhadores (Quadra)');
  return draw;
}

export class CaixaAPIClient {
  private baseURL: string;
  private timeout: number;
  private cache: Map<string, CaixaRawDrawData>;
  private etags: Map<string, string>;
  private maxRetries: number;
  private maxRetryDelayMs: number;

  constructor(options: { timeoutMs?: number; maxRetries?: number; maxRetryDelayMs?: number } = {}) {
    this.baseURL = API_CONFIG.CAIXA_BASE_URL;
    this.timeout = options.timeoutMs ?? API_CONFIG.REQUEST_TIMEOUT;
    this.maxRetries = options.maxRetries ?? API_CONFIG.MAX_RETRIES;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(this.timeout) || this.timeout <= 0 || !Number.isInteger(this.maxRetries) || this.maxRetries < 1 ||
        this.maxRetryDelayMs <= 0 || Number.isNaN(this.maxRetryDelayMs)) {
      throw new Error('Invalid CAIXA request budget.');
    }
    this.cache = new Map();
    this.etags = new Map();
  }

  async fetchDraw(contestNumber?: number): Promise<Draw> {
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

      const rawData = validateMegaSenaDrawData(await response.json(), contestNumber);
      const data = toDraw(rawData);

      // Cache the result
      this.cache.set(url, rawData);

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
  private async fetchWithRetry(url: string, maxRetries: number = this.maxRetries): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();
      try {
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

        // Consume the body before clearing the request deadline. Returning a
        // buffered response preserves the caller's validation and ETag handling.
        const body = await response.text();
        return new Response(body, { status: response.status, headers: response.headers });
      } catch (error) {
        if (error instanceof CaixaAPIError && !error.retryable) {
          throw error;
        }

        if (controller.signal.aborted) {
          lastError = new Error(`Request timeout after ${this.timeout}ms`);
        } else {
          lastError = error as Error;
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(this.getBackoffDelay(error, attempt + 1), this.maxRetryDelayMs);
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

  async fetchAllDraws(
    startContest: number = 1,
    endContest?: number,
    options: { allowPartial?: boolean } = {}
  ): Promise<Draw[]> {
    const draws: Draw[] = [];
    const failedContests: Array<{ contest: number; errorMessage: string }> = [];

    // First, get the latest draw to know the range
    if (!endContest) {
      logger.info('caixa.fetch_latest_range');
      const latestDraw = await this.fetchDraw();
      endContest = latestDraw.contest;
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

        // Progressive rate limiting - increase delay as we fetch more, bounded
        // so a full-history pull stays a matter of minutes rather than hours.
        let delay: number = API_CONFIG.RATE_LIMIT_DELAY;
        if (successCount > API_CONFIG.PROGRESSIVE_DELAY_THRESHOLD) {
          const progressiveBatches = Math.floor(
            (successCount - API_CONFIG.PROGRESSIVE_DELAY_THRESHOLD) / 100
          );
          delay = Math.min(
            delay + progressiveBatches * API_CONFIG.PROGRESSIVE_DELAY_INCREMENT,
            API_CONFIG.PROGRESSIVE_DELAY_MAX
          );
        }

        await this.delay(delay);
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        failedContests.push({ contest, errorMessage: errorMsg });
        logger.error('caixa.fetch_draw_failed', error, {
          contest,
          endContest,
          errorMessage: errorMsg,
        });

        // Add extra delay after errors to avoid triggering rate limits
        await this.delay(API_CONFIG.RATE_LIMIT_DELAY * 3);
        if (!options.allowPartial) {
          throw new Error(
            `Failed to fetch complete draw range; contest ${contest} failed: ${errorMsg}`
          );
        }
      }
    }

    logger.info('caixa.fetch_complete', {
      startContest,
      endContest,
      totalDraws,
      successCount,
      errorCount,
      failedContests: failedContests.map((failure) => failure.contest),
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
