# Deployment Audit & Corrected Plan
## VPS Hostinger — claude@212.85.2.24

**Date:** 2025-09-30
**Auditor:** Codex (Bun migration follow-up)
**Status:** 🟢 Critical Fixes Applied — Bun runtime + dual-process stack online

---

## 🔍 Executive Summary

All blocking issues identified in the earlier audit have been addressed. The Mega-Sena Analyser stack now runs as two managed services behind Caddy: a Next.js ISR server on port **3002** and a Bun API service (bun:sqlite) on port **3201**. Bun **v1.2.23** is installed under `~/.bun/bin`, PM2 supervises both processes, and Caddy proxies `/megasena-analyzer/*` to the Next.js service. Documentation was updated to match the Bun-first workflow.

Remaining operational task: populate the production SQLite database (CAIXA API currently returns `403 Forbidden`; retry with proper headers or during permitted windows).

---

## 📊 Server Environment Snapshot (2025-09-30 21:41 UTC)

| Component | Version / Status | Notes |
|-----------|------------------|-------|
| OS | Ubuntu 24.04.3 LTS | Shared VPS (Hostinger) |
| Node.js | v22.18.0 (`nvm`) | Required for PM2 CLI |
| Bun | v1.2.23 (`~/.bun/bin/bun`) | Provides `bun:sqlite` runtime |
| PM2 | 6.0.8 | Manages `megasena-analyser` + `megasena-api` |
| Reverse proxy | Caddy 2 | Handles HTTPS + path prefix `/megasena-analyzer` |
| Next.js | 15.5.4 | Served via `bun run start -- --port 3002` |
| API port | `localhost:3201` | Bun HTTP server defined in `server.ts` |
| SQLite | `db/mega-sena.db` (WAL) | ~48 KB (schema migrated, needs data seed) |

Active listeners (`ss -tulpn | grep -E '3002|3201'`):

```
tcp LISTEN 0 512 *:3201 *:* users:(('bun',pid=50948,fd=15))
tcp LISTEN 0 512 *:3002 *:* users:(('next-server (v1',pid=50933,fd=22))
```

PM2 process table (`pm2 status`):

```
┌────┬──────────────────────┬─────────────┬─────────┬─────────┬───────┬──────┬──────┬───────────┐
│ id │ name                 │ version     │ mode    │ pid     │ uptime│ ↺    │ status    │
├────┼──────────────────────┼─────────────┼─────────┼─────────┼───────┼──────┼───────────┤
│ 0  │ megasena-analyser    │ 1.0.0       │ fork    │ 50933   │ 00:00:24 │ 1 │ online │
│ 1  │ megasena-api         │ 1.0.0       │ fork    │ 50948   │ 00:00:24 │ 1 │ online │
└────┴──────────────────────┴─────────────┴─────────┴─────────┴───────┴──────┴───────────┘
```

---

## ✅ Resolved Issues (from initial audit)

| Original Bug | Resolution | Evidence |
|--------------|------------|----------|
| Port conflict (`APP_PORT=3001`) | Next.js now listens on **3002**; Bun API on **3201**; docs updated accordingly. | `ecosystem.config.js`, `ss -tulpn` |
| Bun missing on VPS | Installed via `curl https://bun.sh/install`; commands use `~/.bun/bin/bun`. | `bun --version` |
| NVM not sourced in remote scripts | Deployment commands explicitly run `source ~/.nvm/nvm.sh` before PM2 operations. | PM2 start/restart scripts |
| Heredoc variable interpolation | All deployment docs/scripts updated to use unquoted heredocs or explicit values. | `DEPLOY.md`, `ecosystem.config.js` |
| PM2 ecosystem literal env values | New config injects resolved env vars and supervises two processes. | `/home/claude/apps/megasena-analyser/ecosystem.config.js` |
| Caddy vs Nginx mismatch | Deployment docs now document Caddy reload + path proxy; Nginx references removed. | `DEPLOY.md` section 11 |
| SQLite migrations via Node | Runtime calls `require('bun:sqlite')` under Bun; migrations executed with `~/.bun/bin/bun run db:migrate`. | Logs `logs/api-out.log`, `db/` contents |

---

## 🧭 Current Deployment Topology

```
User HTTPS request
    ↓ Caddy (handle_path /megasena-analyzer*)
        ↓ reverse_proxy localhost:3002 (Next.js server)
            ↳ fetch /api/... → Next rewrites → localhost:3201 (Bun API)
                ↳ bun:sqlite → db/mega-sena.db (WAL mode)
```

Key files:
- `/home/claude/apps/megasena-analyser/ecosystem.config.js`
- `/home/claude/apps/megasena-analyser/.env.production`
- `/etc/caddy/Caddyfile`

---

## 📋 Validation Checklist

- [x] Bun 1.2.23 installed and on PATH for scripted commands (`~/.bun/bin/bun`).
- [x] Next.js build succeeds via `bun run build` (local + VPS).
- [x] `pm2 status` shows `megasena-analyser` + `megasena-api` online.
- [x] HTTPS endpoint `https://conhecendotudo.online/megasena-analyzer` returns HTTP 200.
- [x] API endpoint `/api/generate-bets` responds 200 with payload.
- [ ] Seed database with latest Mega-Sena draws (`bun run db:pull`) — **pending, CAIXA API 403**.

---

## 🛠️ Next Recommended Actions

1. **Database Seeding:** Retry `~/.bun/bin/bun run db:pull -- --limit 50` with appropriate CAIXA headers or during whitelisted times; confirm tables `draws` and `number_frequency` populated.
2. **Monitoring:** Add the provided healthcheck script to crontab (checks ports 3002 and 3201). Consider PM2 Server Monitor or external uptime alerts.
3. **Docs & Scripts:** Align any automation with the updated Bun-based instructions (`DEPLOY.md`, `DEPLOYMENT_SUCCESS.md`).
4. **Security:** Ensure `ufw` allows only 22/80/443 and keep Caddy logs rotated (`/var/log/caddy`).

---

## 📁 Artefacts Touched (2025-09-30)

- `/home/claude/apps/megasena-analyser/ecosystem.config.js`
- `/home/claude/apps/megasena-analyser/.env.production`
- `/etc/caddy/Caddyfile`
- PM2 dump (`~/.pm2/dump.pm2`)

---

The deployment is now Bun-native and production-ready, pending data seeding. Continuous monitoring and periodic CAIXA ingest remain the primary follow-up items.
