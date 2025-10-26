# syntax=docker/dockerfile:1.4

# ============================================================================
# Stage 1: Production Dependencies
# Install only production dependencies for final runtime image
# ============================================================================
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install production dependencies only
# --frozen-lockfile ensures reproducible builds
RUN bun install --frozen-lockfile --production

# ============================================================================
# Stage 2: Builder
# Build the Next.js application with ALL dependencies
# ============================================================================
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install ALL dependencies (including devDependencies) for build
# Build tools like autoprefixer, tailwindcss, typescript are needed here
RUN bun install --frozen-lockfile

# Copy application source
COPY . .

# Build Next.js application
# This creates the optimized production bundle in .next/
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Bundle the API server into a standalone file with all dependencies resolved
# This eliminates path alias resolution issues at runtime
RUN bun build server.ts --compile --outfile server-bundle --target bun

# ============================================================================
# Stage 3: Runner
# Minimal production runtime image
# ============================================================================
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Install dumb-init for proper signal handling (SIGTERM, SIGINT)
# This ensures graceful shutdowns in container orchestration
RUN apk add --no-cache dumb-init

# Create non-root user for security
# Running as non-root is a Docker security best practice
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy only necessary files from builder
# This keeps the final image small (~200-250MB)
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js

# Copy TypeScript config for Bun path alias resolution
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy bundled API server (standalone executable with all dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/server-bundle ./server-bundle

# Copy server and library files (needed for Next.js)
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/components ./components
COPY --from=builder --chown=nextjs:nodejs /app/app ./app

# Copy database migrations (schema setup)
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations

# Copy startup script
COPY --from=builder --chown=nextjs:nodejs /app/scripts/start-docker.ts ./scripts/start-docker.ts

# Create database directory with proper permissions
# Database file will be created here on first run
RUN mkdir -p /app/db /app/logs && \
    chown -R nextjs:nodejs /app/db /app/logs

# Switch to non-root user
USER nextjs

# Expose ports
# 80: Next.js application (production uses 80 for Traefik compatibility)
# 3201: Bun API server
EXPOSE 80 3201

# Environment variables with defaults
# These can be overridden in docker-compose.yml or at runtime
ENV NODE_ENV=production \
    PORT=80 \
    API_PORT=3201 \
    API_HOST=localhost \
    DATABASE_PATH=/app/db/mega-sena.db \
    NEXT_TELEMETRY_DISABLED=1

# Health check
# Verifies API server is responding correctly
# Docker/Kubernetes use this to determine container health
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun -e 'fetch("http://localhost:3201/api/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Use dumb-init to handle signals properly
# This ensures SIGTERM is forwarded to our processes for graceful shutdown
ENTRYPOINT ["dumb-init", "--"]

# Start both Next.js and API server
CMD ["bun", "run", "scripts/start-docker.ts"]
