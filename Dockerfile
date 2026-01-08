# syntax=docker/dockerfile:1.4

# ============================================================================
# Mega-Sena Analyzer - Production Dockerfile (Runtime-Only)
# Pre-build locally, then copy artifacts to avoid QEMU/AVX issues
# ============================================================================
#
# USAGE:
#   1. Build Next.js:  bun --bun next build
#   2. Build image:    docker build -t megasena-analyser .
# ============================================================================

FROM oven/bun:1.3.4-alpine AS runtime

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy pre-built Next.js standalone output
# NOTE: Must run ./deploy.sh which builds and copies to dist/standalone/
COPY dist/standalone ./
COPY public ./public

# Copy API server source and dependencies (runs with Bun at runtime)
COPY server.ts ./server.ts
COPY lib ./lib
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json

# Copy node_modules for API server dependencies (zod, etc.)
# These are pure JS and cross-platform compatible
COPY node_modules ./node_modules

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
COPY scripts/start-docker.ts ./start-docker.ts

# Start both servers using Bun
# Bun handles SIGTERM/SIGINT natively - no dumb-init required
CMD ["bun", "start-docker.ts"]
