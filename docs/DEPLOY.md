# Deployment Guide

Mega-Sena Analyzer runs on a Hostinger VPS with Docker, Traefik reverse proxy, and Cloudflare CDN.

## Architecture

```
User -> Cloudflare (SSL/CDN) -> Traefik v3 (routing) -> Docker container
                                                          ├── Next.js (port 80, standalone)
                                                          └── Bun API server (port 3201)
```

## Domains

| Domain | Role |
|--------|------|
| `megasena-analyzer.com.br` | Primary (serves content) |
| `megasena-analyzer.com` | 301 redirect to .com.br |
| `megasena-analyzer.online` | 301 redirect to .com.br |
| `www.*` variants | 301 redirect to .com.br |

Redirects configured in Traefik dynamic config (`megasena-analyzer.yaml`).

## Prerequisites

- Bun >= 1.3.10 (local machine for building)
- Docker (on VPS)
- SSH access to VPS managed outside the repository (password manager / secret manager)

## Deploy Workflow

### 1. Build locally

```bash
bun install
bun run build
```

### 2. Create standalone artifacts

The Dockerfile is **runtime-only** -- it copies pre-built artifacts, not source code. You must create the standalone dist locally:

```bash
rm -rf dist/standalone
mkdir -p dist/standalone/.next
cp -r .next/standalone/* dist/standalone/
cp -r .next/standalone/.next/* dist/standalone/.next/
cp -r .next/static dist/standalone/.next/static
```

### 3. Create deploy archive

**macOS users:** Must disable resource forks to avoid `._*` files breaking migrations in Alpine Linux:

```bash
COPYFILE_DISABLE=1 tar czf /tmp/megasena-deploy.tar.gz --no-mac-metadata \
  dist/standalone/ public/ server.ts lib/ package.json tsconfig.json \
  scripts/start-docker.ts db/migrations/ Dockerfile
```

### 4. Upload to VPS

```bash
scp /tmp/megasena-deploy.tar.gz user@server:/path/to/compose/dir/
```

### 5. Build and deploy on VPS

```bash
cd /path/to/compose/dir
tar xzf megasena-deploy.tar.gz
bun install --production
docker build -t megasena-analyser-app:vX.Y.Z .
docker stop megasena-analyzer && docker rm megasena-analyzer
docker compose up -d
```

### 6. Verify

```bash
# Check container health
docker logs megasena-analyzer

# Should show:
# [OK] API server ready
# Ready in 0ms
# [OK] All services started successfully

# Test from outside
curl -I https://megasena-analyzer.com.br/
curl -I https://megasena-analyzer.com/  # Should 301
```

## Dockerfile

The Dockerfile (`Dockerfile`) is a runtime-only image based on `oven/bun:alpine`:

- Copies pre-built Next.js standalone output (`dist/standalone/`)
- Copies API server source (`server.ts`, `lib/`)
- Copies `node_modules/` for runtime dependencies
- Runs `start-docker.ts` which starts both Next.js and the Bun API server
- Health check: `curl http://localhost:3201/api/health`

**Why runtime-only?** Building Next.js inside Docker fails because `bun:sqlite` cannot resolve in the Next.js client component bundler during build. Building locally avoids this.

## docker-compose.yml

Key configuration:

- `image: megasena-analyser-app:vX.Y.Z` (pre-built image)
- Exposes port 80 (Traefik routes to it)
- Volumes: `./db:/app/db` (persists SQLite), `./logs:/app/logs`
- Network: `coolify` (external, shared with Traefik)
- Environment: `NEXT_PUBLIC_BASE_URL=https://megasena-analyzer.com.br`

## Traefik Configuration

Located at `/data/coolify/proxy/dynamic/megasena-analyzer.yaml` on VPS.

Three routers:
1. `megasena-http` -- HTTP to HTTPS redirect (all domains)
2. `megasena-https` -- Serves content (primary domain only)
3. `megasena-redirect` -- 301 redirect (secondary domains to primary)

Middlewares:
- `megasena-rate-limit` -- 5 req/s average, 10 burst (uses `Cf-Connecting-Ip`)
- `megasena-redirect-to-primary` -- regex redirect preserving path
- `security-headers` -- shared security headers middleware

## Database Updates

Use your standard secret-management workflow for VPS access details. General workflow:

1. Copy DB from server
2. Pull new draws: `bun scripts/pull-draws.ts --incremental`
3. Optimize: `bun scripts/optimize-db.ts`
4. Upload DB back and restart container

## Troubleshooting

### Container crash-loops with "Could not find a production build"

The `.next/` directory inside `dist/standalone/` is incomplete. Rebuild locally:

```bash
rm -rf dist/standalone
# Follow step 2 above -- make sure to copy .next/standalone/.next/* (BUILD_ID, manifests)
```

### Migration errors with `._001_initial_schema.sql`

macOS resource fork files leaked into the archive. Re-create with `COPYFILE_DISABLE=1` and `--no-mac-metadata`.

### API health check fails (ConnectionRefused)

The Bun API server on port 3201 didn't start. Check:
- Database file exists at `/app/db/mega-sena.db`
- Volume mount is correct in docker-compose.yml
- Migration files are valid SQL (not binary `._*` files)

### Cloudflare caching stale responses

Add `?cb=timestamp` to bypass cache during testing. For persistent issues, purge cache in Cloudflare dashboard.
