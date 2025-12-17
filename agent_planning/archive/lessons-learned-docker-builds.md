# Lessons Learned - Cross-Platform Docker Builds (ARM64 to AMD64)

## TL;DR - MUST READ BEFORE DEPLOYING

**If developing on Mac (ARM64) and deploying to VPS (AMD64):**

1. **Always use**: `docker build --platform linux/amd64`
2. **Bun crashes in QEMU** only when it **executes during build** (`RUN bun install`)
3. **Bun works fine for runtime** - `CMD ["bun", "server.ts"]` runs on real VPS hardware

### Recommended Approach: Pre-build Locally

```bash
bun --bun next build                            # Build on Mac
docker build --platform linux/amd64 -t app .    # Dockerfile only copies dist/
```

---

## Critical: Cross-Platform Docker Builds (ARM64 to AMD64)

### Problem

Building Docker images on Mac (Apple Silicon / ARM64) for deployment on VPS (Linux / AMD64) causes `exec format error`.

### Root Cause

Docker images built without platform specification use the host architecture. ARM64 binaries won't run on AMD64.

### Solution

Always use `--platform` flag when building on Mac for Linux deployment:

```bash
docker build --platform linux/amd64 -t megasena-analyzer .
```

---

## Critical: Bun AVX Requirement in QEMU Emulation

### Problem

When cross-compiling with `--platform linux/amd64` on Mac, Bun crashes during build stage:

```
CPU lacks AVX support, Bun requires AVX to run.
panic: Segmentation fault
```

### Root Cause

- Bun 1.3.x requires AVX CPU instructions
- QEMU emulation (used by Docker for cross-platform builds) doesn't support AVX
- This affects the BUILD stage, not runtime

### Solution

**Pre-build locally**, then copy artifacts to Docker:

```dockerfile
# Runtime-only Dockerfile - no bun install, no bun build
FROM oven/bun:1.3.4-alpine AS runtime

WORKDIR /app

# Copy pre-built Next.js standalone output
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

# Copy API server source (runs with Bun at runtime)
COPY server.ts ./server.ts
COPY lib ./lib

CMD ["bun", "start-docker.ts"]
```

### Why It Works

- Build runs locally on Mac with native Bun (no AVX issues)
- Docker image only contains pre-built artifacts
- Runtime runs on real AMD64 hardware - Bun AVX requirement satisfied

---

## Warning: Bun Distroless Image Issues

### Problem

`oven/bun:1.3.4-distroless` has inconsistent behavior - may print transpiled code but server never binds.

### Solution

Use alpine variant instead:

```dockerfile
# DON'T USE: oven/bun:1.3.4-distroless
# USE: oven/bun:1.3.4-alpine
FROM oven/bun:1.3.4-alpine AS runtime
```

### Additional Considerations

- Alpine has shell access for debugging
- Alpine allows `apk add --no-cache curl` for health checks
- Distroless doesn't support shell-based health checks

---

## Warning: glibc vs musl Incompatibility

### Problem

Bundles compiled with `bun build --compile` on different base images are NOT portable:

```
exec ./server-bundle: no such file or directory
```

### Root Cause

- **Alpine** uses **musl libc**
- **Debian/Distroless** uses **glibc**
- Compiled Bun executables are libc-specific

### Solution

If you need pre-compiled bundles, match the libc:

```dockerfile
# For glibc runtime (Debian/Distroless)
FROM oven/bun:1.3.4-debian AS builder

# For musl runtime (Alpine)
FROM oven/bun:1.3.4-alpine AS builder
```

**Better solution**: Don't pre-compile. Just copy `.ts` files and run with Bun at runtime.

---

## Warning: .dockerignore Can Break Builds

### Problem

Docker context too small (e.g., 2.2kB), missing essential files.

### Common Mistake

Over-aggressive .dockerignore patterns:

```
# BAD - blocks essential files
package*.json
*.ts
lib/
```

### Solution

Minimal .dockerignore:

```
node_modules
.git
.env.local
.env
*.md
.DS_Store
*.log
DOCS/
agent_planning/
```

---

## Tip: Bun CMD Syntax

### Problem

```dockerfile
# ERROR: "Must use --outdir when specifying more than one entry point"
CMD ["bun", "run", "server.ts"]
```

### Solution

```dockerfile
# CORRECT: Direct execution without "run"
CMD ["bun", "server.ts"]
```

---

## Deployment Workflow (Mac to VPS)

```bash
# 1. Build locally
bun --bun next build

# 2. Build Docker image with correct platform
docker build --platform linux/amd64 -t megasena-analyzer:latest .

# 3. Save image
docker save megasena-analyzer:latest | gzip > megasena-analyzer.tar.gz

# 4. Transfer to VPS
scp megasena-analyzer.tar.gz megasena-vps:/tmp/

# 5. Load and run on VPS
ssh megasena-vps << 'EOF'
docker load < /tmp/megasena-analyzer.tar.gz
cd /home/claude/apps/megasena-analyser
docker compose -f docker-compose.coolify.yml up -d
EOF
```

---

## VPS Connection Reference

```bash
# SSH alias configured in ~/.ssh/config
ssh megasena-vps

# Direct connection
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24
```

---

## Quick Diagnosis Commands

```bash
# Check container status
docker ps --filter name=megasena-analyzer

# Check logs
docker logs megasena-analyzer --tail 50

# Test health from inside network
docker exec megasena-analyzer curl -s http://localhost:3201/api/health

# Test via Traefik
curl -I https://megasena-analyzer.com.br/api/health
```

---

## Architecture Reference

```
Local Mac (ARM64)
  |
  | bun --bun next build    (native Bun, no issues)
  | docker build --platform linux/amd64
  |
  v
Docker Image (AMD64)
  |
  | Contains: .next/standalone, server.ts, lib/
  | Runtime: oven/bun:1.3.4-alpine
  |
  v
VPS (AMD64)
  |
  | Real AMD64 hardware
  | Bun AVX requirement satisfied
  | Container runs with real Bun runtime
  |
  v
Production
  - Next.js on port 80
  - API on port 3201
  - Traefik reverse proxy
```

---

## Files Modified Summary

| File | Change |
|------|--------|
| `Dockerfile` | Runtime-only (no bun install/build), alpine base |
| `scripts/start-docker.ts` | Runs server.ts directly, not pre-compiled |
| `deploy.sh` | Pre-builds locally, then deploys |
| `DEPLOY.md` | Updated deployment workflow |

---

## Port Allocation (VPS)

| Port | Service |
|------|---------|
| 80 | Traefik (HTTP) |
| 443 | Traefik (HTTPS) |
| 3000 | megasena-analyzer (Next.js via Traefik) |
| 3201 | megasena-analyzer (API internal) |
| 3301 | megasena-analyzer (API external) |
