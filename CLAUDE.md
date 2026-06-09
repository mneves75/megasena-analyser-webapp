# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega-Sena Analyzer** (v1.7.16) is a Next.js-based lottery analysis application focused on Brazil's Mega-Sena lottery. The system fetches historical draw data from the official CAIXA API, stores it in a local SQLite database, performs statistical analysis, and generates betting strategies based on various heuristics.

The detailed statistics page must expose, in the UI, which contest/date the analysis is currently based on so users can verify data freshness without leaving the screen.

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

## Workflow Rules

**CRITICAL - ALWAYS FOLLOW:**

- **Verify after every change.** After every change, verify all changes with agent-browser (the `/browser` gstack skill) and fix any UI/UX issues. Do not stop until all changes have been verified.
- **Bug reports start with a failing test.** When there is a bug report, do NOT start by trying to fix it. First write a test that reproduces the exact bug, then have subagents try to fix the bug and prove it with a passing test. No test = no fix.
- **Close out with autoreview.** When all work is done, use the `autoreview` skill and fix everything it surfaces.

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript (strict mode)
- **Runtime:** Bun (>=1.3.14) **[REQUIRED - Not compatible with Node.js]**
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
bun --version                   # Verify Bun runtime (>=1.3.14)

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
bun x vitest tests/lib/bet-generator.test.ts --run  # Run single test file
bun x vitest -t "pattern"       # Run tests matching pattern
bun x vitest --coverage         # Coverage local; valide se o provider está emitindo dados reais

# Maintenance
bun run audit:prune             # Hard delete old audit logs
bun run log:prune               # Hard delete old structured log events
bun run security:secrets:history # Redacted Git history scan with branch/tag reachability; fails on findings

# Production
bun run build                   # Create production bundle + type check
bun run dist:standalone         # Sync dist/standalone from Next standalone output
bun run start                   # Start production stack locally after build
bun run deploy:verify          # Verify public production health/version after deploy
bun run security:csp:edge      # Verify edge/proxy did not replace app CSP
```

## Key Entry Points

| Purpose          | Path                                |
| ---------------- | ----------------------------------- |
| Dashboard        | `app/dashboard/page.tsx`            |
| Statistics       | `app/dashboard/statistics/page.tsx` |
| Bet Generator    | `app/dashboard/generator/page.tsx`  |
| Analytics Engine | `lib/analytics/statistics.ts`       |
| Bet Generation   | `lib/analytics/bet-generator.ts`    |
| CAIXA API Client | `lib/api/caixa-client.ts`           |
| Database Layer   | `lib/db.ts`                         |

## Data Flow Architecture

```
CAIXA API --> scripts/pull-draws.ts --> SQLite (db/mega-sena.db)
                                              |
                                              v
                                    lib/analytics/* (StatisticsEngine, BetGenerator)
                                              |
                                              v
                                     server.ts (/api/* em Bun)
                                              |
                                              v
                        app/dashboard/* + Server Actions via lib/api/api-fetch.ts
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
  try {
    db.run('ROLLBACK');
  } catch {
    /* ignore */
  }
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
- Run single file: `bun x vitest tests/lib/bet-generator.test.ts --run`
- Coverage threshold: 80% (lines, functions, branches, statements)
- Generate coverage: `bun x vitest --coverage`

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
2. **Hard delete only where the repo documents the no-soft-delete exception**
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
- CSP with per-request nonces and no production `unsafe-inline` in `script-src`
- Production `style-src` uses the CSP nonce path and must not contain `unsafe-inline`; only the narrower `style-src-attr 'unsafe-inline'` exception is allowed for chart/visualization style attributes with browser CSP proof.
- Public edge/proxy layers must not define `Content-Security-Policy`; run `bun run security:csp:edge` after Cloudflare/Traefik changes.
- With a read-only Cloudflare token, `bun run security:csp:edge` must distinguish inaccessible zones from accessible zones without CSP candidates; do not collapse both states into a generic empty result.
- With `CLOUDFLARE_ACCOUNT_ID`, the same verifier runs Cloudflare Request Trace and reports matched CSP steps without printing account IDs or tokens.
- Trace simulation inputs (`CLOUDFLARE_TRACE_HEADERS_JSON`, `CLOUDFLARE_TRACE_SKIP_RESPONSE`, `CLOUDFLARE_TRACE_SKIP_CHALLENGE`) must stay opt-in and public-safe.
- Public edge failures include a short SHA-256 fingerprint plus directive/risky-source summary for the shared CSP; use it to correlate dashboard/proxy rules without committing private rule IDs or server details.
- Public edge failures also include a probable owner (`shared_response_headers`, `cloudflare_client_side_security`, `origin_or_app`, or `inconclusive`) and public-safe remediation actions; `shared_response_headers` means check Cloudflare Response Header Transform Rules or reverse-proxy header middleware before Page Shield.
- `ORIGIN_BASE_URL` is an opt-in direct-origin comparison input for `bun run security:csp:edge`; never commit real origin hosts/IPs and never print the private URL in diagnostics.
- The static/SRI CSP alternative currently restores static cache but breaks App Router hydration because streaming uses inline scripts; keep the nonce path unless Next.js removes that runtime requirement.
- Bun `/api/*` responses must keep their own defensive headers: deny-by-default JSON CSP, `nosniff`, frame deny, no-referrer, `Cache-Control: no-store` (API JSON is dynamic and must never be CDN-cached), and HSTS only on secure production requests.
- CORS preflights should stay minimal and rate-limited with the rest of `/api/*`; do not re-add `Authorization` unless an authenticated API path actually requires it and tests cover the new surface.
- Structured log and audit metadata must pass through the shared recursive sanitizer before persistence/output.
- JSON-LD scripts must use the shared serializer and nonce-aware components
- Rate limiting (100 req/min/IP) em toda a superfície `/api/*`, incluindo `/api/health`
- Endpoints públicos devem rejeitar métodos não suportados com `405` e header `Allow`
- Endpoints JSON mutáveis devem rejeitar `Content-Type` ausente ou não JSON com `415`; não aceite `text/plain` para evitar requisições simples cross-site sem preflight.
- `X-Forwarded-*` só pode influenciar IP do cliente ou HTTPS/HSTS na API Bun quando `TRUST_PROXY_HEADERS=true`, o peer de socket for loopback ou estiver em `TRUSTED_PROXY_IPS`, e o proxy sobrescrever headers de IP vindos do cliente.
- Bypass de rate limit para chamadas server-side internas exige `INTERNAL_API_SECRET` forte e peer loopback; nunca confie apenas em headers enviados pelo cliente.
- `proxy.ts` do Next não deve emitir HSTS nem `upgrade-insecure-requests`: o standalone pode reconstruir `request.url` a partir de `X-Forwarded-Proto` antes do middleware, e o middleware não valida o peer de socket. HSTS no TLS terminado pelo proxy reverso deve ser aplicado no próprio proxy.
- Pseudonimização de IP via `lib/security/pseudonymize.ts` (HMAC-SHA256 com salt rotativo de 30 dias). Em `NODE_ENV=production`, `IP_HASH_SECRET` (≥ 32 caracteres) é obrigatório. A validação ocorre antes das migrations e o servidor faz `process.exit(1)` se o segredo estiver ausente. O único opt-in é `IP_HASH_SECRET_AUTOGENERATE=true`, restrito a Playwright/E2E; nunca habilitar em deploy real.
- LGPD: mudanças que afetem coleta, retenção, finalidade, base legal, operador ou direitos do titular exigem atualização sincronizada de `docs/PRIVACY.md`, `docs/LGPD-COMPLIANCE.md` (RoPA) e `lib/i18n.ts`. Banner de transparência (`components/storage-disclosure.tsx`) deve refletir todas as chaves gravadas em `localStorage`.
- Resposta a incidente segue `docs/INCIDENT-RESPONSE.md` (Art. 48 LGPD). Pós-mortem público em `docs/INCIDENT-RESPONSE-TEMPLATE.md` nunca contém valores de segredo ou dados pessoais.

## Commit Standards

- **Conventional Commits:** `feat: add jackpot probability panel`
- Single concern per commit
- Reference issue IDs: `Refs #123`
- CI must pass before merging

## Documentation

- `docs/learn/` - Educational content about lottery mathematics, statistics, and this codebase
- `docs/SECURITY.md` - CSP decision record and dependency override maintenance
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

## SEO Configuration

### HTML Lang Attribute

- Must be `lang="pt-BR"` (primary language is Brazilian Portuguese)
- Already configured in `app/layout.tsx`

### Schema.org Structured Data

Uses `MultiJsonLd` component with `@graph` structure:

- WebSite, Organization, WebApplication in a single `<script>` tag
- BreadcrumbList on all dashboard pages
- FAQPage on home, privacy, and terms pages

### Validation URLs

- https://search.google.com/test/rich-results?url=https://megasena-analyzer.com.br
- https://validator.schema.org/?url=https://megasena-analyzer.com.br

### SEO Constants

- `BASE_URL` centralized in `lib/constants.ts` -- all 12+ files import from there
- Never hardcode `megasena-analyzer.com.br` in page files

## Deployment

See `docs/DEPLOY.md` for full deployment workflow.

### URLs

- **Production:** https://megasena-analyzer.com.br
- **Aliases:** megasena-analyzer.com, megasena-analyzer.online (301 redirect to .com.br)
- **Container:** Docker with Next.js standalone output + Bun API server
- **Reverse proxy:** Traefik v3 (managed by Coolify)
- **CDN:** Cloudflare (SSL termination, DDoS protection)

### Key Points

- Deployment is **manual** (not auto-deploy from GitHub)
- Staging deploys require an explicit reachable staging target; do not infer staging from the production VPS alias or a local tarball/image.
- After deployment, `bun run deploy:verify` must pass against public `/api/health`; a stale version means the release is not actually deployed.
- After Cloudflare/Traefik header changes, `bun run security:csp:edge` must pass; a failure means the public edge is overriding the app CSP contract.
- Dockerfile is **runtime-only** -- build Next.js locally, rode `bun run dist:standalone` e então envie `dist/standalone/`
- `bun run build` must fail if `.next/standalone` contains SQLite DB/WAL/SHM/backup artifacts; do not publish raw standalone output with local database state.
- Runtime supervision sends `SIGTERM`, waits for child exit, and escalates to `SIGKILL` after the grace period; do not replace this with a `proc.killed` check, because in Bun that only means a signal was sent.
- Container name: `megasena-analyzer`
- Keep deployment secrets and server-specific access details outside the repository.
