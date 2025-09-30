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

      return new Response(JSON.stringify({ statistics, recentDraws }), {
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

  '/api/statistics': async () => {
    try {
      const stats = new StatisticsEngine();
      const frequencies = stats.getNumberFrequencies();
      const patterns = stats.detectPatterns();

      return new Response(JSON.stringify({ frequencies, patterns }), {
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
console.log('  - GET  /api/statistics');
console.log('  - POST /api/generate-bets\n');
