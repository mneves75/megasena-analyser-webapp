# ExecPlan: Align with docs/GUIDELINES-REF (2025-12-17)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/GUIDELINES-REF/EXECPLANS-GUIDELINES.md`.

## Purpose / Big Picture

Ship a repo state that is aligned with the canonical best practices in `docs/GUIDELINES-REF/` for 2025/2026-era Next.js + Bun stacks:

- No emoji characters in code outputs or UI (repo rule).
- Predictable production configuration (no implicit `localhost` assumptions).
- Structured logging with request context and privacy rules.
- A minimal, append-only audit trail for significant API/user actions.
- Verifiable baseline: `bun run lint`, `bun run test -- --run`, and `bun run build` pass.

The user-visible proof of success:

- App loads in dev and prod build.
- API server returns correct JSON for `/api/health`, `/api/dashboard`, `/api/statistics`, `/api/trends`, `/api/generate-bets`.
- Logs are structured and do not leak PII/secrets.
- No emoji glyphs are emitted to terminal logs or UI.

## Non-Goals

- Do not change the core analytics/business logic unless a bug is proven and covered by tests.
- Do not add “prediction” claims or speculative language; keep content grounded to historical analysis only.
- Do not introduce a new observability vendor (keep local-first logging/audit, extensible later).

## Guidelines Consulted (canonical references)

These documents are the source of truth for this plan:

- `docs/GUIDELINES-REF/EXECPLANS-GUIDELINES.md` (ExecPlan format, living sections, validation requirements)
- `docs/GUIDELINES-REF/SECURITY-GUIDELINES.md` (Zero Trust, privacy-first logging, security acceptance + rollback expectations)
- `docs/GUIDELINES-REF/LOG-GUIDELINES.md` (structured logging, request context propagation, redaction rules)
- `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md` (append-only audit trails, privacy, retention)
- `docs/GUIDELINES-REF/WEB-NEXTJS-GUIDELINES.md` (Next.js 16 best practices including `proxy.ts`)
- `docs/GUIDELINES-REF/BUN-GUIDELINES.md` (Bun runtime expectations, testing + type-checking, runtime patterns)
- `docs/GUIDELINES-REF/SQLITE-GUIDELINES.md` and `docs/GUIDELINES-REF/DB-GUIDELINES.md` (WAL/transactions, constraints, safe migrations)

Repo-local constraints to enforce:

- Root `AGENTS.md` and `CLAUDE.md` (no emojis; Bun required; no workarounds; log/audit required).

## Progress

- [x] (2025-12-17) Read `docs/GUIDELINES-REF/*` required for audit + execplan.
- [x] (2025-12-17) Baseline commands pass locally:
  - `bun run lint` (exit 0)
  - `bun run test -- --run` (83 passed, 12 skipped)
  - `bun run build` (Next.js 16.0.7 build succeeds)
- [ ] Phase 0: Convert findings into a prioritized backlog (P0/P1/P2) with acceptance criteria.
- [ ] Phase 1: Remove emoji usage from runtime output and UI.
- [ ] Phase 2: Implement structured logging with request context propagation.
- [ ] Phase 3: Implement minimal audit trail storage + emission for significant events.
- [ ] Phase 4: Fix configuration correctness (base URLs, origin allowlist, environment variables).
- [ ] Phase 5: Add/extend tests to cover changes and update docs for new operational behavior.

## Surprises & Discoveries

- Next build root inference can be wrong due to an unrelated lockfile outside the repo.
  Evidence (from `bun run build`):
    - Next.js selected `/Users/mneves/package-lock.json` as workspace root and warned about multiple lockfiles.
  Impact:
    - Build behavior can become environment-dependent unless `turbopack.root` is pinned in `next.config.js`.

- Several runtime scripts and server logs emit emoji characters, which violates the repo rule "never use emojis".
  Evidence:
    - `server.ts` logs contain non-ASCII status glyphs and emoji-like symbols.
    - Docker startup scripts contain emoji in logger messages.

- There is no explicit audit trail implementation in code (no `audit_*` tables or audit writer).
  Evidence:
    - No matches for `audit` in `lib/`, `app/`, `server.ts`, `scripts/`.

## Decision Log

- Decision: Keep the dual-server architecture (Next.js app + Bun API server).
  Rationale: `server.ts` depends on `bun:sqlite` and already implements validation, rate limiting, and CORS; rewriting to Next Route Handlers risks runtime/caching regressions and is out of scope.
  Date/Author: 2025-12-17 / agent

- Decision: Treat `docs/GUIDELINES-REF/WEB-NEXTJS-GUIDELINES.md` “pnpm mandatory” as a general default, overridden by this repo’s Bun constraint.
  Rationale: `package.json` and repo docs require Bun; forcing pnpm would break `bun:sqlite` runtime assumptions and dev scripts.
  Date/Author: 2025-12-17 / agent

## Outcomes & Retrospective

- Status: Not implemented yet. This ExecPlan is the actionable spec for the next implementation pass.

## Context and Orientation (current state)

This repository is a Next.js 16 App Router application that renders UI pages and calls into a separate Bun API server for analytics and database-backed operations.

Key files:

- `server.ts`: Bun HTTP server exposing `/api/*` endpoints. Uses `zod` validation, CORS allowlist, and rate limiting.
- `proxy.ts`: Next.js Proxy (replacement for middleware in Next.js 16) that sets CSP + security headers and injects a nonce.
- `next.config.js`: Rewrites `/api/:path*` to the Bun API server via `API_HOST`/`API_PORT`.
- `lib/db.ts`: SQLite access via `bun:sqlite` plus an in-memory test implementation for Vitest.
- `lib/logger.ts`: “structured logger” wrapper, but currently emits formatted strings and does not propagate request context.
- `lib/api/caixa-client.ts`: Fetches CAIXA API data with retry/backoff and ETag caching, but uses console logging.
- `scripts/*.ts`: Operational scripts (ingest, optimize, docker startup). Several emit emoji output and use console.

Current gaps vs guidelines:

1. Emoji usage violates repo rules and makes logs harder to parse.
2. Logging is not structured (no stable event names, requestIds, and redaction strategy).
3. Audit trail is missing (no append-only storage of significant events).
4. Configuration correctness is brittle (hardcoded localhost usage in server-side fetch paths and mismatched domains for CORS vs site metadata).

## Plan of Work (multi-phase)

### Phase 0: Inventory and success metrics (discovery + constraints)

Goal: Turn the findings into an implementation backlog that is safe, measurable, and testable.

Work:

- Enumerate every emoji usage in runtime codepaths (not docs): `server.ts`, `scripts/*.ts`, `components/`.
- Enumerate every `console.*` usage in runtime codepaths and decide which must become `logger.*`.
- Identify every place `localhost` is hardcoded and define a single “API base URL resolution” strategy for:
  - Next server components
  - Server Actions (`'use server'`)
  - Client components (browser)
  - Docker/prod deployments

Acceptance:

- A prioritized list exists with acceptance criteria per item (P0/P1/P2).

### Phase 1: Remove emoji usage (runtime + UI)

Goal: Enforce “no emojis” rule across runtime output and UI.

Work:

- Replace emoji and emoji-like glyphs in:
  - `server.ts` startup/shutdown logs
  - `scripts/start-docker*.ts` logs
  - `scripts/pull-draws.ts`, `scripts/optimize-db.ts`, `scripts/migrate.ts`
  - UI strategy icon strings in `components/bet-generator/*` (replace with lucide icons or existing shadcn patterns)
- Add a CI-style check to prevent regressions (simple `rg`-based scan in `tests/validate-*` or a new lightweight script) excluding `docs/`.

Acceptance:

- A repo scan for emoji/status glyphs across runtime codepaths returns no matches (exclude `docs/`).
  Command:
    rg --pcre2 -n "[\\x{2600}-\\x{27BF}\\x{1F300}-\\x{1FAFF}]" server.ts scripts app components lib
- UI does not render emoji glyphs.

### Phase 2: Structured logging with request context (server + scripts)

Goal: Align logging behavior with `docs/GUIDELINES-REF/LOG-GUIDELINES.md`.

Work:

- Extend `lib/logger.ts` to support structured payloads:
  - Always emit JSON (or logfmt) with fields: `timestamp`, `level`, `event`, `requestId`, `route`, `durationMs`, and `metadata`.
  - Enforce redaction/truncation rules (no secrets; truncate error message; no stack in prod).
- In `server.ts`, generate a `requestId` per request and include it in every log for that request.
  - Also attach `route`, `method`, `status`, and `durationMs`.
- Replace `console.*` in runtime codepaths with `logger` calls (where it provides value).

Acceptance:

- For a request to `/api/dashboard`, logs include `event: "api.request"` and `event: "api.response"` with the same `requestId`.
- No raw request bodies are logged; no tokens/secrets are logged.

### Phase 3: Minimal audit trail (append-only)

Goal: Add a minimal SQLite-backed audit trail aligned with `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md`.

Work:

- Add a new table (migration) for audit events (append-only):
  - `id` (uuid text), `timestamp` (iso string), `event`, `route`, `method`, `success`, `duration_ms`,
    `ip_hash`, `user_agent_sanitized`, `metadata_json`, `deleted_at` nullable.
- Implement an `lib/audit` writer:
  - Hash IP (SHA-256) and sanitize user agent.
  - Store minimal metadata (no request bodies).
- Emit audit events for:
  - `api.health_checked`
  - `api.dashboard_read`
  - `api.statistics_read`
  - `api.trends_read`
  - `bets.generate_requested` (include budget as numeric, strategy/mode, success/failure)

Acceptance:

- After hitting `/api/generate-bets`, an audit event is written with `success=true` and a hashed IP (no raw IP stored).
- Audit writes do not materially slow requests (use batched/async strategy where feasible).

### Phase 4: Configuration correctness (base URLs, CORS, domains)

Goal: Remove fragile `localhost` assumptions and ensure prod behavior is correct by default.

Work:

- Define a single source of truth for public site URL and API URL:
  - Ensure Next metadata base URL matches the default allowed origin.
  - Avoid hardcoding `conhecendotudo.online` if the product domain is `megasena-analyzer.com.br` (or make it explicit via env).
- Replace server-side `fetch("http://localhost:.../api/...")` patterns with a strategy that works in Docker and remote deployments:
  - Prefer fetching relative `/api/...` and relying on Next rewrites, or
  - Use `API_HOST`/`API_PORT` everywhere consistently.
- Fix build determinism:
  - Pin `turbopack.root` in `next.config.js` to this repo directory to avoid selecting external lockfiles.

Acceptance:

- In Docker, Next server and Bun API server communicate without assuming `localhost` unless explicitly configured.
- `bun run build` no longer warns about selecting an external workspace root (or the root is explicitly set in config).

### Phase 5: Validation, tests, and documentation updates

Goal: Make the changes safe and verifiable.

Work:

- Add unit tests for:
  - Logger redaction/truncation in prod mode.
  - Audit writer hashing and schema validation.
- Add integration tests (lightweight) for:
  - `/api/*` endpoints returning consistent JSON shape and status codes.
- Update docs describing the new logging/audit behavior and required env vars (if behavior changes).

Acceptance:

- `bun run lint` passes with `--max-warnings=0`.
- `bun run test -- --run` passes.
- `bun run build` passes.

## Concrete Steps (how to execute)

Run from repo root:

  bun install
  bun run lint
  bun run test -- --run
  bun run build

Manual verification (dev):

  bun run dev
  curl http://localhost:3201/api/health
  curl http://localhost:3201/api/dashboard
  curl "http://localhost:3201/api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true"
  curl "http://localhost:3201/api/trends?numbers=1,5,10&period=yearly"
  curl -X POST http://localhost:3201/api/generate-bets -H "Content-Type: application/json" -d '{"budget":50,"strategy":"balanced","mode":"optimized"}'

## Validation and Acceptance

Behavior-level acceptance checks:

- No emoji glyphs appear in console output when running `bun run dev`, `bun run build`, or when calling the API endpoints.
- API error responses are consistent and do not leak stack traces in production.
- Audit events exist for significant API calls and do not contain PII/secrets.
- CSP/security headers remain active via `proxy.ts` for all non-static routes.

## Idempotence and Recovery

- Migrations must be idempotent and run inside a transaction; failures must not leave the database half-migrated.
- Audit and logging changes must be additive first (emit new events) before removing old output formats.
- If an audit/logging change causes unexpected overhead, rollback path is to disable the feature behind an env flag while retaining the schema/migrations.

## Artifacts and Notes

Baseline evidence captured prior to implementation:

- `bun --version` returned `1.3.4`.
- `bun run lint` succeeded (exit 0) with a warning about `baseline-browser-mapping` staleness.
- `bun run test -- --run` succeeded with 83 passing and 12 skipped tests.
- `bun run build` succeeded on Next.js 16.0.7 with a workspace-root inference warning due to an external lockfile.

## Interfaces and Dependencies

New/updated modules proposed by this plan:

- `lib/logger.ts`: emit structured logs with stable `event` names and request context fields.
- `lib/audit/*`: audit event writer + types (append-only semantics, privacy-first hashing).
- `db/migrations/*`: add `audit_logs` table and any required indexes.
