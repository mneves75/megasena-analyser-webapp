#!/usr/bin/env bun
/**
 * Custom Bun server for Next.js
 * This allows API routes to run in Bun's runtime with access to bun:sqlite
 */

import { serve } from 'bun';
import { runMigrations } from './lib/db';
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

// Run migrations on startup
console.log('Initializing database...');
runMigrations();
console.log('✓ Database ready\n');

// Define API route handlers
const apiHandlers: Record<string, (req: Request) => Promise<Response> | Response> = {
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
      console.error('Dashboard API error:', error);
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
      console.error('Statistics API error:', error);
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
      const period = (url.searchParams.get('period') || 'yearly') as 'yearly' | 'quarterly' | 'monthly';

      if (!numbersParam) {
        return new Response(JSON.stringify({ error: 'Numbers parameter required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const numbers = numbersParam.split(',').map(Number).filter(n => n >= 1 && n <= 60);

      if (numbers.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid numbers' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const timeSeriesEngine = new TimeSeriesEngine();
      const data = timeSeriesEngine.getFrequencyTimeSeries(numbers, period);

      return new Response(JSON.stringify({ data, numbers, period }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Trends API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch trends data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  '/api/generate-bets': async (req) => {
    try {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const body = (await req.json()) as {
        budget: number;
        strategy?: BetStrategy;
        mode?: BetGenerationMode;
      };
      const {
        budget,
        strategy = 'balanced',
        mode = BET_GENERATION_MODE.OPTIMIZED,
      } = body;

      const parsedBudget = Number(budget);
      if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid budget value' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const generator = new BetGenerator();
      const result = generator.generateOptimizedBets(parsedBudget, mode, strategy);

      return new Response(JSON.stringify({ success: true, data: result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Generate bets API error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate bets';
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

const PORT = Number(process.env.API_PORT) || 3201;

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Handle API routes
    const handler = apiHandlers[url.pathname];
    if (handler) {
      return handler(req);
    }

    // For all other routes, proxy to Next.js dev server (if running separately)
    // Or serve static files / SSR pages
    // For now, return 404 for non-API routes
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

console.log(`🚀 Bun server running on http://localhost:${PORT}`);
console.log('API routes available:');
console.log('  - GET  /api/dashboard');
console.log('  - GET  /api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true');
console.log('  - GET  /api/trends?numbers=1,5,10&period=yearly');
console.log('  - POST /api/generate-bets\n');
