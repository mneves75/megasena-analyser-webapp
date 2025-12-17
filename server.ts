#!/usr/bin/env bun
/**
 * Custom Bun server for Next.js
 * This allows API routes to run in Bun's runtime with access to bun:sqlite
 */

import { serve } from 'bun';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { runMigrations, closeDatabase } from './lib/db';
import { StatisticsEngine } from './lib/analytics/statistics';
import { BetGenerator, type BetStrategy } from './lib/analytics/bet-generator';
import { BET_GENERATION_MODE, type BetGenerationMode } from './lib/constants';
import { DelayAnalysisEngine } from './lib/analytics/delay-analysis';
import { DecadeAnalysisEngine } from './lib/analytics/decade-analysis';
import { TimeSeriesEngine } from './lib/analytics/time-series';
import { PairAnalysisEngine } from './lib/analytics/pair-analysis';
import { ParityAnalysisEngine } from './lib/analytics/parity-analysis';
import { PrimeAnalysisEngine } from './lib/analytics/prime-analysis';
import { SumAnalysisEngine } from './lib/analytics/sum-analysis';
import { StreakAnalysisEngine } from './lib/analytics/streak-analysis';
import { PrizeCorrelationEngine } from './lib/analytics/prize-correlation';
import { ComplexityScoreEngine } from './lib/analytics/complexity-score';
import { logger } from './lib/logger';
import { enqueueAuditEvent, startAuditWriter, stopAuditWriter, type AuditEventName } from './lib/audit';

function resolveAppVersion(): string {
  const envVersion = process.env.APP_VERSION;
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
  numbers: z.string().regex(/^(\d+,)*\d+$/, 'Invalid numbers format'),
  period: z.enum(['yearly', 'quarterly', 'monthly']).optional(),
});

// CORS configuration
const isDevelopment = process.env.NODE_ENV === 'development';

const ALLOWED_ORIGINS = isDevelopment
  ? [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:3201',
    ]
  : (process.env.ALLOWED_ORIGINS || 'https://conhecendotudo.online')
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
  launchStage: string;
  audit?: {
    event: AuditEventName;
    metadata?: Record<string, unknown>;
  };
}

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

/**
 * Create a standardized error response
 */
function createErrorResponse(
  ctx: RequestContext,
  error: string,
  details?: unknown,
  status: number = 400
): Response {
  const includeDetails = process.env.NODE_ENV !== 'production';

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

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256ForAudit(value: string, maxLength: number = 500): string {
  const truncated = value.length > maxLength ? value.slice(0, maxLength) : value;
  return `sha256:${sha256Hex(truncated)}`;
}

function getClientIp(req: Request): string | null {
  // Try to get real IP from various headers (do not log/store raw value)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');

  const ip = forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || cfConnectingIp?.trim();
  return ip && ip.length > 0 ? ip : null;
}

function getRateLimitKey(req: Request): string {
  const ip = getClientIp(req);
  if (!ip) {
    return 'unknown';
  }

  // Privacy: store only a stable hash in memory/logs (no raw IP).
  return `sha256:${sha256Hex(ip)}`;
}

function createRequestContext(req: Request, url: URL): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    route: url.pathname,
    method: req.method,
    userAgent: req.headers.get('user-agent') ?? undefined,
    clientId: getRateLimitKey(req),
    origin: req.headers.get('origin'),
    launchStage: process.env.NODE_ENV ?? 'development',
  };
}

function withRequestIdHeader(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Request-Id', requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function checkRateLimit(req: Request): { allowed: boolean; remaining: number; resetAt: number } {
  const key = getRateLimitKey(req);
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

// Run migrations on startup
logger.info('db.initializing');
try {
  runMigrations();
  logger.info('db.ready');
  startAuditWriter();
  logger.info('audit.writer_started');
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
    try {
      // Check database connectivity
      const stats = new StatisticsEngine();
      const drawCount = stats.getDrawStatistics().totalDraws;
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          connected: true,
          totalDraws: drawCount,
        },
        version: APP_VERSION,
      };
      
      return new Response(JSON.stringify(health), {
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
          error: error instanceof Error ? error.message : 'Unknown error',
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
      const stats = new StatisticsEngine();
      const statistics = stats.getDrawStatistics();
      const recentDraws = stats.getDrawHistory(5);

      // Add hot streaks (trending numbers)
      const streakEngine = new StreakAnalysisEngine(10);
      const hotNumbers = streakEngine.getHotNumbers(10);

      return new Response(JSON.stringify({ statistics, recentDraws, hotNumbers }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('api.dashboard_failed', error, {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
      });
      return createErrorResponse(ctx, 'Failed to fetch dashboard data', null, 500);
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

      const stats = new StatisticsEngine();
      const frequencies = stats.getNumberFrequencies();
      const patterns = stats.detectPatterns();

      const response: Record<string, unknown> = { frequencies, patterns };

      if (includeDelays) {
        const delayEngine = new DelayAnalysisEngine();
        response.delays = delayEngine.getNumberDelays();
        response.delayDistribution = delayEngine.getDelayDistribution();
      }

      if (includeDecades) {
        const decadeEngine = new DecadeAnalysisEngine();
        response.decades = decadeEngine.getDecadeDistribution();
      }

      if (includePairs) {
        const pairEngine = new PairAnalysisEngine();
        response.pairs = pairEngine.getNumberPairs(5); // Min 5 occurrences
      }

      if (includeParity) {
        const parityEngine = new ParityAnalysisEngine();
        response.parity = parityEngine.getParityDistribution();
        response.parityStats = parityEngine.getParityStats();
      }

      if (includePrimes) {
        const primeEngine = new PrimeAnalysisEngine();
        response.primes = primeEngine.getPrimeDistribution();
      }

      if (includeSum) {
        const sumEngine = new SumAnalysisEngine();
        response.sumStats = sumEngine.getSumDistribution();
      }

      if (includeStreaks) {
        const streakEngine = new StreakAnalysisEngine(10);
        response.hotNumbers = streakEngine.getHotNumbers(15);
        response.coldNumbers = streakEngine.getColdNumbers(15);
      }

      if (includePrizeCorr) {
        const prizeEngine = new PrizeCorrelationEngine();
        response.luckyNumbers = prizeEngine.getLuckyNumbers(15);
        response.unluckyNumbers = prizeEngine.getUnluckyNumbers(15);
      }

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('api.statistics_failed', error, {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
      });
      return createErrorResponse(ctx, 'Failed to fetch statistics data', null, 500);
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
        return createErrorResponse(ctx, 'Numbers parameter required');
      }

      ctx.audit = {
        event: 'api.trends_read',
        metadata: {
          period: periodParam ?? 'yearly',
          numbersHash: sha256ForAudit(numbersParam),
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
            numbersHash: sha256ForAudit(numbersParam),
            validationError: true,
          },
        };
        return createErrorResponse(ctx, 'Invalid query parameters', parseResult.error.format());
      }

      const { numbers: numbersStr, period = 'yearly' } = parseResult.data;
      const numbers = numbersStr.split(',').map(Number).filter(n => n >= 1 && n <= 60);

      if (numbers.length === 0) {
        ctx.audit = {
          event: 'api.trends_read',
          metadata: {
            period,
            numbersHash: sha256ForAudit(numbersStr),
            numbersCount: 0,
            validationError: true,
            reason: 'numbers_out_of_range',
          },
        };
        return createErrorResponse(ctx, 'No valid numbers provided (must be between 1 and 60)');
      }

      ctx.audit = {
        event: 'api.trends_read',
        metadata: {
          period,
          numbersHash: sha256ForAudit(numbersStr),
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
      return createErrorResponse(ctx, 'Failed to fetch trends data', null, 500);
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
        return createErrorResponse(ctx, 'Method not allowed', null, 405);
      }

      // Check content length
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_REQUEST_BODY_SIZE) {
        return createErrorResponse(ctx, 'Request body too large', { maxSize: MAX_REQUEST_BODY_SIZE }, 413);
      }

      // Parse and validate request body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        ctx.audit = {
          event: 'bets.generate_requested',
          metadata: { validationError: true, reason: 'invalid_json' },
        };
        return createErrorResponse(ctx, 'Invalid JSON in request body');
      }

      const parseResult = generateBetsSchema.safeParse(body);
      if (!parseResult.success) {
        ctx.audit = {
          event: 'bets.generate_requested',
          metadata: { validationError: true, reason: 'invalid_input' },
        };
        return createErrorResponse(ctx, 'Invalid input', parseResult.error.format());
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

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('bets.generate_failed', error, {
        requestId: ctx.requestId,
        route: ctx.route,
        method: ctx.method,
      });
      return createErrorResponse(ctx, 'Failed to generate bets', null, 500);
    }
  },
};

const PORT = Number(process.env.API_PORT) || 3201;

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const startTime = Date.now();
    const ctx = createRequestContext(req, url);
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
      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        const response = new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
        const finalized = withRequestIdHeader(response, ctx.requestId);
        logger.info('api.request_completed', {
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
          statusCode: finalized.status,
          durationMs: Date.now() - startTime,
        });
        return finalized;
      }

      // Apply rate limiting to API routes (except health check)
      if (url.pathname.startsWith('/api/') && url.pathname !== '/api/health') {
        const rateLimit = checkRateLimit(req);

        if (!rateLimit.allowed) {
          logger.warn('api.rate_limit_exceeded', {
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            clientId: ctx.clientId,
          });

          const response = new Response(
            JSON.stringify({
              error: 'Too Many Requests',
              requestId: ctx.requestId,
              message: `Rate limit exceeded. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} seconds.`,
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

          const finalized = withRequestIdHeader(response, ctx.requestId);
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
            return handler(req, ctx);
          }

          return createErrorResponse(ctx, 'Not Found', null, 404);
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
          ctx.requestId
        );

        if (ctx.audit) {
          enqueueAuditEvent({
            event: ctx.audit.event,
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            success: finalized.status < 400,
            durationMs: Date.now() - startTime,
            clientIdHash: ctx.clientId,
            userAgent: ctx.userAgent,
            metadata: ctx.audit.metadata,
          });
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

      // Handle API routes without rate limiting (health check)
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
          ctx.requestId
        );

        if (ctx.audit) {
          enqueueAuditEvent({
            event: ctx.audit.event,
            requestId: ctx.requestId,
            route: ctx.route,
            method: ctx.method,
            statusCode: finalized.status,
            success: finalized.status < 400,
            durationMs: Date.now() - startTime,
            clientIdHash: ctx.clientId,
            userAgent: ctx.userAgent,
            metadata: ctx.audit.metadata,
          });
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

      const notFound = createErrorResponse(ctx, 'Not Found', null, 404);
      const finalized = withRequestIdHeader(
        new Response(notFound.body, {
          status: notFound.status,
          statusText: notFound.statusText,
          headers: {
            ...Object.fromEntries(notFound.headers.entries()),
            ...corsHeaders,
          },
        }),
        ctx.requestId
      );

      if (ctx.audit) {
        enqueueAuditEvent({
          event: ctx.audit.event,
          requestId: ctx.requestId,
          route: ctx.route,
          method: ctx.method,
          statusCode: finalized.status,
          success: finalized.status < 400,
          durationMs: Date.now() - startTime,
          clientIdHash: ctx.clientId,
          userAgent: ctx.userAgent,
          metadata: ctx.audit.metadata,
        });
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

      const response = createErrorResponse(ctx, 'Internal Server Error', null, 500);
      return withRequestIdHeader(response, ctx.requestId);
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
    await stopAuditWriter();
    logger.info('audit.writer_stopped');
  } catch (error) {
    logger.error('audit.stop_failed', error, { signal });
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
