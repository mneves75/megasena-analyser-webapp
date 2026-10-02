import { z } from 'zod';
import { StatisticsEngine } from '../analytics/statistics';
import { BetGenerator } from '../analytics/bet-generator';
import { BET_GENERATION_LIMITS, BET_GENERATION_MODE } from '../constants';
import { DelayAnalysisEngine } from '../analytics/delay-analysis';
import { DecadeAnalysisEngine } from '../analytics/decade-analysis';
import { TimeSeriesEngine } from '../analytics/time-series';
import { PairAnalysisEngine } from '../analytics/pair-analysis';
import { ParityAnalysisEngine } from '../analytics/parity-analysis';
import { PrimeAnalysisEngine } from '../analytics/prime-analysis';
import { SumAnalysisEngine } from '../analytics/sum-analysis';
import { StreakAnalysisEngine } from '../analytics/streak-analysis';
import { PrizeCorrelationEngine } from '../analytics/prize-correlation';
import { DrawArchiveEngine } from '../analytics/draw-archive';
import { parseDrawsQuery, parseNumbersQuery } from './archive-contract';
import { logger } from '../logger';
import type { AuditEventInput, AuditEventName } from '../audit';
import { buildApiSecurityHeaders } from '../security/csp';
import {
  isJsonContentType,
  RequestBodyTooLargeError,
  readJsonBodyWithLimit,
} from '../security/http';
import { parseTrendNumbers, parseTrendsQuery } from '../security/trends-input';
import { hashForAudit } from '../security/pseudonymize';
import { createHash, createHmac } from 'node:crypto';
import {
  buildResponseCacheKey,
  ContestResponseCache,
  getDrawsVersion,
} from './response-cache';

export interface ApiPeer {
  /** Trusted adapter metadata; public headers never authorize internal calls. */
  clientIp?: string | null;
  internal?: boolean;
  secure?: boolean;
}
export interface ApiHandlerOptions {
  environment: string;
  appVersion: string;
  ipHashSecret?: string | undefined;
  allowedOrigins?: string | undefined;
  minHealthTotalDraws?: number;
  uptime?: () => number;
  audit: (event: AuditEventInput) => void | Promise<void>;
  checkRateLimit?: (clientId: string) => { allowed: boolean; remaining: number; resetAt: number };
}
export function createApiHandler(options: ApiHandlerOptions) {
  if (options.environment === 'production' && (options.ipHashSecret?.trim().length ?? 0) < 32) {
    throw new Error('IP_HASH_SECRET required in production (at least 32 characters)');
  }
  const startedAt = Date.now();
  // Input validation schemas
  const generateBetsSchema = z.object({
    budget: z.number().min(BET_GENERATION_LIMITS.MIN_BUDGET).max(BET_GENERATION_LIMITS.MAX_BUDGET),
    strategy: z.enum(['random', 'hot_numbers', 'cold_numbers', 'balanced', 'fibonacci']).optional(),
    mode: z.enum(['simple_only', 'multiple_only', 'mixed', 'optimized']).optional(),
  });

  // CORS configuration
  const isDevelopment = options.environment === 'development';

  const ALLOWED_ORIGINS = isDevelopment
    ? [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:3201',
      ]
    : (options.allowedOrigins ?? 'https://megasena-analyzer.com.br')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => {
          // In production, only allow HTTPS origins
          const isValid = origin.startsWith('https://');
          if (!isValid) {
            logger.warn('security.origin_rejected_non_https', { origin });
          }
          return isValid;
        });

  // Rate limiter configuration
  const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute
  const MAX_REQUEST_BODY_SIZE = 1024 * 10; // 10KB
  const RATE_LIMIT_CACHE_MAX_SIZE = 10000; // Maximum entries in rate limit cache

  interface RateLimitEntry {
    count: number;
    resetAt: number;
  }

  interface RequestContext {
    requestId: string;
    route: string;
    method: string;
    userAgent?: string;
    clientId: string;
    origin?: string | null;
    isSecure: boolean;
    launchStage: string;
    audit?: {
      event: AuditEventName;
      metadata?: Record<string, unknown>;
    };
  }

  const MIN_HEALTH_TOTAL_DRAWS = (options.minHealthTotalDraws ?? 1);

  /**
   * Simple LRU Cache for rate limiting
   * Prevents memory leak by limiting maximum entries
   */
  class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;

    constructor(maxSize: number) {
      this.cache = new Map();
      this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
      const value = this.cache.get(key);
      if (value !== undefined) {
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, value);
      }
      return value;
    }

    set(key: K, value: V): void {
      // Delete if exists (to reinsert at end)
      this.cache.delete(key);

      // Remove oldest if at capacity
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      this.cache.set(key, value);
    }

    delete(key: K): boolean {
      return this.cache.delete(key);
    }

    get size(): number {
      return this.cache.size;
    }

    clear(): void {
      this.cache.clear();
    }

    entries(): IterableIterator<[K, V]> {
      return this.cache.entries();
    }
  }

  const rateLimiterCache = new LRUCache<string, RateLimitEntry>(RATE_LIMIT_CACHE_MAX_SIZE);
  const analyticsResponseCache = new ContestResponseCache(32);
  // Trends keys derive from user-chosen number sets (high cardinality); a separate
  // instance keeps that traffic from evicting the shared analytics entries above.
  const trendsResponseCache = new ContestResponseCache(64);
  // Public archive views crawled page by page. Only the costly number views are
  // cached (60 profiles + the index = 61 validated keys, below capacity); single
  // draws and year lists are indexed lookups and bypass the cache entirely.
  const archiveResponseCache = new ContestResponseCache(64);

  /**
   * Create a standardized error response
   */
  function createErrorResponse(
    ctx: RequestContext,
    error: string,
    details?: unknown,
    status: number = 400
  ): Response {
    const includeDetails = options.environment !== 'production';

    return new Response(
      JSON.stringify({
        success: false,
        error,
        ...(includeDetails ? { details } : {}),
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  function getRateLimitKey(clientIp: string | null): string {
    if (!clientIp) {
      return 'unknown';
    }

    const secret = options.ipHashSecret?.trim();
    if (!secret || secret.length < 32) return `sha256:${createHash('sha256').update(clientIp).digest('hex')}`;
    const windowId = Math.max(0, Math.floor((Date.now() - Date.parse('2026-01-01T00:00:00.000Z')) / (30 * 24 * 60 * 60 * 1000)));
    return `hmac-sha256:v1:${windowId}:${createHmac('sha256', secret).update(`v1:${windowId}:${clientIp}`).digest('hex')}`;
  }

  function createRequestContext(
    req: Request,
    url: URL,
    clientId: string,
    requestIsSecure: boolean
  ): RequestContext {
    const context: RequestContext = {
      requestId: crypto.randomUUID(),
      route: url.pathname,
      method: req.method,
      clientId,
      origin: req.headers.get('origin'),
      isSecure: requestIsSecure,
      launchStage: options.environment ?? 'development',
    };

    const userAgent = req.headers.get('user-agent');
    if (userAgent) {
      context.userAgent = userAgent;
    }

    return context;
  }

  function withRequestIdHeader(response: Response, ctx: RequestContext): Response {
    const headers = new Headers(response.headers);
    headers.set('X-Request-Id', ctx.requestId);

    const securityHeaders = buildApiSecurityHeaders(isDevelopment, ctx.isSecure);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  function checkRateLimit(clientIp: string | null): { allowed: boolean; remaining: number; resetAt: number } {
    const key = getRateLimitKey(clientIp);
    const now = Date.now();

    let entry = rateLimiterCache.get(key);

    // Clean up expired entry or create new one
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW,
      };
      rateLimiterCache.set(key, entry);

      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - 1,
        resetAt: entry.resetAt
      };
    }

    entry.count++;
    rateLimiterCache.set(key, entry); // Update cache

    const allowed = entry.count <= RATE_LIMIT_MAX_REQUESTS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);

    return { allowed, remaining, resetAt: entry.resetAt };
  }

  /**
   * Get CORS headers for response
   * Validates origin against allowed list and returns appropriate headers
   * In production, only HTTPS origins are allowed
   */
  function getCorsHeaders(origin: string | null): Record<string, string> {
    // If no origin header (same-origin request), don't add CORS headers
    if (!origin) {
      return {};
    }

    // Check if origin is allowed (no wildcard support for security)
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    if (!isAllowed) {
      logger.warn('security.cors_origin_rejected', {
        origin,
        allowedOriginsCount: ALLOWED_ORIGINS.length,
      });
      return {};
    }

    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
      'Vary': 'Origin',
    };
  }

  // Define API route handlers
  const apiHandlers: Record<
    string,
    (req: Request, ctx: RequestContext) => Promise<Response> | Response
  > = {
    '/api/health': async (_req, ctx) => {
      ctx.audit = { event: 'api.health_read' };
      try {
        // Check database connectivity
        const stats = new StatisticsEngine();
        const statistics = stats.getDrawStatistics();
        const drawCount = statistics.totalDraws;
        const dataReady =
          Number.isFinite(MIN_HEALTH_TOTAL_DRAWS) &&
          MIN_HEALTH_TOTAL_DRAWS > 0 &&
          drawCount >= MIN_HEALTH_TOTAL_DRAWS;

        const health = {
          status: dataReady ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: (options.uptime?.() ?? (Date.now() - startedAt) / 1000),
          database: {
            connected: true,
            totalDraws: drawCount,
            minTotalDraws: MIN_HEALTH_TOTAL_DRAWS,
            lastContestNumber: statistics.lastContestNumber,
            lastDrawDate: statistics.lastDrawDate,
            dataReady,
          },
          version: options.appVersion,
        };

        return new Response(JSON.stringify(health), {
          status: dataReady ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.health_check_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return new Response(
          JSON.stringify({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            requestId: ctx.requestId,
            error: options.environment === 'production'
              ? 'Health check failed'
              : error instanceof Error
                ? error.message
                : 'Unknown error',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },

    '/api/dashboard': async (_req, ctx) => {
      ctx.audit = { event: 'api.dashboard_read' };
      try {
        const cacheKey = buildResponseCacheKey(ctx.route);
        const drawsVersion = getDrawsVersion();
        const body = analyticsResponseCache.getOrCompute(cacheKey, drawsVersion, () => {
          const stats = new StatisticsEngine();
          const statistics = stats.getDrawStatistics();
          const recentDraws = stats.getDrawHistory(5);

          // Add hot streaks (trending numbers)
          const streakEngine = new StreakAnalysisEngine(10);
          const hotNumbers = streakEngine.getHotNumbers(10);

          return { statistics, recentDraws, hotNumbers };
        });

        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.dashboard_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível carregar os dados do painel.', null, 500);
      }
    },

    '/api/statistics': async (req, ctx) => {
      try {
        const url = new URL(req.url);
        const includeDelays = url.searchParams.get('delays') === 'true';
        const includeDecades = url.searchParams.get('decades') === 'true';
        const includePairs = url.searchParams.get('pairs') === 'true';
        const includeParity = url.searchParams.get('parity') === 'true';
        const includePrimes = url.searchParams.get('primes') === 'true';
        const includeSum = url.searchParams.get('sum') === 'true';
        const includeStreaks = url.searchParams.get('streaks') === 'true';
        const includePrizeCorr = url.searchParams.get('prize') === 'true';

        ctx.audit = {
          event: 'api.statistics_read',
          metadata: {
            includeDelays,
            includeDecades,
            includePairs,
            includeParity,
            includePrimes,
            includeSum,
            includeStreaks,
            includePrizeCorrelation: includePrizeCorr,
          },
        };

        const cacheKey = buildResponseCacheKey(ctx.route, {
          delays: includeDelays,
          decades: includeDecades,
          pairs: includePairs,
          parity: includeParity,
          primes: includePrimes,
          sum: includeSum,
          streaks: includeStreaks,
          prize: includePrizeCorr,
        });
        const drawsVersion = getDrawsVersion();
        const body = analyticsResponseCache.getOrCompute(cacheKey, drawsVersion, () => {
          const stats = new StatisticsEngine();
          const summary = stats.getDrawStatistics();
          const frequencies = stats.getNumberFrequencies();
          const patterns = stats.detectPatterns();

          const response: Record<string, unknown> = { summary, frequencies, patterns };

          if (includeDelays) {
            const delayEngine = new DelayAnalysisEngine();
            const delays = delayEngine.getNumberDelays();
            response['delays'] = delays;
            response['delayDistribution'] = delayEngine.getDelayDistribution(delays);
          }

          if (includeDecades) {
            const decadeEngine = new DecadeAnalysisEngine();
            response['decades'] = decadeEngine.getDecadeDistribution();
          }

          if (includePairs) {
            const pairEngine = new PairAnalysisEngine();
            response['pairs'] = pairEngine.getNumberPairs(5); // Min 5 occurrences
          }

          if (includeParity) {
            const parityEngine = new ParityAnalysisEngine();
            response['parity'] = parityEngine.getParityDistribution();
            response['parityStats'] = parityEngine.getParityStats();
          }

          if (includePrimes) {
            const primeEngine = new PrimeAnalysisEngine();
            response['primes'] = primeEngine.getPrimeDistribution();
          }

          if (includeSum) {
            const sumEngine = new SumAnalysisEngine();
            response['sumStats'] = sumEngine.getSumDistribution();
          }

          if (includeStreaks) {
            const streakEngine = new StreakAnalysisEngine(10);
            const streakSets = streakEngine.getStreakSets(15, 15);
            response['hotNumbers'] = streakSets.hotNumbers;
            response['coldNumbers'] = streakSets.coldNumbers;
          }

          if (includePrizeCorr) {
            const prizeEngine = new PrizeCorrelationEngine();
            const correlationSets = prizeEngine.getCorrelationSets(15, 15);
            response['luckyNumbers'] = correlationSets.luckyNumbers;
            response['unluckyNumbers'] = correlationSets.unluckyNumbers;
          }

          return response;
        });

        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.statistics_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível carregar os dados estatísticos.', null, 500);
      }
    },

    '/api/trends': async (req, ctx) => {
      ctx.audit = { event: 'api.trends_read' };
      try {
        const url = new URL(req.url);
        const numbersParam = url.searchParams.get('numbers');
        const periodParam = url.searchParams.get('period');

        if (!numbersParam) {
          ctx.audit = {
            event: 'api.trends_read',
            metadata: { validationError: true, reason: 'numbers_missing' },
          };
          return createErrorResponse(ctx, 'Informe os números para análise.');
        }

        ctx.audit = {
          event: 'api.trends_read',
          metadata: {
            period: periodParam ?? 'yearly',
            numbersHash: hashForAudit(numbersParam),
          },
        };

        // Validate query parameters
        const parseResult = parseTrendsQuery(url.searchParams);

        if (!parseResult.success) {
          ctx.audit = {
            event: 'api.trends_read',
            metadata: {
              period: periodParam ?? 'yearly',
              numbersHash: hashForAudit(numbersParam),
              validationError: true,
            },
          };
          return createErrorResponse(ctx, 'Parâmetros de consulta inválidos.', parseResult.error.format());
        }

        const { numbers: numbersStr, period } = parseResult.data;
        const parsedNumbers = parseTrendNumbers(numbersStr);

        if (!parsedNumbers.success) {
          ctx.audit = {
            event: 'api.trends_read',
            metadata: {
              period,
              numbersHash: hashForAudit(numbersStr),
              validationError: true,
              reason: parsedNumbers.reason,
            },
          };
          return createErrorResponse(ctx, 'Informe números válidos entre 1 e 60.');
        }

        const numbers = parsedNumbers.numbers;

        ctx.audit = {
          event: 'api.trends_read',
          metadata: {
            period,
            numbersHash: hashForAudit(numbersStr),
            numbersCount: numbers.length,
          },
        };

        // Preserve the caller-requested order in the response while keying the cache
        // on the canonical sorted set. Data values are per-number, so permuted
        // requests can safely share a cache entry and still get their own ordering.
        const requestedNumbers = [...numbers];
        const canonicalNumbers = [...numbers].sort((a, b) => a - b);
        const cacheKey = buildResponseCacheKey(ctx.route, {
          period,
          numbers: canonicalNumbers.join(','),
        });
        const drawsVersion = getDrawsVersion();
        const body = trendsResponseCache.getOrCompute(cacheKey, drawsVersion, () => {
          const timeSeriesEngine = new TimeSeriesEngine();
          const data = timeSeriesEngine.getFrequencyTimeSeries(canonicalNumbers, period);
          return { data, numbers: canonicalNumbers, period };
        });

        const payload = JSON.parse(body) as { data: unknown; numbers: number[]; period: string };
        payload.numbers = requestedNumbers;

        return new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.trends_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível carregar os dados de tendência.', null, 500);
      }
    },

    '/api/draws': (req, ctx) => {
      ctx.audit = { event: 'api.draws_read' };
      try {
        const query = parseDrawsQuery(new URL(req.url).searchParams);
        if (!query) {
          ctx.audit = { event: 'api.draws_read', metadata: { validationError: true } };
          return createErrorResponse(ctx, 'Parâmetros de consulta inválidos.');
        }
        ctx.audit = { event: 'api.draws_read', metadata: { view: query.kind } };

        const engine = new DrawArchiveEngine();
        const payload =
          query.kind === 'contest'
            ? engine.getDrawPage(query.contest)
            : query.kind === 'year'
              ? engine.getYearArchive(query.year)
              : query.kind === 'megaDaVirada'
                ? engine.getMegaDaVirada()
                : engine.getArchiveIndex();
        if (payload === null) {
          return createErrorResponse(ctx, 'Nenhum sorteio encontrado.', null, 404);
        }

        return new Response(JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.draws_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível carregar os resultados.', null, 500);
      }
    },

    '/api/numbers': (req, ctx) => {
      ctx.audit = { event: 'api.numbers_read' };
      try {
        const query = parseNumbersQuery(new URL(req.url).searchParams);
        if (!query) {
          ctx.audit = { event: 'api.numbers_read', metadata: { validationError: true } };
          return createErrorResponse(ctx, 'Informe um número válido entre 1 e 60.');
        }
        ctx.audit = { event: 'api.numbers_read', metadata: { view: query.kind } };

        const cacheKey = buildResponseCacheKey(
          ctx.route,
          query.kind === 'number' ? { n: query.number } : {}
        );
        const body = archiveResponseCache.getOrCompute(cacheKey, getDrawsVersion(), () => {
          const engine = new DrawArchiveEngine();
          return query.kind === 'number'
            ? engine.getNumberProfile(query.number)
            : engine.getNumbersIndex();
        });

        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.numbers_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível carregar os números.', null, 500);
      }
    },

    '/api/sitemap': (_req, ctx) => {
      ctx.audit = { event: 'api.sitemap_read' };
      try {
        return new Response(JSON.stringify(new DrawArchiveEngine().getSitemapData()), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('api.sitemap_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível montar o índice do site.', null, 500);
      }
    },

    '/api/generate-bets': async (req, ctx) => {
      ctx.audit = { event: 'bets.generate_requested' };
      try {
        if (req.method !== 'POST') {
          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: { validationError: true, reason: 'method_not_allowed' },
          };
          return createErrorResponse(ctx, 'Método não permitido.', null, 405);
        }

        if (!isJsonContentType(req)) {
          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: { validationError: true, reason: 'invalid_content_type' },
          };
          return createErrorResponse(ctx, 'Content-Type deve ser application/json.', null, 415);
        }

        // Parse and validate request body
        let body: unknown;
        try {
          body = await readJsonBodyWithLimit(req, MAX_REQUEST_BODY_SIZE);
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            ctx.audit = {
              event: 'bets.generate_requested',
              metadata: {
                validationError: true,
                reason: 'body_too_large',
                actualSize: error.actualBytes,
                maxSize: error.maxBytes,
              },
            };
            return createErrorResponse(ctx, 'Corpo da requisição muito grande.', { maxSize: MAX_REQUEST_BODY_SIZE }, 413);
          }

          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: { validationError: true, reason: 'invalid_json' },
          };
          return createErrorResponse(ctx, 'JSON inválido no corpo da requisição.');
        }

        const parseResult = generateBetsSchema.safeParse(body);
        if (!parseResult.success) {
          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: { validationError: true, reason: 'invalid_input' },
          };
          return createErrorResponse(ctx, 'Dados inválidos.', parseResult.error.format());
        }

        const {
          budget,
          strategy = 'balanced',
          mode = BET_GENERATION_MODE.OPTIMIZED,
        } = parseResult.data;

        if (
          mode === BET_GENERATION_MODE.OPTIMIZED &&
          budget > BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET
        ) {
          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: {
              validationError: true,
              reason: 'optimized_budget_too_high',
              budget,
              maxBudget: BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET,
            },
          };
          return createErrorResponse(
            ctx,
            `Orçamento otimizado limitado a R$ ${BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET.toLocaleString(
              'pt-BR'
            )},00. Use outro modo para valores maiores.`,
            null,
            400
          );
        }

        ctx.audit = {
          event: 'bets.generate_requested',
          metadata: {
            budget,
            strategy,
            mode,
          },
        };

        const generator = new BetGenerator();
        const result = generator.generateOptimizedBets(budget, mode, strategy);

        ctx.audit = {
          event: 'bets.generate_requested',
          metadata: {
            budget,
            strategy,
            mode,
            betsCount: result.bets.length,
            totalCost: result.totalCost,
            totalNumbers: result.totalNumbers,
          },
        };

        logger.info('bets.generate_completed', {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
          budget,
          strategy,
          mode,
          betsCount: result.bets.length,
          totalCost: result.totalCost,
          remainingBudget: result.remainingBudget,
          budgetUtilization: result.budgetUtilization,
          totalNumbers: result.totalNumbers,
        });

        return new Response(JSON.stringify({ success: true, data: result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('bets.generate_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível gerar as apostas.', null, 500);
      }
    },
  };

  const apiAllowedMethods: Record<string, readonly string[]> = {
    '/api/health': ['GET'],
    '/api/dashboard': ['GET'],
    '/api/statistics': ['GET'],
    '/api/trends': ['GET'],
    '/api/draws': ['GET'],
    '/api/numbers': ['GET'],
    '/api/sitemap': ['GET'],
    '/api/generate-bets': ['POST'],
  };

  const apiAuditEvents: Record<string, AuditEventName> = {
    '/api/health': 'api.health_read',
    '/api/dashboard': 'api.dashboard_read',
    '/api/statistics': 'api.statistics_read',
    '/api/trends': 'api.trends_read',
    '/api/draws': 'api.draws_read',
    '/api/numbers': 'api.numbers_read',
    '/api/sitemap': 'api.sitemap_read',
    '/api/generate-bets': 'bets.generate_requested',
  };

  function createMethodNotAllowedResponse(ctx: RequestContext, allowedMethods: readonly string[]): Response {
    const response = createErrorResponse(ctx, 'Método não permitido.', null, 405);
    const headers = new Headers(response.headers);
    headers.set('Allow', allowedMethods.join(', '));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  async function fetch(req: Request, peer: ApiPeer = {}): Promise<Response> {
      const url = new URL(req.url);
      const startTime = Date.now();
      const clientIp = peer.clientIp ?? null;
      const rateLimitExempt = peer.internal === true && clientIp === null;
      const ctx = createRequestContext(req, url, getRateLimitKey(clientIp), peer.secure ?? url.protocol === 'https:');
      const corsHeaders = getCorsHeaders(ctx.origin ?? null);

      logger.info('api.request_received', {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
        userAgent: ctx.userAgent,
        launchStage: ctx.launchStage,
        clientId: ctx.clientId,
      });

      try {
        // Handle non-API CORS preflight requests.
        if (req.method === 'OPTIONS' && !url.pathname.startsWith('/api/')) {
          const response = new Response(null, {
            status: 204,
            headers: corsHeaders,
          });
          const finalized = withRequestIdHeader(response, ctx);
          logger.info('api.request_completed', {
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            durationMs: Date.now() - startTime,
          });
          return finalized;
        }

        // Apply rate limiting to all API routes, including public health checks.
        if (url.pathname.startsWith('/api/')) {
          const rateLimit = rateLimitExempt
            ? {
                allowed: true,
                remaining: RATE_LIMIT_MAX_REQUESTS,
                resetAt: Date.now() + RATE_LIMIT_WINDOW,
              }
            : options.checkRateLimit?.(getRateLimitKey(clientIp)) ?? checkRateLimit(clientIp);

          if (!rateLimit.allowed) {
            logger.warn('api.rate_limit_exceeded', {
              requestId: ctx.requestId,
              route: ctx.route,
              method: ctx.method,
              clientId: ctx.clientId,
            });

            const response = new Response(
              JSON.stringify({
                error: 'Muitas requisições',
                requestId: ctx.requestId,
                message: `Limite de requisições excedido. Tente novamente em ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} segundos.`,
              }),
              {
                status: 429,
                headers: {
                  'Content-Type': 'application/json',
                  'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
                  'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                  'X-RateLimit-Reset': rateLimit.resetAt.toString(),
                  'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
                  ...corsHeaders,
                },
              }
            );

            const finalized = withRequestIdHeader(response, ctx);
            logger.info('api.request_completed', {
              requestId: ctx.requestId,
              route: ctx.route,
              method: ctx.method,
              statusCode: finalized.status,
              durationMs: Date.now() - startTime,
            });

            return finalized;
          }

          // Handle API CORS preflight only after consuming the rate-limit budget.
          if (req.method === 'OPTIONS') {
            const response = new Response(null, {
              status: 204,
              headers: corsHeaders,
            });

            const headers = new Headers(response.headers);
            headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
            headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
            headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());

            const finalized = withRequestIdHeader(
              new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
              }),
              ctx
            );

            logger.info('api.request_completed', {
              requestId: ctx.requestId,
              route: ctx.route,
              method: ctx.method,
              statusCode: finalized.status,
              durationMs: Date.now() - startTime,
            });

            return finalized;
          }

          // Add rate limit headers to successful responses
          const response = await (async () => {
            const handler = apiHandlers[url.pathname];
            if (handler) {
              const allowedMethods = apiAllowedMethods[url.pathname];
              if (allowedMethods && !allowedMethods.includes(req.method)) {
                ctx.audit = {
                  event: apiAuditEvents[url.pathname] ?? 'api.dashboard_read',
                  metadata: { validationError: true, reason: 'method_not_allowed' },
                };
                return createMethodNotAllowedResponse(ctx, allowedMethods);
              }
              return handler(req, ctx);
            }

            return createErrorResponse(ctx, 'Não encontrado.', null, 404);
          })();

          // Clone response to add headers (rate limit + CORS)
          const headers = new Headers(response.headers);
          headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
          headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
          headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());

          Object.entries(corsHeaders).forEach(([key, value]) => {
            headers.set(key, value);
          });

          const finalized = withRequestIdHeader(
            new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            }),
            ctx
          );

          if (ctx.audit) {
            const auditEvent: AuditEventInput = {
              event: ctx.audit.event,
              requestId: ctx.requestId,
              route: ctx.route,
              method: ctx.method,
              statusCode: finalized.status,
              success: finalized.status < 400,
              durationMs: Date.now() - startTime,
              clientIdHash: ctx.clientId,
            };

            if (ctx.userAgent) {
              auditEvent.userAgent = ctx.userAgent;
            }
            if (ctx.audit.metadata) {
              auditEvent.metadata = ctx.audit.metadata;
            }

            await options.audit(auditEvent);
          }

          logger.info('api.request_completed', {
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            durationMs: Date.now() - startTime,
          });

          return finalized;
        }

        // Handle any non-/api route registered in apiHandlers.
        const handler = apiHandlers[url.pathname];
        if (handler) {
          const response = await handler(req, ctx);

          const headers = new Headers(response.headers);
          Object.entries(corsHeaders).forEach(([key, value]) => {
            headers.set(key, value);
          });

          const finalized = withRequestIdHeader(
            new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            }),
            ctx
          );

          if (ctx.audit) {
            const auditEvent: AuditEventInput = {
              event: ctx.audit.event,
              requestId: ctx.requestId,
              route: ctx.route,
              method: ctx.method,
              statusCode: finalized.status,
              success: finalized.status < 400,
              durationMs: Date.now() - startTime,
              clientIdHash: ctx.clientId,
            };

            if (ctx.userAgent) {
              auditEvent.userAgent = ctx.userAgent;
            }
            if (ctx.audit.metadata) {
              auditEvent.metadata = ctx.audit.metadata;
            }

            await options.audit(auditEvent);
          }

          logger.info('api.request_completed', {
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            durationMs: Date.now() - startTime,
          });

          return finalized;
        }

        const notFound = createErrorResponse(ctx, 'Não encontrado.', null, 404);
        const finalized = withRequestIdHeader(
          new Response(notFound.body, {
            status: notFound.status,
            statusText: notFound.statusText,
            headers: {
              ...Object.fromEntries(notFound.headers.entries()),
              ...corsHeaders,
            },
          }),
          ctx
        );

        if (ctx.audit) {
          const auditEvent: AuditEventInput = {
            event: ctx.audit.event,
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            success: finalized.status < 400,
            durationMs: Date.now() - startTime,
            clientIdHash: ctx.clientId,
          };

          if (ctx.userAgent) {
            auditEvent.userAgent = ctx.userAgent;
          }
          if (ctx.audit.metadata) {
            auditEvent.metadata = ctx.audit.metadata;
          }

          await options.audit(auditEvent);
        }

        logger.info('api.request_completed', {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
          statusCode: finalized.status,
          durationMs: Date.now() - startTime,
        });

        return finalized;
      } catch (error) {
        logger.error('api.unhandled_exception', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
          durationMs: Date.now() - startTime,
        });

        const response = createErrorResponse(ctx, 'Erro interno do servidor.', null, 500);
        return withRequestIdHeader(response, ctx);
      }
    }
  return { fetch, routes: Object.keys(apiHandlers).sort() };
}
