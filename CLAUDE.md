# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for analyzing Mega Sena lottery data, built with React 19, TypeScript, and TailwindCSS. The project uses the App Router architecture with Turbopack for improved performance. It includes Prisma for SQLite database operations, sync services for official CAIXA data, statistical analysis APIs, and a betting engine with pricing calculations.

## Development Commands

- `npm run dev` - Start development server with Turbopack hot reload
- `npm run build` - Build production bundle with Turbopack (run before every push/PR)
- `npm run start` - Serve production build for testing
- `npm run lint` - Run ESLint with Next.js config (treat warnings as blockers)
- `npm run typecheck` - Run TypeScript compiler without emitting files
- `npm run format` - Format code with Prettier
- `npm run prepare` - Set up Git hooks with Husky
- `npm test` - Run unit tests with Vitest
- `npm run test:watch` - Run tests in watch mode

## Database Commands

- `npm run db:migrate` - Apply Prisma migrations locally
- `npm run db:deploy` - Apply migrations in production
- `npm run db:generate` - Generate Prisma client
- `npm run db:seed` - Populate metadata and pricing tables
- `npm run db:reset` - Reset SQLite database (destroys local data)
- `npm run sync` - Sync Mega-Sena data via CLI (supports `--full` and `--limit=N`)
- `npm run limits` - Inspect/modify betting engine limits (`--show`, `--set=key=value`, `--reset`, `--history`)

## Project Architecture

### Directory Structure

- `src/app/` - Next.js App Router pages and layouts
  - `api/stats/` - Statistics API endpoints with windowing support
  - `api/sync/` - Protected sync endpoint for CAIXA data
- `src/components/` - Reusable UI components (layout, ui)
- `src/data/` - Database access layer (marked `server-only`)
  - `caixa-client.ts` - Official CAIXA API integration
  - `draws.ts` - Database queries for draw data
- `src/services/` - Business logic layer
  - `sync.ts` - Mega-Sena synchronization service
  - `stats.ts` - Statistical analysis with caching
  - `pricing.ts` - Official betting price calculations
- `src/lib/` - Shared utilities (logger, Prisma client, utils)
- `prisma/` - Database schema and migrations
- `public/` - Static assets and mock data files
- `docs/` - Documentation and planning updates

### Key Configuration

- Uses TypeScript with strict mode enabled
- Path alias `@/*` maps to `./src/*`
- ESLint extends Next.js core-web-vitals and TypeScript configs
- Husky + lint-staged for pre-commit hooks
- TailwindCSS v4 for styling
- Vitest for unit testing with path aliases
- SQLite database via Prisma ORM

## Coding Standards

### React Server Components Guidelines

- Default to React Server Components for all components
- Only add `"use client"` when using browser APIs, state, events, or effects
- Use `"use server"` for Server Actions in dedicated files
- Keep props serializable between server and client boundaries
- Place database access and heavy computations in server-only modules
- Avoid `useEffect` unless integrating with external systems

### TypeScript & File Organization

- Use TypeScript strict mode throughout
- Mark database modules with `"server-only"` import
- Use `kebab-case` for files and directories (e.g., `draw-frequency-table.tsx`)
- Place tests as `*.test.ts(x)` beside code or under `src/__tests__/`
- 2-space indentation consistently

### Styling

- Global styles in `src/app/globals.css`
- Favor Tailwind utilities over custom CSS
- Extend Tailwind config instead of adding global CSS
- Use format-on-save and let ESLint handle spacing/imports

## Testing

Project uses Vitest for unit testing:

- Run `npm test` for single test run or `npm run test:watch` for watch mode
- Tests are in `src/**/*.test.ts` (e.g., `src/services/__tests__/`)
- Test configuration includes path aliases and server-only stubs
- Focus on testing deterministic logic (pricing calculations, stats aggregations)
- Use `npm run test -- pricing` to run specific test suites
- Database layer and sync services have comprehensive test coverage

## Git & Commit Guidelines

- Use concise, imperative commit subjects (e.g., "Add draw frequency table")
- Reference issue IDs when applicable
- PRs must include: lint/build status, change summary, UI screenshots for visual updates

## Database & Environment Setup

### Database (SQLite + Prisma)

- Uses SQLite via Prisma ORM (default file: `./dev.db`)
- After cloning: run `npm run db:migrate` then `npm run db:seed`
- Seeds populate metadata and official pricing table
- Database access layer in `src/data/**` marked `server-only`

### Key Environment Variables

- `DATABASE_URL="file:./dev.db"` - SQLite database path
- `SYNC_TOKEN` - Bearer token for protected `/api/sync` endpoint
- `CAIXA_API_URL` - Override official Mega-Sena API endpoint
- `CAIXA_MAX_RETRIES` and `CAIXA_RETRY_DELAY_MS` - Retry policy configuration
- `LOG_LEVEL` - Pino logging level (`info`, `debug`, etc.)
- `LOG_PRETTY=1` - Enable formatted logs for CLI scripts (not during `next dev`)
- `SYNC_BACKFILL_WINDOW` - Default contest limit when DB is empty (default 50)
- `MEGASENA_BASE_PRICE_CENTS` - Fallback pricing when DB unavailable (default 600)
- `MEGASENA_PRICE_FALLBACK_UPDATED_AT` - ISO date for fallback pricing info
- Store secrets in `.env.local` (never commit)
- **Important**: Each variable must be on separate line to avoid Prisma issues

## API Endpoints

### Statistics API

- `GET /api/stats/frequencies?window=50` - Number frequency analysis
- `GET /api/stats/pairs?window=100&limit=20` - Pair combinations
- `GET /api/stats/triplets?limit=10` - Triplet analysis
- `GET /api/stats/runs` - Consecutive number patterns
- `GET /api/stats/sums?window=200` - Sum distribution
- `GET /api/stats/quadrants?window=30` - Quadrant analysis
- `GET /api/stats/recency` - Recent draw patterns
- All endpoints support optional `window` and `limit` parameters
- Cache automatically cleared after sync operations

### Sync API

- `POST /api/sync` - Protected endpoint requiring `SYNC_TOKEN`
- Also available via CLI: `npm run sync`
- Supports `--full` for backfill and `--limit=N` for window control

## Betting Engine & Pricing System

### Official Pricing

- Base price: R$ 6.00 (6 numbers, updated July 12, 2025)
- Combinatorial pricing: `C(k, 6) * base_price` for k > 6
- Price helpers in `src/services/pricing.ts`
- Run `npm run test -- pricing` to validate calculations

### Betting Engine (Stage 3)

- Strategies in `src/services/strategies/` (`uniform`, `balanced`) with deterministic PRNG
- Core workflow: `generateBatch` in `src/services/bets.ts` handles budget allocation
- Payloads follow `docs/data-contracts/strategy_payload.schema.json` (v1.0)
- Run `npm run test -- bets` for betting engine tests
- API endpoints: `POST /api/bets/generate` (protected), `GET /api/bets` (public listing)
- Reference fixture: `docs/fixtures/sample-bets.json` with seed `FIXTURE-SEED`

## Pre-commit Hooks

Lint-staged runs on commit:

- TypeScript/JavaScript files: ESLint + Prettier
- Other files (JSON, MD, CSS): Prettier formatting

## Troubleshooting

### Common Issues

- **Dev server error (`_buildManifest.js.tmp`)**: Kill processes on port 3000, delete `.next`, restart server
- **Betting generator unresponsive**: Ensure dev server runs without Turbopack, verify DB seeded and synced
- **Prisma deprecation warning**: Migration to `prisma.config.ts` planned (see `docs/DEV_SERVER_RECOVERY_PLAN.md`)

### Language & Documentation

- All UI, documentation, and user experience in Brazilian Portuguese
- This is a Mega-Sena lottery analysis application with statistical focus
- No lottery predictions - focus on statistical analysis and responsible budgeting
