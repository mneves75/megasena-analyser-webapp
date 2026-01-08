# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega-Sena Analyzer** (v1.5.8) is a Next.js-based lottery analysis application focused on Brazil's Mega-Sena lottery. The system fetches historical draw data from the official CAIXA API, stores it in a local SQLite database, performs statistical analysis, and generates betting strategies based on various heuristics.

### Core Requirements

- Expert-level data analysis and statistics capabilities
- No speculation or "hallucination" - all claims must be verifiable
- Explicit acknowledgment that lottery prediction is statistically impossible
- Focus on historical analysis, pattern detection, and budget-constrained betting strategies
- Clean, minimal, Apple/Linear-level UI polish

## Project-Specific Rules

**CRITICAL - ALWAYS FOLLOW:**

- **Never use emojis!** No emojis in code, commit messages, or any output.
- **Think critically and push reasoning to 100% of capacity.** Walk me through your thought process step by step.
- **Sacrifice grammar for the sake of concision.** Be brief and direct.
- **List any unresolved questions at the end of your response, if any exist.**
- **ALWAYS work through lists / todo / plans items and not stop until all the work is done!**
- **WE NEVER WANT WORKAROUNDS**: Always full implementations that are long-term sustainable.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **Runtime:** Bun (>=1.1) **[REQUIRED - Not compatible with Node.js]**
- **Database:** SQLite (bun:sqlite - native, zero compilation)
- **Styling:** TailwindCSS v4 with semantic design tokens
- **UI Components:** shadcn/ui (heavily customized)
- **Animations:** Framer Motion for micro-interactions
- **Package Manager:** Bun (npm/yarn/pnpm not supported)
- **Testing:** Vitest (unit) + Playwright (E2E)

**CRITICAL:** This project uses Bun's native SQLite (`bun:sqlite`) and **will not work with Node.js**. All commands must use `bun`, not `node` or `npm`.

## Essential Commands

```bash
# Environment setup
bun install                     # Install dependencies
bun --version                   # Verify Bun runtime (>=1.1)

# Database
bun run db:migrate              # Apply SQLite migrations
bun scripts/pull-draws.ts       # Pull all historical draws
bun scripts/pull-draws.ts --incremental  # Pull only new draws
bun scripts/pull-draws.ts --start 2946   # Pull from specific contest
bun scripts/optimize-db.ts      # Optimize database (WAL checkpoint + VACUUM)
bun scripts/backup-database.ts  # Create database backup

# Development
bun run dev                     # Start dev server (localhost:3000)
bun run lint                    # Run ESLint with --max-warnings=0
bun run lint --fix              # Auto-fix linting issues
bun run format                  # Run Prettier

# Testing
bun run test                    # Run Vitest in watch mode
bun run test -- --run           # Run tests once (CI mode)
bunx vitest tests/lib/bet-generator.test.ts --run  # Run single test file
bunx vitest -t "pattern"        # Run tests matching pattern
bunx vitest --coverage          # Generate coverage report (>=80% required)

# Maintenance
bun run audit:prune             # Soft delete old audit logs
bun run log:prune               # Soft delete old structured log events

# Production
bun run build                   # Create production bundle + type check
```

## Key Entry Points

| Purpose | Path |
|---------|------|
| Dashboard | `app/dashboard/page.tsx` |
| Statistics | `app/dashboard/statistics/page.tsx` |
| Bet Generator | `app/dashboard/generator/page.tsx` |
| Analytics Engine | `lib/analytics/statistics.ts` |
| Bet Generation | `lib/analytics/bet-generator.ts` |
| CAIXA API Client | `lib/api/caixa-client.ts` |
| Database Layer | `lib/db.ts` |

## Data Flow Architecture

```
CAIXA API --> scripts/pull-draws.ts --> SQLite (db/mega-sena.db)
                                              |
                                              v
                                    lib/analytics/* (StatisticsEngine, BetGenerator)
                                              |
                                              v
                                    app/dashboard/* (Server Components)
                                              |
                                              v
                                    Client Components (interactivity only)
```

## Directory Structure

- **`app/`** - Next.js App Router routes
- **`components/`** - Reusable UI components (shadcn/ui + custom)
- **`lib/`** - Business logic and utilities
  - `lib/analytics/` - Statistical analysis modules
  - `lib/api/` - CAIXA API integration
  - `lib/constants.ts` - Centralized configuration
- **`db/`** - SQLite database and migrations
- **`scripts/`** - Bun CLI utilities
- **`tests/`** - Vitest unit tests mirroring source structure
- **`docs/`** - Product specifications and prompts

## React Server Components (RSC)

**Core principle:** Every component is a Server Component unless it needs interactivity.

Use `'use client'` **ONLY** when you need:
- Event handlers (`onClick`, `onChange`)
- React hooks (`useState`, `useEffect`)
- Browser APIs (`window`, `document`)

Use `'use server'` for Server Actions (database mutations, form submissions).

## Database Best Practices

**Transaction Batching (CRITICAL):**
```typescript
try {
  db.run('BEGIN TRANSACTION');
  for (const item of largeDataset) {
    // ... insert operations
  }
  db.run('COMMIT');
} catch (error) {
  try { db.run('ROLLBACK'); } catch { /* ignore */ }
  throw error;
}
```

- Always use prepared statements for safety
- Run `bun scripts/optimize-db.ts` after large data ingestions
- Keep 15-20% disk space free (WAL mode requirement)

## Testing Strategy

**Unit Tests (Vitest)**
- Location: `tests/` mirroring source structure (e.g., `tests/lib/analytics/`)
- Run with: `bun test` (watch mode), `bun test -- --run` (CI mode)
- Run single file: `bunx vitest tests/lib/bet-generator.test.ts --run`
- Coverage threshold: 80% (lines, functions, branches, statements)
- Generate coverage: `bunx vitest --coverage`

**In-Memory Database for Testing**
- `lib/db.ts` includes `InMemoryDatabase` class (lines 116-475) for fast, reliable tests
- Automatically activated in Vitest (checks `process.env.VITEST`)
- Implements SQL-normalization for key operations without file I/O
- Force real file DB: `VITEST_FORCE_FILE_DB=1 bun test`

**Coverage Exclusions** (see `vitest.config.ts`):
- `app/**` - Server Components tested via E2E
- `components/charts/**` - Recharts components
- `lib/analytics/*` - Advanced analytics modules (complexity-score, decade-analysis, delay-analysis, etc.)
- `lib/api/caixa-client.ts` - External API client

**E2E Tests (Playwright)**
- Run with: `bun test:e2e`

## Important Patterns

### In-Memory Database Pattern

For testing, `lib/db.ts` provides sophisticated `InMemoryDatabase` that mocks SQLite:

```typescript
// In tests, db is automatically replaced with InMemoryDatabase
import { getDatabase } from '@/lib/db';

const db = getDatabase();
// Works with both real SQLite and in-memory test DB
```

The in-memory DB normalizes SQL for key operations:
- `INSERT INTO draws` - parses and stores in internal `draws` array
- `SELECT ... FROM draws` - filters and transforms from arrays
- `INSERT INTO audit_logs` - stores in internal `auditLogs` array

### Dynamic Programming Bet Optimization

`BetGenerator.buildOptimizedBetSizes()` (lib/analytics/bet-generator.ts:157-268) uses DP to minimize budget waste:

```typescript
// Selects optimal combination of bet sizes (6-20 numbers) within budget
// Maximizes unique number coverage while minimizing bet count
const sizes = generator.buildOptimizedBetSizes(budget);
// Returns e.g., [7, 7, 7, 6, 6] for optimal R$100 budget utilization
```

### Audit Logs with Hard Deletes (Exception)

This repo uses a user-approved no-soft-delete exception. Retention removes rows permanently:

```sql
-- Hard delete old audit logs (retention policy)
DELETE FROM audit_logs WHERE timestamp < ?;
-- Read recent audit logs (no deleted_at filter)
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50;
```

Prune old logs: `bun run audit:prune` (audit) and `bun run log:prune` (structured logs), using configured retention policies.

## Code Style

- Strict TypeScript with explicit return types on exported functions
- Two-space indentation
- `PascalCase` for components, `camelCase` for utilities, `kebab-case` for files
- Use semantic design tokens only - never hardcode colors (`text-white`, `bg-black`)

## Development Guidelines

### Core Rules

1. **Bun by default** - 28x faster than npm, native TypeScript
2. **Never hard delete** - Always soft delete with `deleted_at` timestamp
3. **No `any` types** - Use `unknown` + type guards instead
4. **Server Components first** - In Next.js, `'use client'` only for interactivity
5. **React Compiler handles optimization** - Remove manual useMemo/useCallback
6. **Audit everything** - Structured logging mandatory
7. **John Carmack is reviewing your code** - Clarity > cleverness, correctness first

### TypeScript Standards

- Strict mode enabled (`strict: true`)
- Explicit return types on all exported functions
- No `any` - use `unknown` + type guards
- Use `satisfies` for type inference with validation

### Security

- Zod validation on all API inputs
- Parameterized SQL queries (never string concatenation)
- CSP with nonces for script security
- Rate limiting (100 req/min/IP)

## Commit Standards

- **Conventional Commits:** `feat: add jackpot probability panel`
- Single concern per commit
- Reference issue IDs: `Refs #123`
- CI must pass before merging

## Documentation

- `docs/learn/` - Educational content about lottery mathematics, statistics, and this codebase
- `docs/PRIVACY.md` - Privacy policy
- `docs/TERMS.md` - Terms of use

## Important Notes

### Statistical Integrity

- **Lottery prediction is impossible** - explicitly acknowledge this
- Focus on historical pattern analysis and frequency statistics
- All betting strategies are heuristic-based with no guaranteed outcomes

### Design System

- Always edit design system (`app/globals.css`, `tailwind.config.js`) before components
- Use semantic tokens: `bg-background`, `text-foreground`, `border-accent`
- Never use explicit color classes in JSX
