# ExecPlan: GUIDELINES-REF alignment (Next.js 16 + Bun) (2025-12-17)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This file must be maintained in accordance with `docs/GUIDELINES-REF/EXECPLANS-GUIDELINES.md`.

## Purpose / Big Picture

Make this repository provably aligned with the canonical 2025/2026 engineering rules in `docs/GUIDELINES-REF/`, especially:

- `docs/GUIDELINES-REF/SECURITY-GUIDELINES.md` (privacy-first, least privilege, no secrets in logs)
- `docs/GUIDELINES-REF/LOG-GUIDELINES.md` (structured logs with request context)
- `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md` (append-only audit trail for significant events)
- `docs/GUIDELINES-REF/WEB-NEXTJS-GUIDELINES.md` (Next.js 16 proxy model, build determinism)

User-visible outcome:

- Running the app in dev and production emits machine-parseable logs (JSON) that include `requestId`, `route`, and `durationMs` for API traffic, without logging raw IPs or secrets.
- Significant API actions write an append-only audit record into SQLite.
- Deploy verification scripts match the actual production container name/domain.
- `bun run lint`, `bun run test -- --run`, and `bun run build` pass.

Non-negotiable product reality remains unchanged: this app analyzes historical results; it does not and must not claim prediction capability.

## Progress

- [x] (2025-12-17) Verified production deploy model is not “static SPA via Nginx”; it is a Bun container running Next.js standalone + Bun API behind Traefik (`Dockerfile`, `docker-compose.coolify.yml`).
- [x] (2025-12-17) Removed emoji glyphs from runtime/UI/scripts/tests to satisfy repo rule “Never use emojis”.
- [x] (2025-12-17) Hardened rate-limit key privacy by hashing client identifiers (no raw IP in logs or in-memory rate-limit keys).
- [x] (2025-12-17) Made Next build deterministic by pinning `turbopack.root` to this repo in `next.config.js`.
- [x] (2025-12-17) Implemented structured JSON logging with request context propagation for the Bun API server (`lib/logger.ts`, `server.ts`).
- [x] (2025-12-17) Implemented an append-only SQLite audit trail (schema + writer + emission for significant events) (`db/migrations/004_audit_logs.sql`, `lib/audit.ts`, `server.ts`).
- [x] (2025-12-17) Added tests for logger redaction/truncation and audit hashing/writer correctness (`tests/lib/logger.test.ts`, `tests/lib/audit.test.ts`).
- [x] (2025-12-17) Added retention tooling for audit logs (soft delete) and documented how to run it (`scripts/prune-audit-logs.ts`, `package.json`).
- [x] (2025-12-17) Re-ran `bun run lint`, `bun run test -- --run`, and `bun run build` and recorded evidence in this file.
- [x] (2025-12-17) Updated `Outcomes & Retrospective`.

## Surprises & Discoveries

- Observation: Next.js can infer the “workspace root” incorrectly if there is an unrelated lockfile elsewhere on disk.
  Evidence: `bun --bun next build` warned that it selected `/Users/mneves/package-lock.json` as root while this repo uses `bun.lock`.
  Impact: Build behavior becomes environment-dependent unless `turbopack.root` is pinned.

- Observation: “Static SPA via Nginx serving dist/” is not an accurate description of the current repo.
  Evidence: `Dockerfile` copies `dist/standalone` (Next.js `output: 'standalone'`) and runs `server.ts` plus Next’s `server.js` under Bun.

## Decision Log

- Decision: Keep the dual-server architecture (Next.js UI + Bun API server).
  Rationale: Bun API server is required for `bun:sqlite` access; moving back to Next Route Handlers would reintroduce Node runtime incompatibility.
  Date/Author: 2025-12-17 / agent

- Decision: Do not store or log raw client IP addresses.
  Rationale: `docs/GUIDELINES-REF/LOG-GUIDELINES.md` and `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md` require hashing IP addresses for privacy; raw IPs are PII.
  Date/Author: 2025-12-17 / agent

- Decision: Treat “health checks” as system noise in the audit trail by default.
  Rationale: Docker/Coolify health checks can happen frequently and would bloat audit logs; audit should track significant user/data actions (with an opt-in to audit health checks if required).
  Date/Author: 2025-12-17 / agent

## Outcomes & Retrospective

Completed on 2025-12-17.

Outcomes:

- `server.ts` now emits request-scoped structured JSON logs (`api.request_received` / `api.request_completed`) with `requestId`, `route`, and `durationMs`, and avoids raw client IP storage/logging.
- SQLite now has an append-only audit trail table (`audit_logs`) and the Bun API server writes audit events for significant actions with privacy-safe metadata.
- Audit retention is supported via a dedicated script that performs idempotent soft deletes (`deleted_at`) rather than hard deletes.
- Regression tests cover the highest-risk parts of this change (log redaction/truncation and audit writer flushing + retention idempotence).

Notable remaining signals:

- Tooling warnings still appear (baseline-browser-mapping staleness; Vite CJS API deprecation message during Vitest).
- Next.js reports an edge runtime warning that disables static generation for the affected page; this does not fail the build.

## Context and Orientation

This repository is a Next.js 16 App Router application that renders UI pages and calls into a separate Bun HTTP server for API endpoints that need SQLite access (`bun:sqlite`).

Key files:

- `server.ts`: Bun server exposing `/api/*` endpoints and reading/writing SQLite via `lib/db.ts`.
- `proxy.ts`: Next.js proxy hook (Next.js 16 replacement for middleware) that sets CSP/security headers and injects a per-request nonce.
- `next.config.js`: Uses `output: 'standalone'` and rewrites `/api/*` to the Bun API server.
- `lib/db.ts`: SQLite access wrapper plus in-memory fallback used in Vitest (Node process) when `Bun` is not available.
- `lib/logger.ts`: Project logger abstraction; must be upgraded to structured logs and safer production behavior.

Terms used in this plan:

- “Structured log”: a single-line JSON object with stable keys (`event`, `requestId`, `route`, etc.) that is easy to ingest in log tools. This is required by `docs/GUIDELINES-REF/LOG-GUIDELINES.md`.
- “Audit trail”: an append-only record in SQLite capturing significant actions (what happened, when, success/failure) with privacy rules (hash IP, sanitize user agent). This is required by `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md`.
- “Significant actions”: for this project, read operations that expose aggregated dataset results and any bet generation request. These must be auditable without storing raw user inputs.

## Plan of Work

This work is organized into milestones so each milestone is independently verifiable and reduces risk.

### Milestone 1: Structured logging (server request context)

Goal: Every API request handled by `server.ts` emits consistent, privacy-safe structured logs that include:

- `event` (domain.action naming)
- `requestId` (generated per request)
- `route` and `method`
- `statusCode` and `durationMs`
- `launchStage` (dev/staging/prod)
- hashed client identifier (no raw IP)
- sanitized user agent (truncated, no newlines)

Implementation approach:

- Upgrade `lib/logger.ts` to emit one-line JSON logs (no emojis, no ANSI art).
- In `server.ts`, generate `requestId` at request entry and pass it to all logs for that request.
- Include `X-Request-Id` response header for correlation in clients and proxies.

Acceptance:

- Running `bun run dev`, hitting `http://localhost:3201/api/dashboard` produces at least two log lines:
  - `event: "api.request_received"` with a `requestId`
  - `event: "api.request_completed"` with the same `requestId`, a `statusCode`, and `durationMs`

### Milestone 2: SQLite audit trail (append-only)

Goal: Every significant API action writes an append-only audit event into SQLite, meeting privacy constraints.

Implementation approach:

- Add a migration in `db/migrations/` creating `audit_logs` with indexes and `deleted_at` soft-delete column.
- Implement `lib/audit.ts` with:
  - `enqueueAuditEvent(...)` (non-blocking, bounded in-memory buffer)
  - `flushAuditQueue(...)` (batch insert in a DB transaction)
  - `startAuditWriter()` / `stopAuditWriter()` to avoid background intervals in tests
- Emit audit events from `server.ts` for:
  - `api.dashboard_read`
  - `api.statistics_read`
  - `api.trends_read`
  - `bets.generate_requested`

Acceptance:

- After a `POST /api/generate-bets`, an audit record exists with:
  - `event = "bets.generate_requested"`
  - `success = true` for status < 400
  - `client_id_hash` prefixed with `sha256:` (no raw IP stored)

### Milestone 3: Retention tooling (soft delete)

Goal: Provide a repeatable way to apply retention policies without hard deleting audit data.

Implementation approach:

- Add a script (Bun) that soft-deletes audit rows older than a configured age by setting `deleted_at`.
- Make the script idempotent (re-running does not change already-soft-deleted rows).

Acceptance:

- Running the retention script twice reports `0` additional rows updated on the second run.

### Milestone 4: Tests and verification

Goal: Prove correctness via automated tests and verifiable commands.

Implementation approach:

- Add unit tests for:
  - `lib/logger.ts` error truncation and stack suppression in production mode.
  - `lib/audit.ts` hashing and insertion logic using the Vitest in-memory DB driver.
- Run:
  - `bun run lint`
  - `bun run test -- --run`
  - `bun run build`

Acceptance:

- All commands pass.
- Tests demonstrate privacy constraints (no raw IP, truncated error message).

## Concrete Steps

Run from repository root:

  bun run lint
  bun run test -- --run
  bun run build

For manual API verification (dev):

  bun run dev

In a second terminal:

  curl -sS http://localhost:3201/api/health | jq .
  curl -sS http://localhost:3201/api/dashboard | jq .
  curl -sS "http://localhost:3201/api/statistics?delays=true&decades=true&pairs=true&parity=true&primes=true&sum=true&streaks=true&prize=true" | jq .
  curl -sS "http://localhost:3201/api/trends?numbers=1,5,10&period=yearly" | jq .
  curl -sS -X POST http://localhost:3201/api/generate-bets -H "Content-Type: application/json" -d '{"budget":50,"strategy":"balanced","mode":"optimized"}' | jq .

For audit log retention (soft delete):

  bun run audit:prune -- --days 365 --dry-run
  bun run audit:prune -- --days 365

## Validation and Acceptance

The final state is accepted when:

- No emoji glyphs exist in runtime/UI/scripts outputs (repo rule).
- Logs are structured JSON and include request context per `docs/GUIDELINES-REF/LOG-GUIDELINES.md`.
- Audit trail exists in SQLite and is append-only per `docs/GUIDELINES-REF/AUDIT-GUIDELINES.md`.
- No raw IP addresses or secrets are stored/logged.
- `bun run lint`, `bun run test -- --run`, and `bun run build` pass.

## Idempotence and Recovery

- Migrations are transactional in `lib/db.ts`; re-running `bun run db:migrate` is safe.
- Audit retention script only performs soft deletes and is safe to re-run.
- If audit queue flush fails, requests should still succeed; failures must be logged with a requestId for follow-up.

## Artifacts and Notes

When this plan is complete, paste short transcripts here:

- 2025-12-17: `bun run lint`
  - Exit: 0
  - Note: baseline-browser-mapping staleness warning emitted.

- 2025-12-17: `bun run test -- --run`
  - Exit: 0
  - Test Files: 9 passed | 1 skipped (10)
  - Tests: 87 passed | 12 skipped (99)

- 2025-12-17: `bun run build`
  - Exit: 0
  - Next.js: 16.0.7
  - Note: edge runtime warning emitted.

## Interfaces and Dependencies

- The project is Bun-first and must remain Bun-first (`package.json` uses `bun --bun next ...`; `bun:sqlite` is required).
- Avoid adding external observability vendors in this milestone; keep logs/audit local-first and extensible.
