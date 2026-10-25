# Mega-Sena Analyzer — Agent Guide

Assume this repository is **public**: never commit secrets, tokens, SSH details,
local paths, personal contact information, or private operational notes. Do not
commit account names/emails, account/zone/namespace/deployment IDs, workers.dev
endpoints, assigned nameservers, billing details, infrastructure inventories, or
private telemetry counts. Keep operational evidence in ignored private storage;
use placeholders (`user@server`, `example.com`) in examples. User-facing copy is **pt-BR**.

Next.js web app for statistical analysis of Brazil's Mega-Sena lottery. Fetches
historical draws from the official CAIXA API into a local SQLite DB, runs frequency/
pattern statistics, and generates budget-constrained betting strategies. It makes no
predictions — lottery outcomes are random and the UI must state this. Production
and staging use a vinext frontend Worker and private SQLite Durable Object.
The Next.js standalone + Bun API Docker path remains available for local use
and recovery; it is not the production deployment target.

## Cloudflare production and staging

Deployment acceptance requires current private evidence for identity, Argent UI,
API/security, scheduled ingestion, retained-data reconciliation and public DNS.
Never publish account-specific evidence here. See docs/DEPLOY.md for the procedure.
`cloudflare/worker.ts` serves
pages through vinext and routes `/api/*` through private binding `DATA` to
`MegaSenaData` (`cloudflare/data-object.ts`). `lib/api/handler.ts` is the shared
API contract; `server.ts` is the local/VPS Bun adapter. New API routes belong in
the shared handler. Database and log contexts are scoped per operation.

`vite.config.ts` selects the Durable Object database and private server-side API
transport. Public headers cannot authorize internal RPC. `cloudflare.config.ts`
defines distinct staging/production Worker names, required `IP_HASH_SECRET`, and
`DAILY_REFRESH_ENABLED=1`. `MegaSenaData` owns the daily 06:00 UTC (03:00 Brasília)
alarm. Seed bootstrap through contest 3065 is
empty-DB-only, not proof of current CAIXA data. Refresh validates before atomic
append/cache updates, with at most three persisted alarm retries per daily cycle.
The schedule journal, retry budget and native alarm commit together before network
I/O. Success and retry exhaustion preserve the next calendar 06:00 UTC. Initialization
preserves an existing schedule; early duplicate delivery cannot spend another attempt.
Infrastructure errors must escape the alarm handler. Existing remote Cron registrations
must be explicitly removed and read back: `cf` beta5 preserves them for `triggers: []`.
Retention bindings keep Bun's 400/30-day defaults
and configurable semantics; copy the source settings before migrating retained rows.
See docs/DEPLOY.md for per-environment build inputs and architecture alternatives.

The official CAIXA portal now publishes `servicebus3.caixa.gov.br` in its
`Style Library/json/params.txt` configuration. `API_CONFIG.CAIXA_BASE_URL` owns
that URL; the CSP derives its origin. If ingestion fails, verify the portal's
current configuration before attributing the failure to an upstream outage.

`lib/site-domains.json` owns the canonical hostname and its five existing aliases.
Only production redirects those aliases, preserving path/query with a fixed
canonical authority. Domain attachment requires `CLOUDFLARE_BIND_CUSTOM_DOMAINS=1`
when building the release; default builds do not request a DNS cutover. Apply
domain triggers only after data/rollback acceptance, and retain configured domains
on subsequent production builds. Staging binds only its own hostname.

The Bun-only statements below apply to the local/VPS path. The Worker runs on
Cloudflare with `nodejs_compat` and SQLite Durable Object storage. Keep all existing
gates, and add `bun run build:cloudflare`, `bun run build:cloudflare:production`,
`bun run test:cloudflare` and Argent verification of the Worker runtime. Use `cf`
through the cf-cli skill for Cloudflare operations. Staging, data freshness,
backup/restoration, retention and public version/CSP/Argent proof must precede
DNS cutover and VPS shutdown. Preserve a verified backup and rollback path.
See docs/DEPLOY.md; do not infer deployment authorization from preparation.

## Runtime & package manager (non-obvious)

- **Bun is the local/VPS runtime** (`>=1.4.2`); scripts and servers run under `bun`. The app
  uses Bun's native `bun:sqlite` and **will not run on Node.js**.
- **Production Docker image uses Bun stable** (`oven/bun:1.4.2-alpine`) pinned by
  immutable digest; re-verify with `docker buildx imagetools inspect` whenever you
  move the pin.
- **CI uses a pinned Bun version** recorded in `.bun-ci-version` and installed via
  `.github/actions/setup-bun-pinned/action.yml`. Next.js production builds still
  compile under the Node patch in `.nvmrc` (currently 22.23.4; the workflows and
  `tests/scripts/supply-chain-controls.test.ts` read that file, so the gate cannot
  drift a patch behind the runtime image): the old Bun 1.3.14 Linux SIGSEGV building
  Next.js 16.3.0 was a napi thread-safe-function use-after-free, fixed in
  Bun 1.4.0 (oven-sh/bun#36866), but the builder stays Node until `next build`
  under Bun is re-validated in CI. The Next.js standalone server itself already
  runs under Bun at runtime (`bun --bun ./server.js`); scripts, SQLite and the
  API server remain on Bun.
- **Use pnpm exclusively** (`pnpm@11`, `pnpm-lock.yaml`). Never install with npm,
  Yarn, or Bun: those installers ignore `pnpm-lock.yaml` and create duplicate
  physical copies of dependencies. Security overrides
  live in `pnpm-workspace.yaml` (pnpm ignores `package.json` `overrides`).
  `pnpm-workspace.yaml` also sets `minimumReleaseAge` and `trustPolicy: no-downgrade`
  (with documented exclusions) as supply-chain gates; remove overrides only when
  `pnpm audit` stays clean without them.
- `bunfig.toml` sets `run.noOrphans` to avoid orphaned Bun processes.
- Expected generator failures return serializable error data from the Server
  Action: production RSC strips thrown error messages. The client uses pt-BR
  fallback copy for unexpected failures. Budget input accepts pt-BR decimals.
- API shutdown stops accepting requests and drains audit/log queues before
  closing SQLite. Do not enqueue new logs after the final drain; persistence
  failures must not be reported as successful shutdown.

## Commands (verified against package.json)

```bash
pnpm install --frozen-lockfile   # install pinned deps (corepack enable; pnpm@11)
bun run dev                  # dev server on localhost:3000
bun run lint                 # eslint --max-warnings=0
bun run lint:ast             # ast-grep structural supply-chain rules
bun run typecheck            # tsc --noEmit
bun run test -- --run        # vitest once (omit -- --run for watch; add --coverage for the gate)
bun run test:sqlite          # delay analytics on bun:sqlite, isolated disposable DB
bun x vitest tests/lib/bet-generator.test.ts --run   # single test file
bun run test:e2e             # playwright
bun run test:argent          # Argent Chromium mobile generator regression
bun run build                # next build + assert-standalone-clean gate
bun run start                # serve production stack locally
bun run db:migrate           # apply SQLite migrations
bun run db:pull              # pull historical draws from CAIXA
bun run db:backfill-prizes   # re-hydrate prize columns on already-stored draws
bun run db:export-draws      # refresh the versioned public seed db/seed/draws.json
bun run db:import-draws <seed.json> [--dry-run]  # append missing draws to a live DB, no file swap
bun run seo:indexnow -- --contests N[,M] [--dry-run]  # notify IndexNow (needs INDEXNOW_KEY)
bun run doctor               # React Doctor scan (same check the pre-commit hook runs)
```

**Pre-commit hook:** `.githooks/pre-commit` is the single versioned hook — staged
gitleaks secret scan, blocking ast-grep rules, and the lockfile-installed React Doctor
(`--blocking error`; warnings never block). Gitleaks remains fail-open when its binary
is missing; ast-grep and React Doctor fail closed with installation guidance. Activate
once per clone with `git config core.hooksPath .githooks`; never point
`core.hooksPath` at a second directory, since Git honours only one and the other
silently stops running.

Security/ops helpers: `security:secrets`, `security:secrets:history` (redacted git
history scan, fails on findings), `security:csp:edge` (verify edge did not replace app
CSP), `deploy:verify` (public `/api/health` freshness), `audit:prune` / `log:prune`.

**Done-when:** `bun run lint`, `bun run lint:ast`, `bun run typecheck`,
`bun run test -- --run --coverage`, `bun run test:sqlite`, `bun run security:braces`, `pnpm audit`, and `bun run build` all pass;
Argent Chromium verification for UI-affecting changes. The owner requires Argent
for this review: do not run Playwright. Existing `tests/app` remain legacy coverage;
the saved Argent flow covers generator pagination, not that entire suite. See
README.md for the isolated local production fixture and two-pass replay.

## Architecture map

- `app/` — Next.js App Router pages only: `(home)/` (route group holding `/` and
  its loading state), `dashboard/` (with nested `dashboard/statistics/` and
  `dashboard/generator/`), the public results archive (`resultados/`,
  `resultados/[ano]/`, `concurso/[numero]/`, `numeros/`, `numeros/[numero]/`,
  `mega-da-virada/`),
  `about/`, `privacy/`, `terms/`, plus `sitemap.xml/`, `robots.ts`, `llms.txt/` and
  `indexnow-key.txt/` (served only when `INDEXNOW_KEY` is set).
  Private helpers for the archive live in `app/_lib/` and `app/_components/`.
  There is **no** `app/api/` — see `server.ts` below. Metadata-style route files
  (`sitemap.xml/`, `robots.ts`, `llms.txt/`, `indexnow-key.txt/`, `opengraph-image.tsx`)
  are the only route handlers in `app/`; they read data through the Bun API like pages do.
- **SEO/pSEO invariants** (enforced by `tests/app/seo.spec.ts`):
  - No `loading.tsx` above archive routes. A Suspense boundary streams HTTP 200
    before `notFound()`/`permanentRedirect()` run, turning missing contests into
    soft 404s. The home loading state lives only in `app/(home)/`.
  - Links into `/resultados`, `/concurso` and `/numeros` use `ArchiveLink` or
    `prefetch={false}`: a viewport prefetch renders the whole page and spends one
    call of the visitor's 100 req/min API quota per visible link.
  - Every indexable page builds metadata with `buildPageMetadata`
    (`lib/seo/metadata.ts`): self canonical, `og:url` = canonical, explicit social
    image. The root layout defines no canonical on purpose.
  - Sitemap `lastmod` is the last change of content or links (a draw page changes
    when the next draw adds its "Próximo concurso" link); pages without a known
    date omit it.
- `proxy.ts` — the Next.js 16 middleware (Next renamed `middleware` → `proxy`).
  Mints the per-request CSP nonce, forwards it as the `x-nonce` request header, and
  sets page security headers.
- `proxy.ts` and the Bun API have separate header paths using the shared
  `buildApiSecurityHeaders` helper in `lib/security/csp.ts`; review both when changing CSP.
- `lib/analytics/` — statistics engine + `bet-generator.ts` (DP bet-size optimizer).
- `lib/api/caixa-client.ts` — CAIXA API client; `lib/db.ts` — SQLite layer.
- `lib/constants.ts` — centralized config; `BASE_URL` lives here (never hardcode the
  domain in pages).
- `server.ts` — standalone Bun adapter for **every** `/api/*` endpoint (port
  3201). `next.config.js` `rewrites()` forwards `/api/:path*` to it, and
  `scripts/dev.ts` boots both processes, waiting on `/api/health` before Next
  starts. New endpoints go in `lib/api/handler.ts`, never in `app/`.
- `scripts/` — Bun CLIs (pull-draws, migrate, optimize-db, prune, security scans,
  deploy checks).
- `db/` — SQLite DB + migrations. `tests/` — Vitest, mirrors source. `docs/` — specs,
  privacy/LGPD, deploy, security decision records.
- Vitest excludes `tests/app/**` (Playwright). Coverage counts `components/**` and
  `lib/**` against the coverage gate (CI runs it); a new `lib/` module enters it unless
  explicitly excluded. Never exclude `app/**` by pattern: the checkout folder ends in
  `...webapp/` and Vitest matched it against every path, zeroing the gate.
- `.cursor/rules/*.mdc` repeats architecture for Cursor; update it after changing this contract.

## Engineering principles

- **Remove the replaced path; do not add a compatibility layer.** When a design
  supersedes an older one, delete the old code, flag, alias and fallback in the same
  change. Do not preserve backward compatibility. Existing shims (the
  `scripts/fetch-missing.ts` entry point, the standalone Bun/Docker path) are tracked
  debt to retire, not patterns to copy.
- **Pick the simplest implementation that fully meets the current requirement.** No
  speculative abstraction, configuration knob, plugin point or indirection; add the
  seam when the second real caller exists.
- **Grow the system in layers.** Start from the smallest version that works end to end
  (fetch → store → analyse → serve), then add one capability on top of something that
  already works. Never trade a working product for unfinished complexity, and never let
  a half-built layer block a shipped one.
- **Keep components modular and concerns separated.** Storage (`lib/db.ts`), the shared
  API contract (`lib/api/handler.ts`), statistics (`lib/analytics/`), transport
  (`cloudflare/worker.ts`, `server.ts`) and presentation (`app/`, `components/`) stay
  apart; new endpoints belong in the shared handler, never in `app/`.
- **Lean on what is already installed.** Check `package.json`, the installed types and
  the library's own docs before writing a helper or adding a package; do not assume a
  dependency lacks a capability without verifying.
- **Prefer established, well-maintained libraries** when they reduce overall complexity
  or improve reliability. Do not reimplement common functionality without a stated
  reason. New packages still pass the `pnpm` supply-chain gates in
  `pnpm-workspace.yaml`.
- **Decide for the long term.** Do not accept a stopgap that only works for now and is
  meant to be replaced later; if a decision is provisional, removing it is part of the
  work, not a layer to preserve.

## Conventions & constraints (project-specific)

- **Test DB is real SQLite in memory:** under Vitest (Node), `lib/db.ts` opens a fresh
  `node:sqlite` `:memory:` database and applies the real migrations. Force the Bun file DB
  with `VITEST_FORCE_FILE_DB=1`. `test:sqlite` runs the delay-analysis suite on `bun:sqlite`
  against an isolated disposable `.tmp/e2e/delay-analysis-test.db`; it clears that fixture's draws.
  Coverage thresholds live in `vitest.config.ts` and ratchet from the measured
  baseline (2026-09-25) toward the 80% target: raise them as coverage grows, never
  lower them.
- **Hard-delete exception (approved):** audit/log retention deletes rows permanently
  (`audit:prune`, `log:prune`). This overrides the global soft-delete default and is
  the only place hard delete is allowed.
- **DB writes:** batch large ingestions in a single transaction with rollback; use
  prepared statements; run `scripts/optimize-db.ts` after big pulls; keep ~15-20% disk
  free (WAL requirement). `bun run build` fails if `.next/standalone` contains DB/WAL/
  SHM/backup artifacts. In Docker, `/app/migrations-source` is the image-owned
  canonical migration set; a persisted `/app/db/migrations` may be stale.
- `scripts/fetch-missing.ts` is a compatibility entry point for `pullDraws` in
  incremental mode from the last stored contest; it uses `DATABASE_PATH`, validates
  CAIXA data and commits draws plus derived caches atomically.
- Fixture reset uses only `E2E_DATABASE_PATH` under `.tmp/e2e`, never an inherited
  `DATABASE_PATH`; symlink directories/files and non-regular entries are rejected.
- **CSP:** production uses per-request nonces for `script-src` and `style-src`. Do not
  switch to a static/SRI CSP (breaks App Router streaming hydration) without E2E proof.
  Only the narrow `style-src-attr 'unsafe-inline'` exception is allowed (chart style
  attrs). Public edge/proxy must not define its own CSP — run `security:csp:edge` after
  Cloudflare/Traefik changes.
- **Bun `/api/*`** keeps its own defensive headers (deny-by-default JSON CSP, nosniff,
  frame deny, `Cache-Control: no-store`, HSTS on secure prod only) and rate limiting
  (100 req/min per **network**, incl. `/api/health`; a 429 is audited like any other
  outcome). `X-Forwarded-*` only trusted when
  `TRUST_PROXY_HEADERS=true` + loopback/`TRUSTED_PROXY_IPS`. Internal rate-limit bypass
  needs a strong `INTERNAL_API_SECRET` + a **loopback** target — `API_HOST` must stay
  loopback or the secret is withheld and SSR calls fall back to the public quota.
- **The quota is keyed by network, not by address.** `rateLimitSubject`
  (`lib/security/http.ts`) collapses an IPv6 address to its `/64` and leaves IPv4
  unchanged before the HMAC; keying the full `/128` gave one subscriber a fresh bucket
  per rotated address. The same subject is the audited `clientIdHash`, so this is also
  what bounds the pseudonymised identifier: with no `IP_HASH_SECRET` the fallback is a
  random per-process salt, never an unsalted SHA-256 of the address.
- **Quota and retention constants are shared, never duplicated.** `RATE_LIMIT_MAX_REQUESTS`
  and `RATE_LIMIT_WINDOW_MS` (`lib/api/handler.ts`) feed both the Bun cache and the
  Durable Object; `audit:prune`, `runAuditRetention`, the Bun server and the Worker all
  default to 400 audit days.
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
- Backfill fetches CAIXA batches outside SQLite write transactions. Keep network
  waits outside the writer lock and preserve resumability on upstream failures. `db:pull`
  follows the same rule: it downloads the range first and only then opens the write
  transaction, and `--allow-partial` refuses an interior gap in the stored sequence
  (a missing newest contest is the only accepted hole).
- ChatGPT Search guidance is in `docs/CHATGPT-SEARCH.md`. Preserve the existing
  crawler/training preference and absence of acquisition analytics; eligibility,
  genuine crawler access, citations and reader traffic need separate evidence.
- **Mega da Virada identification** lives in `lib/analytics/mega-da-virada.ts`:
  the editions already stored (2009–2025) are listed, and new ones are recognised
  from `special_draw` on a year-end contest ending in 0 or 5. `special_draw` comes
  from CAIXA's `indicadorConcursoEspecial` = 2, which also marks non-Virada specials
  (contest 3010, Mega 30 Anos), exists only from 2017, and was stored as 0 before
  v1.16.0; never treat the flag alone as "Virada".
- **Optimized-mode budget is capped** at `BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET`
  (R$ 20.000) and the client mirrors that ceiling per selected mode. Every other mode is
  bounded by `MAX_BUDGET`; the API zod schema and the form read the same constants.
- **Required prod secrets (names only):** `IP_HASH_SECRET` (≥32 chars; server exits if
  missing in production — pseudonymizes IPs via HMAC-SHA256, `lib/security/`).
  Playwright/E2E injects an explicit public test-only `IP_HASH_SECRET`; production never autogenerates it.
- **LGPD:** changes to collection/retention/purpose must sync `docs/PRIVACY.md`,
  `docs/LGPD-COMPLIANCE.md`, `lib/i18n.ts`, and the storage-disclosure banner
  (`components/storage-disclosure.tsx` must list every `localStorage` key).
- Use semantic design tokens only (`bg-background`, `text-foreground`) — no hardcoded
  color classes. Edit the design system (`app/globals.css`, `tailwind.config.cjs`)
  before components. `lang="pt-BR"` in `app/layout.tsx`.
- **`--primary` and `--destructive` are dual-purpose tokens**: each is used as a
  surface (`bg-*` with its `-foreground`) *and* as text (`text-primary` in links and
  ranked figures, `text-destructive` in form errors). Those two uses pull contrast in opposite
  directions, so changing lightness to fix one silently breaks the other. Check both
  against 4.5:1 before touching them, and prefer adjusting the paired `-foreground`
  over flattening the hue.
- **Lighthouse:** the production build scores 95/100/100/100 served directly. Through
  Cloudflare the same build measures 61/96/81/100 because JavaScript Detections
  injects `/cdn-cgi/challenge-platform/.../main.js` (~4.3s of scripting versus 0.2s
  for all app JavaScript, plus three deprecated APIs). Measure against a local
  production server before concluding the app regressed.

## Deployment

Production deploys are manual through `cf`, with separate staging and production
targets. Keep custom-domain bindings on subsequent builds and verify public
version, data, CSP and Argent behavior after deployment. See `docs/DEPLOY.md`.

Legacy Docker recovery path: manual (not auto-deploy). Docker runtime image is **runtime-only** — build locally,
run `bun run dist:standalone`, ship `dist/standalone/`. Reverse proxy Traefik v3
(Coolify), CDN Cloudflare; container `megasena-analyzer`; prod
`https://megasena-analyzer.com.br`. After deploy, `bun run deploy:verify` must pass
against public `/api/health` (stale version = not deployed). Staging requires an
explicit reachable target — never inferred from the prod alias. Full workflow in
`docs/DEPLOY.md`. Deployment scripts and server access live in a separate private
deployment repository. The legacy production and staging environments used
**Coolify Services**: recovery release = build the image with a new tag on the
VPS, set that tag in the service's working-copy compose, and apply it with the VPS
update script, which waits for the container to be healthy; rollback = restore the
previous tag and apply again. The old `deploy.sh` cutover (`docker compose` in the
pre-Coolify directory, fixed container names) no longer applies and its `--with-db`
refresh needs porting before use. Never scp a live SQLite file; snapshot with
`VACUUM INTO` inside the running container.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
