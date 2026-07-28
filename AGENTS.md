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

## Model routing & review discipline

This repo is public and ships production code; choose the model tier to match the
risk and nature of the task. The global `CLAUDE.md` governs cross-project behavior;
this section adds the project-specific default:

- **Claude Opus 5** — deep reasoning, complex debugging, architecture decisions,
  security audits, performance investigations, and multi-file refactors.
- **Claude Fable 5** — user-facing design, copy/UX, API design, narrative docs, and
  any review where taste and clarity matter more than raw reasoning depth.
- **Claude Sonnet 5 / Opus 4.x** — everyday implementation and verification when
  Opus 5 is unnecessary; never Haiku for shipped code.
- **Codex (`gpt-5.6`)** remains the default backend/heavy executor for well-specified,
  self-contained work (see global routing). Use it unless the task is frontend/visual
  or requires the reasoning depth that Opus 5 provides.

For code review and closeout, prefer the bundled `autoreview` skill (Codex default).
Add an Opus 5 or Fable 5 panel only for high-stakes releases, security-sensitive
changes, or when the diff is user-facing and taste is the primary risk.

When in doubt, bias toward the smarter model for the decision at hand; cost is a
tie-breaker, not a ceiling. Intelligence > taste > cost when they conflict for
anything that ships.

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
bun run db:backfill-prizes   # re-hydrate prize columns on already-stored draws
bun run doctor               # React Doctor scan (same check the pre-commit hook runs)
```

**Pre-commit hook:** `.githooks/pre-commit` is the single versioned hook — staged
gitleaks secret scan plus React Doctor (`--blocking error`; warnings never block).
Both fail open when their tool is missing. Activate once per clone with
`git config core.hooksPath .githooks`; never point `core.hooksPath` at a second
directory, since Git honours only one and the other silently stops running.

Security/ops helpers: `security:secrets`, `security:secrets:history` (redacted git
history scan, fails on findings), `security:csp:edge` (verify edge did not replace app
CSP), `deploy:verify` (public `/api/health` freshness), `audit:prune` / `log:prune`.

**Done-when:** `bun run lint`, `bun run typecheck`, `bun run test -- --run`,
`pnpm audit --prod`, and `bun run build` all pass; `bun run test:e2e` for UI-affecting
changes.

## Architecture map

- `app/` — Next.js App Router pages only: `dashboard/` (with nested
  `dashboard/statistics/` and `dashboard/generator/`), plus `about/`, `privacy/`,
  `terms/`. There is **no** `app/api/` — see `server.ts` below.
- `proxy.ts` — the Next.js 16 middleware (Next renamed `middleware` → `proxy`).
  Mints the per-request CSP nonce, forwards it as the `x-nonce` request header, and
  sets page security headers.
- `lib/analytics/` — statistics engine + `bet-generator.ts` (DP bet-size optimizer).
- `lib/api/caixa-client.ts` — CAIXA API client; `lib/db.ts` — SQLite layer.
- `lib/constants.ts` — centralized config; `BASE_URL` lives here (never hardcode the
  domain in pages).
- `server.ts` — standalone Bun server that owns **every** `/api/*` endpoint (port
  3201). `next.config.js` `rewrites()` forwards `/api/:path*` to it, and
  `scripts/dev.ts` boots both processes, waiting on `/api/health` before Next
  starts. New endpoints go here, never in `app/`.
- `scripts/` — Bun CLIs (pull-draws, migrate, optimize-db, prune, security scans,
  deploy checks).
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
  needs a strong `INTERNAL_API_SECRET` + a **loopback** target — `API_HOST` must stay
  loopback or the secret is withheld and SSR calls fall back to the public quota.
- **Forwarded-IP trust is an ops contract, not just code.** The header chosen for the
  client IP becomes the rate-limit key, so the public edge must rewrite it on every
  request. `CF-Connecting-IP` is set by Cloudflare and is *not* rewritten by an
  intermediate Traefik/Nginx: either restrict the origin to Cloudflare, or pin
  `TRUSTED_CLIENT_IP_HEADER` to the single header your own proxy rewrites. See
  `docs/SECURITY.md` → "Confiança em proxy".
- **Prize data is a separate ingestion concern.** `db:pull` rewrites every column of
  every contest; `db:backfill-prizes` only re-hydrates the prize columns and is the safe
  option against a populated DB. The historical import predates the current
  `listaRateioPremio`/`faixa` handling, so a DB restored from an old snapshot will show
  `R$ 0,00` across the "Prêmios" section until it is backfilled.
- **Optimized-mode budget is capped** at `BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET`
  (R$ 20.000) and the client mirrors that ceiling per selected mode. Every other mode is
  bounded by `MAX_BUDGET`; the API zod schema and the form read the same constants.
- **Required prod secrets (names only):** `IP_HASH_SECRET` (≥32 chars; server exits if
  missing in production — pseudonymizes IPs via HMAC-SHA256, `lib/security/`).
  `IP_HASH_SECRET_AUTOGENERATE=true` is Playwright/E2E-only, never real deploy.
- **LGPD:** changes to collection/retention/purpose must sync `docs/PRIVACY.md`,
  `docs/LGPD-COMPLIANCE.md`, `lib/i18n.ts`, and the storage-disclosure banner
  (`components/storage-disclosure.tsx` must list every `localStorage` key).
- Use semantic design tokens only (`bg-background`, `text-foreground`) — no hardcoded
  color classes. Edit the design system (`app/globals.css`, `tailwind.config.js`)
  before components. `lang="pt-BR"` in `app/layout.tsx`.
- **`--primary` and `--destructive` are dual-purpose tokens**: each is used as a
  surface (`bg-*` with its `-foreground`) *and* as text (`text-primary` on cards,
  `text-destructive` in the footer). Those two uses pull contrast in opposite
  directions, so changing lightness to fix one silently breaks the other. Check both
  against 4.5:1 before touching them, and prefer adjusting the paired `-foreground`
  over flattening the hue.
- **Lighthouse:** the production build scores 95/100/100/100 served directly. Through
  Cloudflare the same build measures 61/96/81/100 because JavaScript Detections
  injects `/cdn-cgi/challenge-platform/.../main.js` (~4.3s of scripting versus 0.2s
  for all app JavaScript, plus three deprecated APIs). Measure against a local
  production server before concluding the app regressed.

## Deployment

Manual (not auto-deploy). Docker runtime image is **runtime-only** — build locally,
run `bun run dist:standalone`, ship `dist/standalone/`. Reverse proxy Traefik v3
(Coolify), CDN Cloudflare; container `megasena-analyzer`; prod
`https://megasena-analyzer.com.br`. After deploy, `bun run deploy:verify` must pass
against public `/api/health` (stale version = not deployed). Staging requires an
explicit reachable target — never inferred from the prod alias. Full workflow in
`docs/DEPLOY.md`. Deployment scripts + server access live in the separate private
repo `megasena-deployment-private`, not here.
