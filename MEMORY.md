# Mega-Sena Analyzer — Project Memory

## Active work

- `v1.10.0` prepared locally (full source review + fixes). Awaiting an explicit staging
  target and confirmation for production.
- Previous production deploy: `v1.9.0-beta.1`, 2026-07-28, host `conhecendotudo`.
  - Image: `megasena-analyser-app:v1.9.0-beta.1`
  - DB: 3,036 draws
  - Public health: `https://megasena-analyzer.com.br/api/health`
  - `deploy:verify` and `security:csp:edge` both passed.

## Key decisions & why

- **Missing historical prize data is a data problem, not a code problem.** The CAIXA API
  returns the full prize breakdown for every contest (verified against #100/#1500/#2500),
  but the historical bulk import predates the current `listaRateioPremio`/`faixa`
  handling, so only 10 of 3,036 draws had `prize_sena`. Fixed with
  `bun run db:backfill-prizes` (657 sena / 3,036 quina). A DB restored from an old
  snapshot will show `R$ 0,00` across the "Prêmios" section again until backfilled.
- **The bet-generator DP no longer carries bet count as a state dimension.** It is now
  minimized inside a `(coverage, cost)` state over typed arrays: ~106 MB → ~1 MB per
  request. The container limit is 384 MB, so the old shape let two concurrent
  max-budget requests OOM production.
- **Client-IP header trust is an ops contract.** `CF-Connecting-IP` is not rewritten by
  an intermediate Traefik/Nginx, so if the origin is reachable outside Cloudflare a
  forged value mints a fresh rate-limit bucket per request. Code-side mitigation:
  `TRUSTED_CLIENT_IP_HEADER` pins a single header. The real guarantee is operational
  (firewall/tunnel) and is written down in `docs/SECURITY.md`.
- `INTERNAL_API_SECRET` is now attached only to loopback targets, so `API_HOST` must stay
  loopback; pointing it at a container name silently drops SSR calls to the public quota.
- Trusted proxy headers enabled in production (`TRUST_PROXY_HEADERS=true`,
  `TRUSTED_PROXY_IPS=10.0.1.1`) so the app recognises HTTPS through Cloudflare/Traefik.
- Production compose loads secrets via `env_file: .env`; `IP_HASH_SECRET` stays out of
  the committed compose.

## Pitfalls hit

- `rsync` to the server stripped `dist/standalone/.next/` and `node_modules/` because
  global excludes overrode later includes; fixed by placing explicit
  `--include 'dist/standalone/.next/***'` **before** the global excludes.
- Replacing the DB while the container is running causes SQLite "readonly database"
  errors; the real cause was the host `db/` directory not writable by UID 1000. Fix:
  `chown -R ubuntu:ubuntu db logs` (ubuntu is UID/GID 1000, matching the `bun` user).
- The production `docker-compose.yml` was accidentally overwritten by the local dev
  compose during rsync; restored from the private deployment repo pattern.
- The Cloudflare edge **replaces** the app's `Permissions-Policy` with a smaller set
  (no `usb=()`, no `interest-cohort=()`) and is what adds HSTS to HTML responses —
  `proxy.ts` deliberately does not emit it. `security:csp:edge` still passes because the
  nonce CSP survives.
- Port 3000 is usually taken by another project on this machine. Verify the app in a
  **production** build on a free port: `PORT=3100 API_PORT=3210 bun run start`.
- `PRAGMA application_id` runs on every DB open, so `getDatabase()` throws
  `SQLITE_BUSY` while a long writer (backfill/pull) holds the lock.

## Next

- Define a reachable staging target (the repo forbids inferring staging from the
  production alias), then tag and deploy.
