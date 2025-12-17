# syntax=docker/dockerfile:1.4

# ============================================================================
# Mega-Sena Analyzer - Production Dockerfile
# Uses Bun runtime throughout with distroless base image
# ============================================================================

# ============================================================================
# Stage 1: Builder
# Build the Next.js application and compile bundles for glibc (distroless)
# IMPORTANT: Must use Debian-based image (glibc) for bundle compatibility
# ============================================================================
FROM oven/bun:1.3.4-debian AS builder
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install ALL dependencies (including devDependencies) for build
RUN bun install --frozen-lockfile

# Copy application source
COPY . .

# Build Next.js with Bun runtime (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun --bun next build

# Bundle the API server into a standalone executable
RUN bun build server.ts --compile --outfile server-bundle --target bun

# Bundle the startup script for distroless
RUN bun build scripts/start-docker-distroless.ts --compile --outfile start-bundle --target bun

# ============================================================================
# Stage 2: Production Runner (Distroless)
# Minimal production runtime image - no shell, no package manager
# ============================================================================
FROM oven/bun:1.3.4-distroless AS runner
WORKDIR /app

# Copy Next.js standalone build
# NOTE: Next.js 16 outputs directly to .next/standalone/ (not nested)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy bundled executables (no runtime dependencies needed)
COPY --from=builder /app/server-bundle ./server-bundle
COPY --from=builder /app/start-bundle ./start-bundle

# Copy database migrations (schema setup)
COPY --from=builder /app/db/migrations ./db/migrations

# Environment variables with defaults
# These can be overridden in docker-compose.yml or at runtime
ENV NODE_ENV=production \
    PORT=80 \
    API_PORT=3201 \
    API_HOST=localhost \
    DATABASE_PATH=/app/db/mega-sena.db \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0

# Expose ports
# 80: Next.js application (production uses 80 for reverse proxy compatibility)
# 3201: Bun API server
EXPOSE 80 3201

# Health check using Bun (no shell available in distroless)
# Verifies API server is responding correctly
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["bun", "-e", "fetch('http://localhost:3201/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]

# Start using pre-compiled startup bundle
# Bun handles SIGTERM/SIGINT natively - no dumb-init required
ENTRYPOINT ["./start-bundle"]
