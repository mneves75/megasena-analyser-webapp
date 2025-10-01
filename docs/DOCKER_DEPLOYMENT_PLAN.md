# Docker Deployment Plan & Code Review
**Date:** 2025-10-01
**Status:** Planning Phase
**Reviewer:** Claude Code (Fresh Eyes Review)

---

## Executive Summary

### Docker Deployment Recommendation: ✅ **YES - HIGHLY RECOMMENDED**

**Key Benefits:**
1. **Consistency**: Identical environment across dev/staging/production
2. **Portability**: Easy migration between hosting providers
3. **Simplified Onboarding**: New developers can run `docker compose up`
4. **CI/CD Integration**: Automated builds and deployments
5. **Isolation**: Containerized dependencies prevent conflicts
6. **Rollback**: Version-tagged images enable instant rollbacks

**Current Deployment:**
- ✅ Working well with PM2 + Caddy on VPS
- ✅ Simple architecture (SQLite + Bun + Next.js)
- ⚠️  Manual deployment process via rsync
- ⚠️  Environment inconsistencies between dev/prod

**Recommendation:** Implement Docker as **primary deployment method** while keeping PM2 as fallback option.

---

## Fresh Eyes Code Review - Critical Issues Found

### 🔴 **CRITICAL ISSUES**

#### 1. Production API Rewrite Configuration Bug
**Location:** `next.config.js:14`
```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3201/api/:path*', // ❌ HARDCODED localhost
    },
  ];
}
```

**Problem:** Hardcoded `localhost` won't work correctly in:
- Docker containers (API server has different hostname)
- Production VPS (if processes run on different hosts)
- Distributed deployments

**Impact:** API calls may fail in production or containerized environments

**Solution:**
```javascript
async rewrites() {
  const apiHost = process.env.API_HOST || 'localhost';
  const apiPort = process.env.API_PORT || '3201';

  return [
    {
      source: '/api/:path*',
      destination: `http://${apiHost}:${apiPort}/api/:path*`,
    },
  ];
}
```

---

#### 2. ESLint Error - Unused Function
**Location:** `lib/db.ts:371`
```typescript
async function importBunSqlite() { // ❌ Defined but never used
  // ...
}
```

**Problem:** Fails linting with `--max-warnings=0` flag

**Impact:** Breaks CI/CD pipeline and pre-commit hooks

**Solution:** Remove the function or mark it as used/implement it properly

---

### ⚠️  **MEDIUM PRIORITY ISSUES**

#### 3. No CORS Configuration in Bun API Server
**Location:** `server.ts`

**Problem:** API server doesn't set CORS headers, which may cause issues if:
- API is accessed from different origins
- Future mobile apps or external clients need access

**Impact:** Cross-origin requests will fail

**Solution:** Add CORS middleware:
```typescript
// Add to server.ts
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN?.split(',') || [
  'http://localhost:3000',
  'https://conhecendotudo.online',
];

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
  }
  return {};
}
```

---

#### 4. Database Initialization Uses Synchronous require()
**Location:** `lib/db.ts:393-409`

**Problem:** Uses `require('bun:sqlite')` instead of async import

**Impact:** Blocks event loop during initialization

**Solution:** Use async import consistently:
```typescript
async function initializeDatabase(): Promise<BunDatabase> {
  const { Database } = await import('bun:sqlite');
  const database = new Database(DB_PATH) as BunDatabase;
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}
```

---

#### 5. Limited Test Coverage
**Current Coverage:**
- Only 2 test files: `tests/lib/bet-generator.test.ts` and `tests/lib/analytics/statistics.test.ts`
- No E2E tests with Playwright (mentioned in CLAUDE.md but not implemented)
- No API endpoint tests
- No integration tests

**Recommendation:**
- Add tests for all analytics engines
- Add API endpoint tests (health, dashboard, generate-bets)
- Implement Playwright E2E tests for critical user flows
- Target ≥80% code coverage (as per project requirements)

---

#### 6. No Automated Database Backups
**Location:** Mentioned in `docs/DEPLOY_VPS/DEPLOY.md:344` but not implemented

**Problem:** Manual backup process is error-prone

**Solution:** Create automated backup script (see Implementation Plan below)

---

#### 7. Next.js 16 Migration Warning
**Issue:** `next lint` is deprecated in Next.js 16

**Solution:** Migrate to ESLint CLI using codemod:
```bash
bunx @next/codemod@canary next-lint-to-eslint-cli .
```

---

### ✅ **GOOD PRACTICES FOUND**

1. ✅ **Excellent CHANGELOG.md** - Well-maintained with semantic versioning
2. ✅ **Security baseline** - `.secrets.baseline` exists for secret scanning
3. ✅ **Comprehensive .gitignore** - Properly excludes secrets, databases, SSH keys
4. ✅ **Rate limiting** - Implemented in `server.ts` (100 req/min)
5. ✅ **Health check endpoint** - `/api/health` with database connectivity check
6. ✅ **Semantic design tokens** - No hardcoded colors in components
7. ✅ **TypeScript strict mode** - Enforced in project
8. ✅ **Bun-native SQLite** - No compilation issues with native modules
9. ✅ **Exponential backoff** - Implemented for CAIXA API calls
10. ✅ **Database migrations** - Versioned SQL files with tracking

---

## Docker Implementation Plan

### Phase 1: Core Docker Setup (Priority: HIGH)

#### 1.1 Create Multi-Stage Dockerfile

**File:** `Dockerfile`

```dockerfile
# Stage 1: Dependencies
FROM oven/bun:1.2-alpine AS deps
WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Stage 2: Builder
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
RUN bun run build

# Stage 3: Runner
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Create database directory
RUN mkdir -p /app/db && chown -R nextjs:nodejs /app/db

# Switch to non-root user
USER nextjs

# Expose ports
EXPOSE 3000 3201

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start both servers (using a simple startup script)
CMD ["bun", "run", "scripts/start-docker.ts"]
```

**★ Insight ─────────────────────────────────────**
1. **Multi-stage builds** reduce final image size by ~70% by excluding build dependencies
2. **Alpine base image** (oven/bun:1.2-alpine) is only ~90MB vs ~200MB for Debian-based
3. **dumb-init** ensures proper signal handling (SIGTERM) for graceful shutdowns in Kubernetes/Docker
─────────────────────────────────────────────────

---

#### 1.2 Create Docker Compose Configuration

**File:** `docker-compose.yml`

```yaml
version: '3.9'

services:
  # Development setup - runs both Next.js and API server
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: megasena-analyser
    ports:
      - "3000:3000"  # Next.js
      - "3201:3201"  # Bun API
    environment:
      - NODE_ENV=production
      - PORT=3000
      - API_PORT=3201
      - API_HOST=localhost  # Within container
      - DATABASE_PATH=/app/db/mega-sena.db
      - NEXT_PUBLIC_BASE_URL=http://localhost:3000
    volumes:
      # Persist SQLite database
      - ./db:/app/db
      # Optional: mount logs
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3201/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Caddy reverse proxy (optional for local testing)
  caddy:
    image: caddy:2-alpine
    container_name: megasena-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile.local:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    restart: unless-stopped
    profiles:
      - with-proxy  # Only start with: docker compose --profile with-proxy up

volumes:
  caddy_data:
  caddy_config:
```

**File:** `docker-compose.prod.yml` (Production overrides)

```yaml
version: '3.9'

services:
  app:
    image: ghcr.io/yourusername/megasena-analyser:latest
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_BASE_URL=https://conhecendotudo.online/megasena-analyzer
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
```

---

#### 1.3 Create Docker Startup Script

**File:** `scripts/start-docker.ts`

```typescript
#!/usr/bin/env bun
/**
 * Docker startup script - runs both API server and Next.js
 * Handles graceful shutdown and health checks
 */

import { spawn } from 'bun';
import { logger } from '../lib/logger';

let apiServer: ReturnType<typeof spawn> | null = null;
let nextServer: ReturnType<typeof spawn> | null = null;

async function startServers() {
  logger.info('🐳 Starting services in Docker container...');

  // Start Bun API server
  logger.info('Starting Bun API server on port 3201...');
  apiServer = spawn(['bun', 'server.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, API_PORT: '3201' },
  });

  // Wait for API to be ready
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Start Next.js server
  logger.info('Starting Next.js server on port 3000...');
  nextServer = spawn(['bun', 'run', 'start', '--', '--port', '3000'], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, PORT: '3000' },
  });

  logger.info('✓ All services started');
}

// Graceful shutdown handler
async function shutdown(signal: string) {
  logger.info(`\n📦 Received ${signal}, shutting down gracefully...`);

  if (apiServer) {
    logger.info('Stopping API server...');
    apiServer.kill();
  }

  if (nextServer) {
    logger.info('Stopping Next.js server...');
    nextServer.kill();
  }

  logger.info('✓ Shutdown complete');
  process.exit(0);
}

// Register signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
  shutdown('UNHANDLED_REJECTION');
});

// Start servers
await startServers();

// Keep process alive
await Promise.all([
  apiServer?.exited || Promise.resolve(),
  nextServer?.exited || Promise.resolve(),
]);
```

---

### Phase 2: CI/CD Pipeline (Priority: HIGH)

#### 2.1 GitHub Actions Workflow

**File:** `.github/workflows/ci-cd.yml`

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Job 1: Linting and Type Checking
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: '1.2.23'

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run linter
        run: bun run lint

      - name: Type check
        run: bun run build --dry-run || bun x tsc --noEmit

  # Job 2: Unit Tests
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: '1.2.23'

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun run test -- --run --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  # Job 3: Build Docker Image
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [lint, test]
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 4: Deploy to Production (only on main branch)
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      url: https://conhecendotudo.online/megasena-analyzer
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/claude/apps/megasena-analyser

            # Pull latest image
            docker compose -f docker-compose.prod.yml pull

            # Restart services with zero-downtime
            docker compose -f docker-compose.prod.yml up -d --remove-orphans

            # Clean up old images
            docker image prune -af --filter "until=72h"

            # Health check
            sleep 10
            curl -f http://localhost:3201/api/health || exit 1
```

**★ Insight ─────────────────────────────────────**
1. **Matrix builds** enable testing across multiple Bun versions simultaneously
2. **GitHub Container Registry** (ghcr.io) is free for public repos and integrates seamlessly
3. **Multi-stage caching** (cache-from/cache-to) speeds up builds by ~80% after first run
─────────────────────────────────────────────────

---

### Phase 3: Database Backup Automation (Priority: MEDIUM)

#### 3.1 Automated Backup Script

**File:** `scripts/backup-database.ts`

```typescript
#!/usr/bin/env bun
/**
 * Automated SQLite database backup script
 * Creates timestamped backups with retention policy
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';

const DB_PATH = path.join(process.cwd(), 'db', 'mega-sena.db');
const BACKUP_DIR = path.join(process.cwd(), 'db', 'backups');
const RETENTION_DAYS = 30; // Keep backups for 30 days
const MAX_BACKUPS = 50; // Maximum number of backups to retain

async function createBackup() {
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      logger.info('Created backup directory');
    }

    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      logger.error('Database file not found');
      process.exit(1);
    }

    // Create timestamped backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `mega-sena-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Copy database file
    logger.info(`Creating backup: ${backupFilename}`);
    await Bun.write(backupPath, Bun.file(DB_PATH));

    // Get file size
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    logger.info(`✓ Backup created successfully (${sizeMB} MB)`);

    // Cleanup old backups
    await cleanupOldBackups();

    return backupPath;
  } catch (error) {
    logger.error('Backup failed', error);
    throw error;
  }
}

async function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('mega-sena-backup-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        mtime: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Remove backups older than retention period
    const cutoffDate = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const file of files) {
      const shouldRemove = file.mtime < cutoffDate || files.indexOf(file) >= MAX_BACKUPS;

      if (shouldRemove) {
        fs.unlinkSync(file.path);
        removedCount++;
        logger.info(`Removed old backup: ${file.name}`);
      }
    }

    if (removedCount > 0) {
      logger.info(`✓ Cleaned up ${removedCount} old backup(s)`);
    }

    logger.info(`Total backups: ${files.length - removedCount}`);
  } catch (error) {
    logger.error('Cleanup failed', error);
  }
}

// Run backup
logger.info('🗄️  Database Backup Utility');
await createBackup();
logger.info('✓ Backup complete');
```

**Cron Configuration (VPS):**
```bash
# Add to crontab: crontab -e
# Backup database daily at 3 AM
0 3 * * * cd /home/claude/apps/megasena-analyser && /home/claude/.bun/bin/bun run scripts/backup-database.ts >> logs/backup.log 2>&1
```

**Docker Volume Backup:**
```bash
#!/bin/bash
# scripts/backup-docker-volume.sh
docker run --rm \
  -v megasena-analyser_db:/data \
  -v $(pwd)/db/backups:/backup \
  alpine tar czf /backup/db-volume-$(date +%Y%m%d-%H%M%S).tar.gz /data
```

---

### Phase 4: Configuration Fixes (Priority: HIGH)

#### 4.1 Fix next.config.js

**File:** `next.config.js` (updated)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/megasena-analyzer',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async rewrites() {
    // Use environment variable for API host (supports Docker and VPS deployments)
    const apiHost = process.env.API_HOST || 'localhost';
    const apiPort = process.env.API_PORT || '3201';

    return [
      {
        source: '/api/:path*',
        destination: `http://${apiHost}:${apiPort}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
```

**Update `.env.example`:**
```bash
# Next.js base URL used by app router data fetching
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# API server configuration
API_PORT=3201
API_HOST=localhost  # Use 'localhost' for Docker, or specific IP for distributed setup

# Optional: restrict cross-origin requests when enabling CORS in server.ts
ALLOWED_ORIGIN=http://localhost:3000,https://conhecendotudo.online
```

---

#### 4.2 Fix linting error in lib/db.ts

Remove or implement the unused `importBunSqlite` function.

---

### Phase 5: Documentation Updates

#### 5.1 Docker Deployment Guide

**File:** `docs/DEPLOY_VPS/DEPLOY_DOCKER.md`

Create comprehensive Docker deployment documentation including:
- Prerequisites (Docker, Docker Compose)
- Build instructions
- Environment variable configuration
- Volume management for SQLite persistence
- Backup and restore procedures
- Troubleshooting common issues
- Migration from PM2 to Docker

---

## Implementation Timeline

### Week 1: Core Docker Setup
- [ ] Day 1-2: Create Dockerfile and docker-compose.yml
- [ ] Day 3: Create startup script and test locally
- [ ] Day 4: Fix configuration issues (next.config.js, linting)
- [ ] Day 5: Test Docker deployment end-to-end

### Week 2: CI/CD & Automation
- [ ] Day 1-2: Set up GitHub Actions workflow
- [ ] Day 3: Implement automated database backups
- [ ] Day 4: Add CORS configuration to API server
- [ ] Day 5: Documentation and testing

### Week 3: Testing & Migration
- [ ] Day 1-2: Expand test coverage
- [ ] Day 3: Deploy to staging environment
- [ ] Day 4: Production deployment with Docker
- [ ] Day 5: Monitor and optimize

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SQLite volume corruption in Docker | HIGH | LOW | Daily automated backups + volume snapshots |
| Container fails to start | MEDIUM | MEDIUM | Health checks + auto-restart + PM2 fallback |
| Image build fails in CI | MEDIUM | LOW | Local build testing + cached layers |
| Performance degradation | MEDIUM | LOW | Resource limits + monitoring |
| Migration downtime | HIGH | LOW | Blue-green deployment strategy |

---

## Success Metrics

- ✅ Build time < 3 minutes in CI
- ✅ Image size < 300 MB (compressed)
- ✅ Container startup < 30 seconds
- ✅ Zero-downtime deployments
- ✅ Test coverage ≥ 80%
- ✅ Automated daily backups
- ✅ Health check endpoint responding

---

## Rollback Plan

If Docker deployment fails:
1. Stop Docker containers: `docker compose down`
2. Restore database from backup
3. Revert to PM2 deployment: `pm2 restart ecosystem.config.js`
4. Verify application health
5. Investigate Docker issues in staging

---

## Next Steps

1. **Review this plan** with the team
2. **Create feature branch**: `git checkout -b feature/docker-deployment`
3. **Start with Phase 1**: Docker configuration files
4. **Test locally** before committing
5. **Submit PR** for review

---

## Appendix A: Useful Docker Commands

```bash
# Build and run locally
docker compose up --build

# Run in production mode
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f app

# Execute commands in container
docker compose exec app bun run db:migrate

# Backup database from running container
docker compose exec app bun run scripts/backup-database.ts

# Stop and remove containers
docker compose down

# Remove volumes (⚠️ DESTRUCTIVE)
docker compose down -v

# Prune old images
docker image prune -af
```

---

## Appendix B: Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `PORT` | `3000` | Next.js server port |
| `API_PORT` | `3201` | Bun API server port |
| `API_HOST` | `localhost` | API server hostname |
| `DATABASE_PATH` | `/app/db/mega-sena.db` | SQLite database path |
| `NEXT_PUBLIC_BASE_URL` | - | Public URL for SSR |
| `ALLOWED_ORIGIN` | - | CORS allowed origins (comma-separated) |

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Author:** Claude Code
**Status:** Ready for Implementation
