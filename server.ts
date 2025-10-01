#!/usr/bin/env bun
/**
 * Custom Bun server for Next.js
 * This allows API routes to run in Bun's runtime with access to bun:sqlite
 */

import { serve } from 'bun';
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
          logger.warn('Rejected non-HTTPS origin in production', { origin });
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
function createErrorResponse(error: string, details?: unknown, status: number = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function getRateLimitKey(req: Request): string {
  // Try to get real IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  return forwardedFor?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
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
    logger.info(`Cleaned up ${keysToDelete.length} expired rate limit entries`);
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
    logger.warn('CORS request from unauthorized origin', { origin, allowedOrigins: ALLOWED_ORIGINS });
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
logger.info('Initializing database...');
runMigrations();
logger.info('✓ Database ready');

// Define API route handlers
const apiHandlers: Record<string, (req: Request) => Promise<Response> | Response> = {
  '/api/health': async () => {
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
        version: '1.0.0',
      };
      
      return new Response(JSON.stringify(health), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Health check failed', error);
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },

  '/api/dashboard': async () => {
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
      logger.apiError('GET', '/api/dashboard', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch dashboard data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  '/api/statistics': async (req) => {
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
      logger.apiError('GET', '/api/statistics', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch statistics data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  '/api/trends': async (req) => {
    try {
      const url = new URL(req.url);
      const numbersParam = url.searchParams.get('numbers');
      const periodParam = url.searchParams.get('period');

      if (!numbersParam) {
        return createErrorResponse('Numbers parameter required');
      }

      // Validate query parameters
      const parseResult = trendsQuerySchema.safeParse({
        numbers: numbersParam,
        period: periodParam,
      });

      if (!parseResult.success) {
        return createErrorResponse('Invalid query parameters', parseResult.error.format());
      }

      const { numbers: numbersStr, period = 'yearly' } = parseResult.data;
      const numbers = numbersStr.split(',').map(Number).filter(n => n >= 1 && n <= 60);

      if (numbers.length === 0) {
        return createErrorResponse('No valid numbers provided (must be between 1 and 60)');
      }

      const timeSeriesEngine = new TimeSeriesEngine();
      const data = timeSeriesEngine.getFrequencyTimeSeries(numbers, period);

      return new Response(JSON.stringify({ data, numbers, period }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.apiError('GET', '/api/trends', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch trends data';
      return createErrorResponse(message, null, 500);
    }
  },

  '/api/generate-bets': async (req) => {
    try {
      if (req.method !== 'POST') {
        return createErrorResponse('Method not allowed', null, 405);
      }

      // Check content length
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_REQUEST_BODY_SIZE) {
        return createErrorResponse('Request body too large', { maxSize: MAX_REQUEST_BODY_SIZE }, 413);
      }

      // Parse and validate request body
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return createErrorResponse('Invalid JSON in request body');
      }

      const parseResult = generateBetsSchema.safeParse(body);
      if (!parseResult.success) {
        return createErrorResponse('Invalid input', parseResult.error.format());
      }

      const {
        budget,
        strategy = 'balanced',
        mode = BET_GENERATION_MODE.OPTIMIZED,
      } = parseResult.data;

      const generator = new BetGenerator();
      const result = generator.generateOptimizedBets(budget, mode, strategy);

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.apiError('POST', '/api/generate-bets', error);
      const message = error instanceof Error ? error.message : 'Failed to generate bets';
      return createErrorResponse(message, null, 500);
    }
  },
};

const PORT = Number(process.env.API_PORT) || 3201;

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Apply rate limiting to API routes (except health check)
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/health') {
      const rateLimit = checkRateLimit(req);
      
      if (!rateLimit.allowed) {
        logger.warn('Rate limit exceeded', {
          ip: getRateLimitKey(req),
          path: url.pathname,
        });
        
        return new Response(
          JSON.stringify({
            error: 'Too Many Requests',
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
            },
          }
        );
      }
      
      // Add rate limit headers to successful responses
      const response = await (async () => {
        const handler = apiHandlers[url.pathname];
        if (handler) {
          return handler(req);
        }
        
        return new Response(JSON.stringify({ error: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      })();
      
      // Clone response to add headers (rate limit + CORS)
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
      headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      headers.set('X-RateLimit-Reset', rateLimit.resetAt.toString());

      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // Handle API routes without rate limiting (health check)
    const handler = apiHandlers[url.pathname];
    if (handler) {
      const response = await handler(req);

      // Add CORS headers
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // For all other routes, return 404 with CORS headers
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  },
});

logger.info(`🚀 Bun server running on http://localhost:${PORT}`);
logger.info('API routes available:');
logger.info('  - GET  /api/health');
logger.info('  - GET  /api/dashboard');
logger.info('  - GET  /api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true');
logger.info('  - GET  /api/trends?numbers=1,5,10&period=yearly');
logger.info('  - POST /api/generate-bets');

// Graceful shutdown handlers
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`${signal} received again, forcing shutdown...`);
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  // Close database connection
  try {
    closeDatabase();
    logger.info('✓ Database closed successfully');
  } catch (error) {
    logger.error('Error closing database', error);
  }
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});
