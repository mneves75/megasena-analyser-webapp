# Mega-Sena Analyzer — Agent Guide

Canonical agent contract for this repo (read by Codex, Claude Code, and any agent).
Assume this repository is **public**: never commit secrets, tokens, SSH details,
local paths, or private operational notes; use placeholders (`user@server`,
`example.com`) in examples. User-facing copy is **pt-BR**.

Next.js web app for statistical analysis of Brazil's Mega-Sena lottery. Fetches
historical draws from the official CAIXA API into a local SQLite DB, runs frequency/
pattern statistics, and generates budget-constrained betting strategies. It makes no
predictions — lottery outcomes are random and the UI must state this. Deploy target:
self-hosted Docker (Next.js standalone + a Bun API server) behind Traefik/Cloudflare.

## Runtime & package manager (non-obvious)

- **Bun is the runtime** (`>=1.3.14`); scripts and servers run under `bun`. The app
  uses Bun's native `bun:sqlite` and **will not run on Node.js**.
- **Production Docker image uses Bun canary** pinned by immutable digest. The
  matching canary revision is recorded in `.bun-canary-revision`; update both
  together when intentionally bumping canary.
- **CI uses a stable pinned Bun version** recorded in `.bun-ci-version` and
  installed via `.github/actions/setup-bun-pinned/action.yml` (the `setup-bun`
  action cannot immutably pin canary builds).
- **pnpm is the dependency manager** (`pnpm@11`, `pnpm-lock.yaml`). Security overrides
  live in `pnpm-workspace.yaml` (pnpm ignores `package.json` `overrides`).
  `pnpm-workspace.yaml` also sets `minimumReleaseAge` and `trustPolicy: no-downgrade`
  (with documented exclusions) as supply-chain gates; remove overrides only when
  `pnpm audit` stays clean without them.
- `bunfig.toml` sets `run.noOrphans` to avoid orphaned Bun processes.

## Commands (verified against package.json)

```bash
pnpm install                 # install deps (corepack enable; pnpm@11)
bun run dev                  # dev server on localhost:3000
bun run lint                 # eslint --max-warnings=0
bun run typecheck            # tsc --noEmit
bun run test -- --run        # vitest once (omit -- --run for watch)
bun x vitest tests/lib/bet-generator.test.ts --run   # single test file
bun run test:e2e             # playwright
bun run build                # next build + assert-standalone-clean gate
bun run start                # serve production stack locally
bun run db:migrate           # apply SQLite migrations
bun run db:pull              # pull historical draws from CAIXA
bun run doctor               # React Doctor scan (error-blocking hook in .husky)
```

Security/ops helpers: `security:secrets`, `security:secrets:history` (redacted git
history scan, fails on findings), `security:csp:edge` (verify edge did not replace app
CSP), `deploy:verify` (public `/api/health` freshness), `audit:prune` / `log:prune`.

**Done-when:** `bun run lint`, `bun run typecheck`, `bun run test -- --run`,
`pnpm audit --prod`, and `bun run build` all pass; `bun run test:e2e` for UI-affecting
changes.

## Architecture map

- `app/` — Next.js App Router routes (`dashboard/`, `statistics/`, `generator/`).
- `lib/analytics/` — statistics engine + `bet-generator.ts` (DP bet-size optimizer).
- `lib/api/caixa-client.ts` — CAIXA API client; `lib/db.ts` — SQLite layer.
- `lib/constants.ts` — centralized config; `BASE_URL` lives here (never hardcode the
  domain in pages).
- `server.ts` — Bun `/api/*` server; `scripts/` — Bun CLIs (pull-draws, migrate,
  optimize-db, prune, security scans, deploy checks).
- `db/` — SQLite DB + migrations. `tests/` — Vitest, mirrors source. `docs/` — specs,
  privacy/LGPD, deploy, security decision records.

## Conventions & constraints (project-specific)

- **Test DB is in-memory:** `lib/db.ts` swaps to `InMemoryDatabase` under Vitest
  (checks `process.env.VITEST`). Force real file DB with `VITEST_FORCE_FILE_DB=1`.
  Coverage threshold 80%; exclusions defined in `vitest.config.ts`.
- **Hard-delete exception (approved):** audit/log retention deletes rows permanently
  (`audit:prune`, `log:prune`). This overrides the global soft-delete default and is
  the only place hard delete is allowed.
- **DB writes:** batch large ingestions in a single transaction with rollback; use
  prepared statements; run `scripts/optimize-db.ts` after big pulls; keep ~15-20% disk
  free (WAL requirement). `bun run build` fails if `.next/standalone` contains DB/WAL/
  SHM/backup artifacts.
- **CSP:** production uses per-request nonces for `script-src` and `style-src`. Do not
  switch to a static/SRI CSP (breaks App Router streaming hydration) without E2E proof.
  Only the narrow `style-src-attr 'unsafe-inline'` exception is allowed (chart style
  attrs). Public edge/proxy must not define its own CSP — run `security:csp:edge` after
  Cloudflare/Traefik changes.
- **Bun `/api/*`** keeps its own defensive headers (deny-by-default JSON CSP, nosniff,
  frame deny, `Cache-Control: no-store`, HSTS on secure prod only) and rate limiting
  (100 req/min/IP, incl. `/api/health`). `X-Forwarded-*` only trusted when
  `TRUST_PROXY_HEADERS=true` + loopback/`TRUSTED_PROXY_IPS`. Internal rate-limit bypass
  needs a strong `INTERNAL_API_SECRET` + loopback peer.
- **Required prod secrets (names only):** `IP_HASH_SECRET` (≥32 chars; server exits if
  missing in production — pseudonymizes IPs via HMAC-SHA256, `lib/security/`).
  `IP_HASH_SECRET_AUTOGENERATE=true` is Playwright/E2E-only, never real deploy.
- **LGPD:** changes to collection/retention/purpose must sync `docs/PRIVACY.md`,
  `docs/LGPD-COMPLIANCE.md`, `lib/i18n.ts`, and the storage-disclosure banner
  (`components/storage-disclosure.tsx` must list every `localStorage` key).
- Use semantic design tokens only (`bg-background`, `text-foreground`) — no hardcoded
  color classes. Edit the design system (`app/globals.css`, `tailwind.config.js`)
  before components. `lang="pt-BR"` in `app/layout.tsx`.

## Deployment

Manual (not auto-deploy). Docker runtime image is **runtime-only** — build locally,
run `bun run dist:standalone`, ship `dist/standalone/`. Reverse proxy Traefik v3
(Coolify), CDN Cloudflare; container `megasena-analyzer`; prod
`https://megasena-analyzer.com.br`. After deploy, `bun run deploy:verify` must pass
against public `/api/health` (stale version = not deployed). Staging requires an
explicit reachable target — never inferred from the prod alias. Full workflow in
`docs/DEPLOY.md`. Deployment scripts + server access live in the separate private
repo `megasena-deployment-private`, not here.
