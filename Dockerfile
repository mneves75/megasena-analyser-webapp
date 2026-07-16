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

FROM node:22-alpine AS deps

WORKDIR /deps

# pnpm gerencia dependências (nodeLinker: hoisted gera node_modules plano,
# copiável para a imagem de runtime Bun). corepack respeita packageManager.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

FROM oven/bun:1.3.14-alpine AS runtime

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Runtime state must be writable by the non-root Bun user.
RUN mkdir -p /app/db /app/logs && chown -R bun:bun /app

# Copy pre-built Next.js standalone output
# NOTE: Gere `dist/standalone/` com `bun run dist:standalone` antes do build da imagem
COPY --chown=bun:bun dist/standalone ./
COPY --chown=bun:bun public ./public

# Copy API server source and dependencies (runs with Bun at runtime)
COPY --chown=bun:bun server.ts ./server.ts
COPY --chown=bun:bun lib ./lib
COPY --chown=bun:bun package.json ./package.json
COPY --chown=bun:bun pnpm-lock.yaml ./pnpm-lock.yaml
COPY --chown=bun:bun pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=bun:bun bunfig.toml ./bunfig.toml
COPY --chown=bun:bun tsconfig.json ./tsconfig.json

# Copy production dependencies installed inside the Linux image build.
COPY --from=deps --chown=bun:bun /deps/node_modules ./node_modules

# Copy database migrations to BOTH locations:
# 1. /app/db/migrations - will be overwritten by volume mount (for fallback)
# 2. /app/migrations-source - backup that won't be overwritten
COPY --chown=bun:bun db/migrations ./db/migrations
COPY --chown=bun:bun db/migrations ./migrations-source

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
COPY --chown=bun:bun scripts/start-docker.ts ./scripts/start-docker.ts
COPY --chown=bun:bun scripts/check-production-freshness.ts ./scripts/check-production-freshness.ts
COPY --chown=bun:bun scripts/check-edge-csp.ts ./scripts/check-edge-csp.ts

USER bun

# Start both servers using Bun. `bunfig.toml` enables noOrphans so nested Bun
# processes exit if their parent process is killed.
CMD ["bun", "scripts/start-docker.ts"]
