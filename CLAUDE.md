# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega-Sena Analyzer** is a Next.js-based lottery analysis application focused on Brazil's Mega-Sena lottery. The system fetches historical draw data from the official CAIXA API, stores it in a local SQLite database, performs statistical analysis, and generates betting strategies based on various heuristics.

### Core Requirements

- Expert-level data analysis and statistics capabilities
- No speculation or "hallucination" - all claims must be verifiable
- Explicit acknowledgment that lottery prediction is statistically impossible
- Focus on historical analysis, pattern detection, and budget-constrained betting strategies
- Clean, minimal, Apple/Linear-level UI polish

## Project-Specific Rules

**CRITICAL - ALWAYS FOLLOW:**

- **Never create markdown files after you are done. NEVER!** Use `agent_planning/` for planning docs only, archive when done in `agent_planning/archive/`.
- **Never use emojis!** No emojis in code, commit messages, or any output.
- **Think critically and push reasoning to 100% of capacity.** Walk me through your thought process step by step.
- **Use `ast-grep` for syntax-aware searches.** Default to `ast-grep --lang <language> -p '<pattern>'` for structural matching.
- **Sacrifice grammar for the sake of concision.** Be brief and direct.
- **List any unresolved questions at the end of your response, if any exist.**
- **ALWAYS work through lists / todo / plans items and not stop until all the work is done!**
- **WE NEVER WANT WORKAROUNDS**: Always full implementations that are long-term sustainable.

**For detailed reasoning protocol:** See `docs/PROMPTS/REASONING_PROTOCOL.md`

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

# Production
bun run build                   # Create production bundle + type check
./deploy.sh                     # Full build + deploy to VPS
./deploy.sh --skip-build        # Deploy only (reuse existing build)
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

**For detailed RSC patterns:** See `docs/PROMPTS/RSC_GUIDELINES.md`

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

## Code Style

- Strict TypeScript with explicit return types on exported functions
- Two-space indentation
- `PascalCase` for components, `camelCase` for utilities, `kebab-case` for files
- Use semantic design tokens only - never hardcode colors (`text-white`, `bg-black`)

## Development Guidelines

**IMPORTANT**: Consult these guidelines in `docs/GUIDELINES-REF/` before coding:

### Quick Reference (READ FIRST)
- **`PRAGMATIC-RULES.md`** - Daily coding decisions. READ BEFORE every task
- **`PETER-ORACLE-GUIDELINES.md`** - Use Oracle when stuck/debugging: `npx -y @steipete/oracle --help`

### Core Standards
- **`DEV-GUIDELINES.md`** - Development standards, TypeScript patterns, testing
- **`DB-GUIDELINES.md`** - Database best practices, soft deletes, queries
- **`SQLITE-GUIDELINES.md`** - SQLite/D1 patterns, WAL mode, optimization
- **`LOG-GUIDELINES.md`** - Structured logging, privacy-first approach
- **`AUDIT-GUIDELINES.md`** - Audit trail requirements, GDPR compliance
- **`SECURITY-GUIDELINES.md`** - Zero Trust, AI safety, incident response
- **`OWASP-GUIDELINES.md`** - OWASP Top 10, API Security, LLM risks

### Platform-Specific
- **`WEB-NEXTJS-GUIDELINES.md`** - Next.js 15/16, React 19, Server Components, PPR
- **`BUN-GUIDELINES.md`** - Bun runtime + package manager, native SQLite
- **`TYPESCRIPT-GUIDELINES.md`** - TypeScript 5.6+ config, patterns, linting
- **`REACT-GUIDELINES.md`** - React 19+, Compiler, hooks patterns

### Design
- **`DESIGN-UI-UX-GUIDELINES.md`** - Design tokens, typography, accessibility

## Commit Standards

- **Conventional Commits:** `feat: add jackpot probability panel`
- Single concern per commit
- Reference issue IDs: `Refs #123`
- CI must pass before merging

## Production Deployment

**Target:** Hostinger VPS with Coolify/Traefik
**Domains:** megasena-analyzer.com.br, .com, .online

```bash
./deploy.sh                    # Full build + deploy
./deploy.sh --skip-build       # Reuse existing build
```

**Verification (on VPS):**
```bash
docker ps --filter name=megasena-analyzer
docker logs megasena-analyzer --tail 30
curl -s http://localhost:3201/api/health
```

## Documentation References

- `docs/PROMPTS/PROMPT_UI.md` - UI/UX requirements
- `docs/PROMPTS/PROMPT-MAIN.md` - Core domain logic
- `docs/PROMPTS/SYSTEM_PROMPT.md` - System architecture
- `docs/PROMPTS/RSC_GUIDELINES.md` - React Server Components guide
- `docs/PROMPTS/REASONING_PROTOCOL.md` - AI reasoning protocol
- `docs/DEPLOY_VPS/DEPLOY_DOCKER.md` - Docker deployment details

## Important Notes

### Statistical Integrity

- **Lottery prediction is impossible** - explicitly acknowledge this
- Focus on historical pattern analysis and frequency statistics
- All betting strategies are heuristic-based with no guaranteed outcomes

### Design System

- Always edit design system (`app/globals.css`, `tailwind.config.ts`) before components
- Use semantic tokens: `bg-background`, `text-foreground`, `border-accent`
- Never use explicit color classes in JSX
