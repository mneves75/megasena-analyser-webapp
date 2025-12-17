# Bun Distroless Docker Migration - Lessons Learned

## Executive Summary

This plan documents critical discoveries from migrating the Mega-Sena Analyzer to use `oven/bun:1.3.4-distroless` with full Bun runtime (`--bun` flag). These findings are essential for any future Bun + Next.js + Docker deployments.

---

## Discovery 1: glibc vs musl Incompatibility

### Problem
Bundles compiled with `bun build --compile` on Alpine fail on distroless with:
```
exec ./start-bundle: no such file or directory
```

### Root Cause
- **Alpine** uses **musl libc**
- **Distroless** (Debian-based) uses **glibc**
- Compiled Bun executables are libc-specific and NOT portable between them

### Solution
Use `oven/bun:1.3.4-debian` for the builder stage when targeting distroless:

```dockerfile
# WRONG - bundles won't run on distroless
FROM oven/bun:1.3.4-alpine AS builder

# CORRECT - glibc bundles run on distroless
FROM oven/bun:1.3.4-debian AS builder
```

### Files Affected
- `Dockerfile:13` - Changed from `oven/bun:1.3.4-alpine` to `oven/bun:1.3.4-debian`

---

## Discovery 2: Next.js 16 Standalone Output Structure

### Problem
Initial Dockerfile used incorrect COPY paths based on older Next.js behavior.

### Change in Next.js 16
**Before (Next.js 14-15):** Standalone output mirrored host directory structure
```
.next/standalone/app/server.js  # When built from /app
.next/standalone/Users/dev/project/server.js  # When built locally
```

**After (Next.js 16):** Simplified direct output
```
.next/standalone/
  server.js          # Direct, no nesting
  node_modules/
  .next/
  package.json
```

### Solution
Simplified COPY command:
```dockerfile
# OLD (Next.js 14-15)
COPY --from=builder /app/.next/standalone/app ./

# NEW (Next.js 16)
COPY --from=builder /app/.next/standalone ./
```

### Files Affected
- `Dockerfile:53` - Updated COPY path

---

## Discovery 3: The `--bun` Flag Requirement

### Problem
Running `bun run next build` spawns Node.js internally, NOT Bun runtime.

### Solution
The `--bun` flag forces Bun runtime for the entire process tree:

```bash
# WRONG - Node.js runs internally
bun run next build

# CORRECT - Bun runtime throughout
bun --bun next build
```

### Files Affected
- `package.json` scripts:
  - `"build": "bun --bun next build"`
  - `"start": "bun --bun next start"`
  - `"dev:next-only": "bun --bun next dev"`
- `scripts/dev.ts:47` - `spawn(['bun', '--bun', 'next', 'dev'], ...)`

---

## Discovery 4: Distroless Container Constraints

### Constraints
- No shell (`/bin/sh`, `/bin/bash`)
- No package manager (`apt`, `apk`)
- No standard utilities (`ls`, `cat`, `grep`)
- No `dumb-init` available

### Solutions Implemented

1. **Pre-compile startup scripts:**
   ```dockerfile
   RUN bun build scripts/start-docker-distroless.ts --compile --outfile start-bundle --target bun
   ```

2. **Health checks without shell:**
   ```dockerfile
   HEALTHCHECK CMD ["bun", "-e", "fetch('http://localhost:3201/api/health').then(r => r.ok ? process.exit(0) : process.exit(1))"]
   ```

3. **Native signal handling:**
   Bun handles SIGTERM/SIGINT natively - no dumb-init required

### Files Created
- `scripts/start-docker-distroless.ts` - Shell-free startup orchestrator

---

## Final Image Metrics

| Metric | Value |
|--------|-------|
| Final Image Size | 392MB |
| Base distroless | ~90-120MB |
| Next.js bundle | ~150MB |
| Compiled servers | ~114MB (2x 57MB) |
| Memory Limit | 384MB |
| Memory Reservation | 192MB |
| Startup Time | ~8 seconds |

---

## Updated Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  oven/bun:1.3.4-debian (Builder)                            │
│  - bun install                                              │
│  - bun --bun next build                                     │
│  - bun build server.ts --compile (glibc binary)             │
│  - bun build start-docker-distroless.ts --compile           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  oven/bun:1.3.4-distroless (Runner)                         │
│  - .next/standalone/ (Next.js production build)             │
│  - server-bundle (compiled API server)                      │
│  - start-bundle (compiled startup orchestrator)             │
│  - No shell, minimal attack surface                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Verification Checklist

- [x] `bun --bun next build` completes successfully
- [x] Docker build with Debian builder succeeds
- [x] Distroless container starts without errors
- [x] API health endpoint responds (port 3201)
- [x] Next.js proxy to API works (port 80)
- [x] Dashboard API returns data
- [x] Bet generation POST endpoint works
- [x] Pages render correctly
- [x] Graceful shutdown on SIGTERM

---

## Files Modified Summary

| File | Change |
|------|--------|
| `Dockerfile` | Debian builder, simplified COPY paths |
| `package.json` | Added `--bun` flag to scripts |
| `scripts/dev.ts` | Updated Next.js spawn with `--bun` |
| `scripts/start-docker-distroless.ts` | NEW: Shell-free startup |
| `next.config.js` | Added `output: 'standalone'` |
| `docs/BUN_RUNTIME_FIX.md` | Updated with all discoveries |
| `docker-compose.*.yml` | Updated ports (80 internal) |

---

## No Implementation Required

This is a documentation plan capturing lessons learned from completed work. All changes have been implemented and tested. The purpose is to preserve institutional knowledge for future reference.
