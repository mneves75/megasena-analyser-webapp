#!/usr/bin/env bun
/**
 * Custom Bun server for Next.js
 * This allows API routes to run in Bun's runtime with access to bun:sqlite
 */

import { serve } from 'bun';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import './lib/log-sink.runtime';
import { runMigrations, closeDatabase } from './lib/db';
import { StatisticsEngine } from './lib/analytics/statistics';
import { BetGenerator } from './lib/analytics/bet-generator';
import { BET_GENERATION_MODE } from './lib/constants';
import { DelayAnalysisEngine } from './lib/analytics/delay-analysis';
import { DecadeAnalysisEngine } from './lib/analytics/decade-analysis';
import { TimeSeriesEngine } from './lib/analytics/time-series';
import { PairAnalysisEngine } from './lib/analytics/pair-analysis';
import { ParityAnalysisEngine } from './lib/analytics/parity-analysis';
import { PrimeAnalysisEngine } from './lib/analytics/prime-analysis';
import { SumAnalysisEngine } from './lib/analytics/sum-analysis';
import { StreakAnalysisEngine } from './lib/analytics/streak-analysis';
import { PrizeCorrelationEngine } from './lib/analytics/prize-correlation';
import { logger } from './lib/logger';
import { enqueueAuditEvent, startAuditWriter, stopAuditWriter, type AuditEventName } from './lib/audit';
import { startAuditRetentionScheduler } from './lib/audit-retention';
import { startLogRetentionScheduler } from './lib/log-retention';
import { stopLogWriter } from './lib/log-store';
import { buildApiSecurityHeaders } from './lib/security/csp';
import {
  isJsonContentType,
  isSecureRequest,
  RequestBodyTooLargeError,
  readJsonBodyWithLimit,
  resolveClientIp,
} from './lib/security/http';
import { MAX_TREND_NUMBERS_PARAM_LENGTH, parseTrendNumbers } from './lib/security/trends-input';
import { hashForAudit, isHmacEnabled, pseudonymizeIp } from './lib/security/pseudonymize';
import { isInternalApiRequest } from './lib/security/internal-api';
import {
  buildResponseCacheKey,
  ContestResponseCache,
  getLatestContestNumber,
} from './lib/api/response-cache';

function resolveAppVersion(): string {
  const envVersion = process.env['APP_VERSION'];
  if (envVersion && envVersion.trim().length > 0) {
    return envVersion.trim();
  }

  try {
    const pkgText = readFileSync(new URL('./package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(pkgText) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version.trim().length > 0) {
      return pkg.version.trim();
    }
  } catch (error) {
    logger.warn('system.app_version_read_failed', {
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return 'unknown';
}

const APP_VERSION = resolveAppVersion();

// Input validation schemas
const generateBetsSchema = z.object({
  budget: z.number().min(6).max(1000000),
  strategy: z.enum(['random', 'hot_numbers', 'cold_numbers', 'balanced', 'fibonacci', 'custom']).optional(),
  mode: z.enum(['simple_only', 'multiple_only', 'mixed', 'optimized']).optional(),
});

const trendsQuerySchema = z.object({
  numbers: z
    .string()
    .max(MAX_TREND_NUMBERS_PARAM_LENGTH, 'Lista de números muito longa')
    .regex(/^(\d+,)*\d+$/, 'Formato de números inválido'),
  period: z.enum(['yearly', 'quarterly', 'monthly']).optional(),
});

// CORS configuration
const isDevelopment = process.env['NODE_ENV'] === 'development';

const ALLOWED_ORIGINS = isDevelopment
  ? [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3201',
    ]
  : (process.env['ALLOWED_ORIGINS'] || 'https://megasena-analyzer.com.br')
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
const AUDIT_RETENTION_DAYS = Number(process.env['AUDIT_RETENTION_DAYS'] ?? '400');
const AUDIT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOG_RETENTION_DAYS = Number(process.env['LOG_RETENTION_DAYS'] ?? '30');
const LOG_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

const MIN_HEALTH_TOTAL_DRAWS = Number(process.env['HEALTH_MIN_TOTAL_DRAWS'] ?? '1');

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
let stopAuditRetentionScheduler: (() => void) | null = null;
let stopLogRetentionScheduler: (() => void) | null = null;

/**
 * Create a standardized error response
 */
function createErrorResponse(
  ctx: RequestContext,
  error: string,
  details?: unknown,
  status: number = 400
): Response {
  const includeDetails = process.env['NODE_ENV'] !== 'production';

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

  return pseudonymizeIp(clientIp);
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
    launchStage: process.env['NODE_ENV'] ?? 'development',
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

// Cleanup old rate limit entries every 5 minutes
// LRU cache already limits size, but we still clean up expired entries to free memory
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, entry] of rateLimiterCache.entries()) {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    rateLimiterCache.delete(key);
  }
  
  if (keysToDelete.length > 0) {
    logger.info('api.rate_limit_cache_cleanup', {
      removedCount: keysToDelete.length,
      cacheSize: rateLimiterCache.size,
    });
  }
}, 5 * 60 * 1000);

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

// Validate production secret BEFORE migrations to avoid mutating the database
// on a misconfigured deploy. fail-closed → no DB writes if IP_HASH_SECRET is
// missing in production.
{
  const isProduction = process.env['NODE_ENV'] === 'production';
  if (isProduction && !isHmacEnabled()) {
    if (process.env['IP_HASH_SECRET_AUTOGENERATE'] === 'true') {
      const ephemeral = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      process.env['IP_HASH_SECRET'] = ephemeral;
      logger.warn('security.ip_hash_secret_autogenerated', {
        reason: 'IP_HASH_SECRET ausente; gerado segredo efêmero porque IP_HASH_SECRET_AUTOGENERATE=true. NÃO usar para produção real — válido apenas para o ciclo de vida deste processo.',
      });
    } else {
      logger.error('security.ip_hash_secret_missing', new Error('IP_HASH_SECRET required in production'), {
        reason: 'IP_HASH_SECRET ausente ou com menos de 32 caracteres. A Política de Privacidade promete pseudonimização HMAC-SHA256, portanto a produção recusa iniciar com hashing mais fraco. Para iniciar localmente em modo produção sem segredo persistente, defina IP_HASH_SECRET_AUTOGENERATE=true.',
      });
      process.exit(1);
    }
  }
}

// Run migrations on startup
logger.info('db.initializing');
try {
  runMigrations();
  logger.info('db.ready');
  if (isHmacEnabled()) {
    logger.info('security.ip_hash_hmac_enabled');
  }
  startAuditWriter();
  logger.info('audit.writer_started');
  if (Number.isFinite(AUDIT_RETENTION_DAYS) && AUDIT_RETENTION_DAYS > 0) {
    stopAuditRetentionScheduler = startAuditRetentionScheduler(
      AUDIT_RETENTION_DAYS,
      AUDIT_RETENTION_INTERVAL_MS
    );
    logger.info('audit.retention_scheduler_started', {
      retentionDays: AUDIT_RETENTION_DAYS,
      intervalMs: AUDIT_RETENTION_INTERVAL_MS,
    });
  } else {
    logger.warn('audit.retention_scheduler_skipped', {
      reason: 'invalid_retention_days',
      retentionDays: AUDIT_RETENTION_DAYS,
    });
  }

  if (Number.isFinite(LOG_RETENTION_DAYS) && LOG_RETENTION_DAYS > 0) {
    stopLogRetentionScheduler = startLogRetentionScheduler(
      LOG_RETENTION_DAYS,
      LOG_RETENTION_INTERVAL_MS
    );
    logger.info('log.retention_scheduler_started', {
      retentionDays: LOG_RETENTION_DAYS,
      intervalMs: LOG_RETENTION_INTERVAL_MS,
    });
  } else {
    logger.warn('log.retention_scheduler_skipped', {
      reason: 'invalid_retention_days',
      retentionDays: LOG_RETENTION_DAYS,
    });
  }
} catch (error) {
  logger.error('db.initialization_failed', error);
  process.exit(1);
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
        uptime: process.uptime(),
        database: {
          connected: true,
          totalDraws: drawCount,
          minTotalDraws: MIN_HEALTH_TOTAL_DRAWS,
          lastContestNumber: statistics.lastContestNumber,
          lastDrawDate: statistics.lastDrawDate,
          dataReady,
        },
        version: APP_VERSION,
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
          error: process.env['NODE_ENV'] === 'production'
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

  '/api/dashboard': async (req, ctx) => {
    ctx.audit = { event: 'api.dashboard_read' };
    try {
      const url = new URL(req.url);
      const cacheKey = buildResponseCacheKey(ctx.route, url.searchParams);
      const lastContestNumber = getLatestContestNumber();
      const body = analyticsResponseCache.getOrCompute(cacheKey, lastContestNumber, () => {
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

      const cacheKey = buildResponseCacheKey(ctx.route, url.searchParams);
      const lastContestNumber = getLatestContestNumber();
      const body = analyticsResponseCache.getOrCompute(cacheKey, lastContestNumber, () => {
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
      const parseResult = trendsQuerySchema.safeParse({
        numbers: numbersParam,
        period: periodParam,
      });

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

      const { numbers: numbersStr, period = 'yearly' } = parseResult.data;
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

      const timeSeriesEngine = new TimeSeriesEngine();
      const data = timeSeriesEngine.getFrequencyTimeSeries(numbers, period);

      return new Response(JSON.stringify({ data, numbers, period }), {
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
  '/api/generate-bets': ['POST'],
};

const apiAuditEvents: Record<string, AuditEventName> = {
  '/api/health': 'api.health_read',
  '/api/dashboard': 'api.dashboard_read',
  '/api/statistics': 'api.statistics_read',
  '/api/trends': 'api.trends_read',
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

const PORT = Number(process.env['API_PORT']) || 3201;

serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const startTime = Date.now();
    const clientIp = resolveClientIp(req, server);
    const internalApiRequest = isInternalApiRequest(req, server.requestIP(req)?.address ?? null);
    const ctx = createRequestContext(
      req,
      url,
      getRateLimitKey(clientIp),
      isSecureRequest(req, url, server)
    );
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
        const rateLimit = internalApiRequest
          ? {
              allowed: true,
              remaining: RATE_LIMIT_MAX_REQUESTS,
              resetAt: Date.now() + RATE_LIMIT_WINDOW,
            }
          : checkRateLimit(clientIp);

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
          const auditEvent: Parameters<typeof enqueueAuditEvent>[0] = {
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

          enqueueAuditEvent(auditEvent);
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
          const auditEvent: Parameters<typeof enqueueAuditEvent>[0] = {
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

          enqueueAuditEvent(auditEvent);
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
        const auditEvent: Parameters<typeof enqueueAuditEvent>[0] = {
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

        enqueueAuditEvent(auditEvent);
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
  },
});

logger.info('api.server_started', {
  port: PORT,
  routes: Object.keys(apiHandlers).sort(),
});

// Graceful shutdown handlers
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('system.shutdown_forced', { signal });
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info('system.shutdown_started', { signal });
  
  try {
    if (stopAuditRetentionScheduler) {
      stopAuditRetentionScheduler();
      stopAuditRetentionScheduler = null;
      logger.info('audit.retention_scheduler_stopped');
    }
  } catch (error) {
    logger.error('audit.retention_scheduler_stop_failed', error, { signal });
  }

  try {
    if (stopLogRetentionScheduler) {
      stopLogRetentionScheduler();
      stopLogRetentionScheduler = null;
      logger.info('log.retention_scheduler_stopped');
    }
  } catch (error) {
    logger.error('log.retention_scheduler_stop_failed', error, { signal });
  }

  try {
    await stopAuditWriter();
    logger.info('audit.writer_stopped');
  } catch (error) {
    logger.error('audit.stop_failed', error, { signal });
  }

  try {
    await stopLogWriter();
    logger.info('log.writer_stopped');
  } catch (error) {
    logger.error('log.writer_stop_failed', error, { signal });
  }
  
  try {
    closeDatabase();
    logger.info('db.closed');
  } catch (error) {
    logger.error('db.close_failed', error, { signal });
  }

  logger.info('system.shutdown_complete', { signal });
  process.exit(0);
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('system.uncaught_exception', error);
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('system.unhandled_rejection', reason);
  void gracefulShutdown('unhandledRejection');
});
