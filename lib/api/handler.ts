import { z } from 'zod';
import { StatisticsEngine } from '../analytics/statistics';
import { BetGenerator } from '../analytics/bet-generator';
import { BetGenerationInputError } from '../analytics/bet-generator';
import { BET_GENERATION_LIMITS, BET_GENERATION_MODE, MEGASENA_CONSTANTS } from '../constants';
import siteDomains from '../site-domains.json';
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
import {
  FIRST_DRAW_YEAR,
  LAST_ACCEPTED_YEAR,
  parseDrawsQuery,
  parseNumbersQuery,
} from './archive-contract';
import { logger } from '../logger';
import type { AuditEventInput, AuditEventName } from '../audit';
import { buildApiSecurityHeaders } from '../security/csp';
import {
  isJsonContentType,
  rateLimitSubject,
  RequestBodyTooLargeError,
  readJsonBodyWithLimit,
} from '../security/http';
import { parseTrendNumbers, parseTrendsQuery } from '../security/trends-input';
import { hashForAudit, pseudonymizeClient } from '../security/pseudonymize';
import { randomBytes } from 'node:crypto';
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

/**
 * One window and one quota for every adapter. They were duplicated in the
 * Durable Object as literals (100 / 60000), so raising the quota here changed
 * the advertised header but not the enforcement.
 */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 100;
export interface ApiHandlerOptions {
  environment: string;
  appVersion: string;
  ipHashSecret?: string | undefined;
  allowedOrigins?: string | undefined;
  minHealthTotalDraws?: number;
  uptime?: () => number;
  schedulerStatus?: () => Promise<{ enabled: boolean; nextAlarmAt: number | null }>;
  audit: (event: AuditEventInput) => void | Promise<void>;
  checkRateLimit?: (clientId: string) => RateLimitDecision;
}

/** `count` is the subject's requests in the current window, including this one. */
export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  count: number;
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
    : (options.allowedOrigins ?? `https://${siteDomains.primaryDomain}`)
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

  // Request body cap and cache bound; the limiter window and quota are shared
  // module constants so the Bun cache and the Durable Object cannot diverge.
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
    /** A repeated rejection in one rate-limit window: no audit row, no log row. */
    unrecorded?: boolean;
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
  // Public archive views crawled page by page. Listings shared by many pages each
  // scan the whole draws table, so they are cached by draws revision, sized to hold
  // every validated key: each accepted year (empty years cache their 404 body too),
  // the number profiles, plus the number index, archive index, Mega da Virada and
  // sitemap. Single draws are 3,000+ crawl-once keys and bypass the cache.
  const archiveResponseCache = new ContestResponseCache(
    LAST_ACCEPTED_YEAR - FIRST_DRAW_YEAR + 1 + MEGASENA_CONSTANTS.MAX_NUMBER + 4
  );

  /**
   * Per-handler salt for environments that have no `IP_HASH_SECRET`.
   *
   * The client digest is persisted for 400 days as the audit `clientIdHash`, so
   * falling back to an unsalted SHA-256 of the address would store a reversible
   * identifier: the whole IPv4 space is small enough to brute force. A random
   * per-process salt keeps the grouping within one instance without making the
   * stored value linkable across restarts or enumerable from an address.
   */
  const fallbackAuditSalt = randomBytes(32);

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

    // Group by network, not by address: see rateLimitSubject for why a /128 key
    // gives one IPv6 client an unbounded number of buckets.
    return pseudonymizeClient(rateLimitSubject(clientIp) || clientIp, options.ipHashSecret, fallbackAuditSalt);
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

  /**
   * Single exit for every response: request id + security headers, the audit
   * record, and the completion log. This block had been copied four times and
   * the copies had already diverged: the 429 path never audited the request.
   */
  async function finalize(
    ctx: RequestContext,
    response: Response,
    startTime: number
  ): Promise<Response> {
    const finalized = withRequestIdHeader(response, ctx);
    if (ctx.unrecorded) {
      return finalized;
    }

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

  function checkRateLimit(key: string): RateLimitDecision {
    const now = Date.now();

    let entry = rateLimiterCache.get(key);

    // A window expires at resetAt, as in the Durable Object (reset_at <= now).
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      };
      rateLimiterCache.set(key, entry);

      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - 1,
        resetAt: entry.resetAt,
        count: 1,
      };
    }

    entry.count++;
    rateLimiterCache.set(key, entry); // Update cache

    const allowed = entry.count <= RATE_LIMIT_MAX_REQUESTS;
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);

    return { allowed, remaining, resetAt: entry.resetAt, count: entry.count };
  }

  /**
   * Get CORS headers for response
   * Validates origin against allowed list and returns appropriate headers
   * In production, only HTTPS origins are allowed
   */
  function getCorsHeaders(origin: string | null, logRejection: boolean): Record<string, string> {
    // If no origin header (same-origin request), don't add CORS headers
    if (!origin) {
      return {};
    }

    // Check if origin is allowed (no wildcard support for security)
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    if (!isAllowed) {
      if (logRejection) logger.warn('security.cors_origin_rejected', {
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

  // One record per route, so its methods, audit event and handler cannot drift apart.
  interface ApiRoute {
    methods: readonly string[];
    auditEvent: AuditEventName;
    handle: (req: Request, ctx: RequestContext) => Promise<Response> | Response;
  }

  const apiRoutes: Record<string, ApiRoute> = {
    '/api/health': { methods: ['GET'], auditEvent: 'api.health_read', handle: async (_req, ctx) => {
      ctx.audit = { event: 'api.health_read' };
      try {
        // Check database connectivity
        const summary = new StatisticsEngine().getDrawSummary();
        const drawCount = summary.totalDraws;
        const dataReady =
          Number.isFinite(MIN_HEALTH_TOTAL_DRAWS) &&
          MIN_HEALTH_TOTAL_DRAWS > 0 &&
          drawCount >= MIN_HEALTH_TOTAL_DRAWS;
        const scheduler = await options.schedulerStatus?.();

        const health = {
          status: dataReady ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          uptime: (options.uptime?.() ?? (Date.now() - startedAt) / 1000),
          database: {
            connected: true,
            totalDraws: drawCount,
            minTotalDraws: MIN_HEALTH_TOTAL_DRAWS,
            lastContestNumber: summary.lastContestNumber,
            lastDrawDate: summary.lastDrawDate,
            dataReady,
          },
          version: options.appVersion,
          ...(scheduler === undefined ? {} : {
            scheduler: { enabled: scheduler.enabled, nextAlarmAt: scheduler.nextAlarmAt },
          }),
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
    } },

    '/api/dashboard': { methods: ['GET'], auditEvent: 'api.dashboard_read', handle: async (_req, ctx) => {
      ctx.audit = { event: 'api.dashboard_read' };
      try {
        const cacheKey = buildResponseCacheKey(ctx.route, {}, options.appVersion);
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
    } },

    '/api/statistics': { methods: ['GET'], auditEvent: 'api.statistics_read', handle: async (req, ctx) => {
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
        }, options.appVersion);
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
    } },

    '/api/trends': { methods: ['GET'], auditEvent: 'api.trends_read', handle: async (req, ctx) => {
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
        }, options.appVersion);
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
    } },

    '/api/draws': { methods: ['GET'], auditEvent: 'api.draws_read', handle: (req, ctx) => {
      ctx.audit = { event: 'api.draws_read' };
      try {
        const query = parseDrawsQuery(new URL(req.url).searchParams);
        if (!query) {
          ctx.audit = { event: 'api.draws_read', metadata: { validationError: true } };
          return createErrorResponse(ctx, 'Parâmetros de consulta inválidos.');
        }
        ctx.audit = { event: 'api.draws_read', metadata: { view: query.kind } };

        const engine = new DrawArchiveEngine();
        const body =
          query.kind === 'contest'
            ? JSON.stringify(engine.getDrawPage(query.contest))
            : archiveResponseCache.getOrCompute(
                buildResponseCacheKey(ctx.route, query.kind === 'year' ? { year: query.year } : { view: query.kind }, options.appVersion),
                getDrawsVersion(),
                () => query.kind === 'year'
                  ? engine.getYearArchive(query.year)
                  : query.kind === 'megaDaVirada'
                    ? engine.getMegaDaVirada()
                    : engine.getArchiveIndex()
              );
        if (body === 'null') {
          return createErrorResponse(ctx, 'Nenhum sorteio encontrado.', null, 404);
        }

        return new Response(body, {
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
    } },

    '/api/numbers': { methods: ['GET'], auditEvent: 'api.numbers_read', handle: (req, ctx) => {
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
          query.kind === 'number' ? { n: query.number } : {},
          options.appVersion
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
    } },

    '/api/sitemap': { methods: ['GET'], auditEvent: 'api.sitemap_read', handle: (_req, ctx) => {
      ctx.audit = { event: 'api.sitemap_read' };
      try {
        const body = archiveResponseCache.getOrCompute(
          buildResponseCacheKey(ctx.route, {}, options.appVersion),
          getDrawsVersion(),
          () => new DrawArchiveEngine().getSitemapData()
        );
        return new Response(body, {
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
    } },

    '/api/generate-bets': { methods: ['POST'], auditEvent: 'bets.generate_requested', handle: async (req, ctx) => {
      ctx.audit = { event: 'bets.generate_requested' };
      try {
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
        if (error instanceof BetGenerationInputError) {
          ctx.audit = {
            event: 'bets.generate_requested',
            metadata: { validationError: true, reason: 'budget_below_mode_minimum' },
          };
          return createErrorResponse(ctx, error.message, null, 400);
        }

        logger.error('bets.generate_failed', error, {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
        });
        return createErrorResponse(ctx, 'Não foi possível gerar as apostas.', null, 500);
      }
    } },
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
    const ctx = createRequestContext(
      req,
      url,
      getRateLimitKey(clientIp),
      peer.secure ?? url.protocol === 'https:'
    );
    const rateLimitHeaders = (limit: {
      remaining: number;
      resetAt: number;
    }): Record<string, string> => ({
      'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
      'X-RateLimit-Remaining': limit.remaining.toString(),
      'X-RateLimit-Reset': limit.resetAt.toString(),
    });

    try {
      // A non-API path is never registered: answer the preflight and 404 the
      // rest. This replaces a branch that could not be reached, because every
      // registered handler lives under /api/.
      if (!url.pathname.startsWith('/api/')) {
        const corsHeaders = getCorsHeaders(ctx.origin ?? null, true);
        const response =
          req.method === 'OPTIONS'
            ? new Response(null, { status: 204, headers: corsHeaders })
            : createErrorResponse(ctx, 'Não encontrado.', null, 404);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
        return await finalize(
          ctx,
          new Response(response.body, { status: response.status, headers }),
          startTime
        );
      }

      // Every API route is metered, including the public health check and the
      // preflight, so a preflight cannot be used as an unmetered probe.
      const rateLimit = rateLimitExempt
        ? {
            allowed: true,
            remaining: RATE_LIMIT_MAX_REQUESTS,
            resetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
            count: 0,
          }
        : options.checkRateLimit?.(ctx.clientId) ?? checkRateLimit(ctx.clientId);
      // Decided after the limiter: a 429 past the first in its window writes no row
      // at all, the CORS rejection log included.
      const corsHeaders = getCorsHeaders(
        ctx.origin ?? null,
        rateLimit.allowed || rateLimit.count === RATE_LIMIT_MAX_REQUESTS + 1
      );

      if (!rateLimit.allowed) {
        // Only the first rejection in a window is written (audit row and log
        // rows); later ones answer the same 429 and still count, but write
        // nothing, so a flood cannot turn into a flood of rows.
        if (rateLimit.count === RATE_LIMIT_MAX_REQUESTS + 1) {
          logger.warn('api.rate_limit_exceeded', {
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            clientId: ctx.clientId,
          });

          // A known route is audited like any other outcome. An unknown path
          // keeps only the structured rate-limit log: labelling it as a
          // dashboard read put a false event in the audit table.
          const knownEvent = apiRoutes[url.pathname]?.auditEvent;
          if (knownEvent) {
            ctx.audit = { event: knownEvent, metadata: { rateLimited: true } };
          }
        } else {
          ctx.unrecorded = true;
        }

        const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
        return await finalize(
          ctx,
          new Response(
            JSON.stringify({
              error: 'Muitas requisições',
              requestId: ctx.requestId,
              message: `Limite de requisições excedido. Tente novamente em ${retryAfter} segundos.`,
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                ...rateLimitHeaders(rateLimit),
                'Retry-After': retryAfter.toString(),
                ...corsHeaders,
              },
            }
          ),
          startTime
        );
      }

      if (req.method === 'OPTIONS') {
        return await finalize(
          ctx,
          new Response(null, {
            status: 204,
            headers: { ...corsHeaders, ...rateLimitHeaders(rateLimit) },
          }),
          startTime
        );
      }

      const route = apiRoutes[url.pathname];
      const response = route
        ? await (async () => {
            if (!route.methods.includes(req.method)) {
              ctx.audit = {
                event: route.auditEvent,
                metadata: { validationError: true, reason: 'method_not_allowed' },
              };
              return createMethodNotAllowedResponse(ctx, route.methods);
            }
            return route.handle(req, ctx);
          })()
        : createErrorResponse(ctx, 'Não encontrado.', null, 404);

      const headers = new Headers(response.headers);
      Object.entries(rateLimitHeaders(rateLimit)).forEach(([key, value]) => headers.set(key, value));
      Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));

      return await finalize(
        ctx,
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        }),
        startTime
      );
    } catch (error) {
      logger.error('api.unhandled_exception', error, {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
        durationMs: Date.now() - startTime,
      });

      return withRequestIdHeader(
        createErrorResponse(ctx, 'Erro interno do servidor.', null, 500),
        ctx
      );
    }
  }

  return { fetch, routes: Object.keys(apiRoutes).sort() };
}
