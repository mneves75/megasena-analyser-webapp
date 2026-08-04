# syntax=docker/dockerfile:1.4

# ============================================================================
# Mega-Sena Analyzer - Production Dockerfile (Runtime-Only)
# Pre-build locally, then copy artifacts to avoid QEMU/AVX issues
# ============================================================================
#
# USAGE:
#   1. Build Next.js:           bun run build
#   2. Preparar dist/standalone: bun run dist:standalone
#   3. Build image:             docker build -t megasena-analyser .
# ============================================================================

# node:22-alpine — digest verified 2026-07-28 via `docker buildx imagetools inspect`.
# Keep the comment on its own line: Docker has no inline comments, so a trailing
# `# ...` after AS makes the parser see five arguments and reject the FROM.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS deps

WORKDIR /deps

# pnpm gerencia dependências (nodeLinker: hoisted gera node_modules plano,
# copiável para a imagem de runtime Bun). corepack respeita packageManager.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Canary runtime pinned by immutable image digest. The matching Bun revision lives in
# .bun-canary-revision; update both together when intentionally bumping canary.
# Digest verified: 2026-07-28 / 1.4.0-canary.1+6c12afd8e
FROM oven/bun:canary-alpine@sha256:1b10d05749adb6d5835e7584c0c5099384417d4329a35f9721eaabc9d4ea6e00 AS runtime

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Runtime state must be writable by the non-root Bun user; application code stays
# root-owned so a compromised process cannot persist by rewriting it.
RUN mkdir -p /app/db /app/logs && chown bun:bun /app/db /app/logs

# Copy pre-built Next.js standalone output
# NOTE: Gere `dist/standalone/` com `bun run dist:standalone` antes do build da imagem
COPY dist/standalone ./
COPY public ./public

# Copy API server source and dependencies (runs with Bun at runtime)
COPY server.ts ./server.ts
COPY lib ./lib
COPY package.json ./package.json
COPY pnpm-lock.yaml ./pnpm-lock.yaml
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY patches ./patches
COPY bunfig.toml ./bunfig.toml
COPY tsconfig.json ./tsconfig.json

# Copy production dependencies installed inside the Linux image build.
COPY --from=deps /deps/node_modules ./node_modules

# Copy database migrations to BOTH locations:
# 1. /app/db/migrations - will be overwritten by volume mount (for fallback)
# 2. /app/migrations-source - backup that won't be overwritten
COPY db/migrations ./db/migrations
COPY db/migrations ./migrations-source

# Environment variables with defaults
ENV NODE_ENV=production \
    PORT=80 \
    API_PORT=3201 \
    API_HOST=localhost \
    DATABASE_PATH=/app/db/mega-sena.db \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

# Expose ports
# 80: Next.js application
# 3201: Bun API server
EXPOSE 80 3201

# Health check using curl (alpine has curl available)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3201/api/health || exit 1

# Copy startup script
COPY scripts/start-docker.ts ./scripts/start-docker.ts
COPY scripts/check-production-freshness.ts ./scripts/check-production-freshness.ts
COPY scripts/check-edge-csp.ts ./scripts/check-edge-csp.ts
# Operational data repair: re-hydrates prize columns on an already-populated
# volume. Must run inside the container because the database lives in the volume,
# not in the repository.
COPY scripts/backfill-prizes.ts ./scripts/backfill-prizes.ts
COPY scripts/cli-args.ts ./scripts/cli-args.ts

# Next.js writes optimized images and fetch-cache entries here at runtime.
RUN mkdir -p /app/.next/cache && chown bun:bun /app/.next/cache

USER bun

# Start both servers using Bun. `bunfig.toml` enables noOrphans so nested Bun
# processes exit if their parent process is killed.
CMD ["bun", "scripts/start-docker.ts"]
