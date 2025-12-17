# Bun Full Runtime Migration Plan

## Executive Summary

Migrate from Bun-as-package-manager to Bun-as-full-runtime, using `--bun` flag for Next.js execution and `oven/bun:1.3.4-distroless` for production Docker images.

**Current State:**
- Bun used for package management and script execution
- Next.js internally uses Node.js runtime (no `--bun` flag)
- Docker: `oven/bun:1.2-alpine` (Alpine-based, ~200-250MB)
- API server: Runs on pure Bun runtime (correct)

**Target State:**
- Full Bun runtime for both Next.js and API server
- Docker: `oven/bun:1.3.4-distroless` (~90-120MB, minimal attack surface)
- Unified runtime environment across development and production

---

## Phase 1: Package.json Script Updates

### 1.1 Update Development Scripts

**File:** `package.json`

```json
{
  "scripts": {
    "dev": "bun run scripts/dev.ts",
    "dev:next-only": "bun --bun next dev",
    "build": "bun --bun next build",
    "start": "bun --bun next start",
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "test": "vitest",
    "db:migrate": "bun run scripts/migrate.ts",
    "db:pull": "bun run scripts/pull-draws.ts"
  }
}
```

**Critical Changes:**
- `build`: `next build` -> `bun --bun next build`
- `start`: `next start` -> `bun --bun next start`
- `dev:next-only`: `next dev` -> `bun --bun next dev`

**Why `--bun` flag matters:**
Without `--bun`, running `bun run next build` actually spawns Node.js to execute the Next.js CLI. The `--bun` flag forces Bun runtime for the entire process tree.

---

## Phase 2: Development Scripts Update

### 2.1 Update `scripts/dev.ts`

```typescript
#!/usr/bin/env bun
/**
 * Development script that runs both the Bun API server and Next.js dev server concurrently
 * Uses Bun runtime for both servers via --bun flag
 */

import { spawn } from 'bun';

console.log('Starting development servers with Bun runtime...\n');

// Start the Bun API server (already runs on Bun natively)
console.log('Starting Bun API server on port 3201...');
const apiServer = spawn(['bun', 'server.ts'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

await new Promise((resolve) => setTimeout(resolve, 1000));

// Start Next.js dev server with Bun runtime (--bun flag)
console.log('Starting Next.js dev server on port 3000 (Bun runtime)...\n');
const nextServer = spawn(['bun', '--bun', 'next', 'dev'], {
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, API_PORT: '3201' },
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\nShutting down servers...');
  apiServer.kill();
  nextServer.kill();
  process.exit(0);
});

await Promise.all([apiServer.exited, nextServer.exited]);
```

### 2.2 Update `scripts/start-docker.ts`

**Line 74 change:**
```typescript
// OLD:
nextServer = spawn(['bun', 'run', 'start', '--', '--port', port], {

// NEW:
nextServer = spawn(['bun', '--bun', 'next', 'start', '--port', port], {
```

---

## Phase 3: Dockerfile Migration to Distroless

### 3.1 Understanding Distroless Constraints

Distroless images have NO:
- Shell (`/bin/sh`, `/bin/bash`)
- Package manager (`apk`, `apt`)
- Standard utilities (`ls`, `cat`, `grep`)
- `dumb-init` (not available)

**Must handle:**
1. Signal handling without dumb-init
2. Health checks without shell
3. Multi-stage build to copy only necessary artifacts

### 3.2 New Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.4

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM oven/bun:1.3.4-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM oven/bun:1.3.4-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Build Next.js with Bun runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun --bun next build

# Bundle API server into standalone executable
RUN bun build server.ts --compile --outfile server-bundle --target bun

# ============================================================================
# Stage 3: Production Runner (Distroless)
# ============================================================================
FROM oven/bun:1.3.4-distroless AS runner
WORKDIR /app

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy bundled API server
COPY --from=builder /app/server-bundle ./server-bundle

# Copy database migrations
COPY --from=builder /app/db/migrations ./db/migrations

# Copy startup script (compiled)
COPY --from=builder /app/scripts/start-docker-distroless.ts ./start.ts

# Environment
ENV NODE_ENV=production \
    PORT=80 \
    API_PORT=3201 \
    DATABASE_PATH=/app/db/mega-sena.db \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 80 3201

# No shell available - use Bun directly
# Bun handles SIGTERM/SIGINT properly without dumb-init
ENTRYPOINT ["bun", "run", "start.ts"]
```

### 3.3 Next.js Standalone Output Configuration

**Update `next.config.js`:**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Enable standalone output for Docker deployment
  output: 'standalone',

  async rewrites() {
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

### 3.4 Distroless-Compatible Startup Script

**New file:** `scripts/start-docker-distroless.ts`

```typescript
#!/usr/bin/env bun
/**
 * Docker Container Startup Script (Distroless-compatible)
 *
 * No shell dependencies - pure Bun execution
 * Handles SIGTERM/SIGINT for graceful shutdown
 */

import { spawn, type Subprocess } from 'bun';

let apiServer: Subprocess | null = null;
let nextServer: Subprocess | null = null;
let isShuttingDown = false;

const PORT = process.env.PORT || '80';
const API_PORT = process.env.API_PORT || '3201';

async function startServers(): Promise<boolean> {
  console.log('Starting Mega-Sena Analyzer (Distroless)...');
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Ports: Next.js=${PORT}, API=${API_PORT}`);

  try {
    // Start API server (pre-compiled binary)
    console.log('Starting API server...');
    apiServer = spawn(['./server-bundle'], {
      stdout: 'inherit',
      stderr: 'inherit',
      env: { ...process.env, API_PORT },
    });

    await Bun.sleep(3000);

    // Verify API health
    const health = await fetch(`http://localhost:${API_PORT}/api/health`);
    if (!health.ok) throw new Error('API health check failed');
    console.log('API server ready');

    // Start Next.js (standalone mode with Bun runtime)
    console.log('Starting Next.js server...');
    nextServer = spawn(['bun', '--bun', './server.js', '--port', PORT], {
      stdout: 'inherit',
      stderr: 'inherit',
      env: { ...process.env, PORT },
    });

    await Bun.sleep(2000);
    console.log(`Application ready at http://localhost:${PORT}`);
    return true;

  } catch (error) {
    console.error('Startup failed:', error);
    await shutdown('STARTUP_ERROR');
    return false;
  }
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\nReceived ${signal}, shutting down...`);

  if (nextServer) {
    nextServer.kill('SIGTERM');
    await Bun.sleep(2000);
    if (!nextServer.killed) nextServer.kill('SIGKILL');
  }

  if (apiServer) {
    apiServer.kill('SIGTERM');
    await Bun.sleep(1000);
    if (!apiServer.killed) apiServer.kill('SIGKILL');
  }

  console.log('Shutdown complete');
  process.exit(0);
}

// Signal handlers (Bun handles these natively)
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Main
const success = await startServers();
if (!success) process.exit(1);

// Keep alive
await new Promise(() => {});
```

---

## Phase 4: Docker Compose Updates

### 4.1 Base `docker-compose.yml`

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: megasena-analyser
    ports:
      - "3000:80"
      - "3301:3201"
    environment:
      - NODE_ENV=production
      - PORT=80
      - API_PORT=3201
      - API_HOST=localhost
      - DATABASE_PATH=/app/db/mega-sena.db
      - NEXT_TELEMETRY_DISABLED=1
    volumes:
      - ./db:/app/db
      - ./logs:/app/logs
    restart: unless-stopped

    # Distroless health check (no shell)
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://localhost:3201/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Phase 5: Testing & Validation

### 5.1 Local Validation Steps

```bash
# 1. Test Bun runtime detection
bun --bun -e "console.log('Runtime:', typeof Bun !== 'undefined' ? 'Bun' : 'Node')"

# 2. Test Next.js build with Bun runtime
bun --bun next build

# 3. Test Next.js start with Bun runtime
bun --bun next start --port 3000

# 4. Build Docker image
docker build -t megasena:distroless .

# 5. Verify image size
docker images megasena:distroless --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
# Expected: ~90-120MB (vs ~200-250MB for alpine)

# 6. Run container
docker run -d --name megasena-test -p 3000:80 -p 3301:3201 megasena:distroless

# 7. Test health
curl http://localhost:3301/api/health

# 8. Test Next.js
curl http://localhost:3000
```

### 5.2 Verification Checklist

- [ ] `bun --bun next build` completes successfully
- [ ] `bun --bun next start` serves pages correctly
- [ ] Docker image builds without errors
- [ ] Docker image size < 150MB
- [ ] Container starts and passes health checks
- [ ] API endpoints respond correctly
- [ ] Next.js pages render correctly
- [ ] Database operations work (bun:sqlite)
- [ ] Graceful shutdown works (SIGTERM)
- [ ] No `dumb-init` required (Bun handles signals)

---

## Phase 6: Fallback Strategy

### If Distroless Fails

If `oven/bun:1.3.4-distroless` has issues (as noted in GitHub issues), use:

```dockerfile
# Fallback: Alpine with minimal footprint
FROM oven/bun:1.3.4-alpine AS runner

# Remove unnecessary packages
RUN apk del --no-cache \
    && rm -rf /var/cache/apk/* /tmp/*

# Continue with same COPY instructions...
```

### Known Distroless Issues

Per [GitHub Discussion #19786](https://github.com/oven-sh/bun/discussions/19786):
- Distroless publishing was intermittent between 1.2.2 and 1.3.x
- Version 1.3.4-distroless appears available on Docker Hub
- If unavailable, consider building custom distroless from source

---

## Migration Order

1. **Update `package.json`** scripts with `--bun` flag
2. **Update `scripts/dev.ts`** to use `--bun` for Next.js
3. **Update `next.config.js`** to add `output: 'standalone'`
4. **Create `scripts/start-docker-distroless.ts`**
5. **Update Dockerfile** to multi-stage distroless build
6. **Update `docker-compose.yml`** files
7. **Test locally** with new scripts
8. **Build and test Docker image**
9. **Deploy to staging** for validation
10. **Deploy to production**

---

## Rollback Plan

If issues arise:
1. Revert `package.json` scripts (remove `--bun`)
2. Revert Dockerfile to `oven/bun:1.2-alpine`
3. Keep `dumb-init` for signal handling
4. Revert `next.config.js` (remove `output: 'standalone'`)

---

## Expected Benefits

| Metric | Before | After |
|--------|--------|-------|
| Docker Image Size | ~200-250MB | ~90-120MB |
| Startup Time | ~5-7s | ~3-4s |
| Memory Usage | ~300-400MB | ~200-300MB |
| Attack Surface | Alpine packages | Minimal (distroless) |
| Runtime Consistency | Mixed (Bun/Node) | Pure Bun |

---

## Sources

- [Bun Next.js Guide](https://bun.com/docs/guides/ecosystem/nextjs)
- [Vercel Bun Runtime](https://vercel.com/blog/bun-runtime-on-vercel-functions)
- [oven/bun Docker Hub](https://hub.docker.com/r/oven/bun)
- [Distroless Discussion #19786](https://github.com/oven-sh/bun/discussions/19786)
- [Bun v1.3.4-distroless](https://hub.docker.com/layers/oven/bun/1.3.4-distroless/images/sha256-2c50f60263cb51565652267c3b30209f51e8b34c1b66ddc6cd73f26019e04f4e)
