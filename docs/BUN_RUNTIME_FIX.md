# Bun Runtime Fix Documentation

## Problem

The application was failing with a runtime error:
```
Database requires Bun runtime. This application must be run with Bun, not Node.js.
```

This occurred because:
1. The project uses `bun:sqlite` which only works in Bun's runtime
2. Next.js dev server (`next dev`) internally uses Node.js for API routes and server components
3. Even when started with `bun run dev`, Next.js defaults to Node.js runtime

## Solution Architecture

Implemented a **dual-server architecture**:

### 1. Bun API Server (`server.ts`)
- Runs on port **3201**
- Handles all API routes that need database access
- Has direct access to `bun:sqlite`
- Endpoints:
  - `GET /api/dashboard` - Dashboard statistics and recent draws
  - `GET /api/statistics` - Number frequencies and patterns
  - `POST /api/generate-bets` - Bet generation

### 2. Next.js Dev Server
- Runs on port **3000**
- Handles all page rendering and static assets
- Proxies API requests to the Bun server via Next.js rewrites

### 3. Development Script (`scripts/dev.ts`)
- Orchestrates both servers
- Starts Bun API server first (port 3201)
- Then starts Next.js dev server (port 3000)
- Handles graceful shutdown of both processes

## Files Modified

### Core Changes
1. **`lib/db.ts`** - Removed automatic migration execution on module load
2. **`next.config.js`** - Added rewrite rules to proxy API requests
3. **`package.json`** - Updated dev script to use new launcher

### New Files
1. **`server.ts`** - Bun HTTP server for API routes
2. **`scripts/dev.ts`** - Development orchestration script

### Updated Pages
1. **`app/dashboard/page.tsx`** - Fetch data from API instead of direct DB access
2. **`app/dashboard/statistics/page.tsx`** - Fetch data from API instead of direct DB access

### Deleted Files
1. `app/api/dashboard/route.ts` - Moved to Bun server
2. `app/api/statistics/route.ts` - Moved to Bun server  
3. `app/api/generate-bets/route.ts` - Moved to Bun server
4. `app/api/test-bun/route.ts` - Temporary test file

## Usage

### Development
```bash
bun run dev
```

This starts both servers automatically.

### Direct Access
- **Next.js pages:** http://localhost:3000
- **Bun API (direct):** http://localhost:3201/api/*
- **API via Next.js proxy:** http://localhost:3000/api/*

### Production Considerations

For production deployment, you'll need to:
1. Build Next.js: `bun run build`
2. Start both servers:
   ```bash
   bun server.ts &
   bun run start
   ```
3. Or use a process manager like PM2 to manage both processes

## Benefits

✅ Maintains Bun's performance for database operations  
✅ Leverages Next.js's powerful rendering capabilities  
✅ Clean separation of concerns  
✅ No changes needed to existing database code  
✅ Compatible with all Next.js features  

## Testing

All endpoints verified working:
```bash
# Dashboard data
curl http://localhost:3000/api/dashboard

# Statistics
curl http://localhost:3000/api/statistics

# Bet generation
curl -X POST http://localhost:3000/api/generate-bets \
  -H "Content-Type: application/json" \
  -d '{"budget":30,"strategy":"balanced","mode":"simple"}'
```

### Vitest & Banco em Memória

Para que `bun run test` funcione dentro do runner do Vitest (que executa em um processo Node), foi implementada uma camada de banco em memória em `lib/db.ts`. Quando a variável `VITEST` está presente e o runtime não expõe `Bun`, o módulo provisiona um driver compatível que:

- Reproduz as operações de `INSERT`, `UPDATE`, `SELECT` usadas pelo motor de estatísticas
- Inicializa automaticamente a tabela `number_frequency` com os 60 números
- Suporta consultas de padrões (pares, sequências) e histórico de sorteios

Isso permite validar as rotas e engines sem carregar `bun:sqlite`, mantendo paridade com o ambiente real.

## Migration Path

If you want to use a Node.js-compatible SQLite library in the future:
1. Replace `bun:sqlite` with `better-sqlite3`
2. Update type definitions in `lib/db.ts`
3. Remove the dual-server setup
4. Move API logic back to `app/api/*/route.ts` files
5. Revert `next.config.js` and `package.json` changes

---

## Full Bun Runtime Migration (December 2025)

### The `--bun` Flag Discovery

**Critical insight:** Running `bun run next build` does NOT use Bun runtime for Next.js.

```bash
# This spawns Node.js internally:
bun run next build

# This actually uses Bun runtime:
bun --bun next build
```

The `--bun` flag forces Bun to be the runtime for the entire process tree, not just the package manager/script runner.

### Updated Scripts

```json
{
  "scripts": {
    "dev": "bun run scripts/dev.ts",
    "dev:next-only": "bun --bun next dev",
    "build": "bun --bun next build",
    "start": "bun --bun next start"
  }
}
```

### Distroless Docker Image

Migrated from `oven/bun:1.2-alpine` to `oven/bun:1.3.4-distroless`.

**Distroless constraints:**
- No shell (`/bin/sh`, `/bin/bash`)
- No package manager (`apk`, `apt`)
- No standard utilities (`ls`, `cat`, `grep`)
- No `dumb-init` available

**Solutions:**
1. Pre-compile startup scripts: `bun build script.ts --compile --outfile bundle`
2. Bun handles SIGTERM/SIGINT natively (no dumb-init needed)
3. Health checks use `bun -e "..."` syntax instead of shell

### Next.js 16 Standalone Output

With Next.js 16 and `output: 'standalone'`, the output structure is simplified:

```
# Next.js 16 outputs directly to .next/standalone/ (no nested path)
.next/standalone/
  server.js          <- Main server entry
  node_modules/      <- Pruned production deps
  .next/             <- Build artifacts
  package.json
```

Dockerfile COPY is straightforward:
```dockerfile
COPY --from=builder /app/.next/standalone ./
```

**Note:** Earlier versions mirrored the host directory structure, but Next.js 16 simplified this.

### glibc vs musl Compatibility

**Critical:** Bundles compiled with `bun build --compile` are libc-specific:
- Alpine images use **musl libc**
- Distroless/Debian images use **glibc**

Bundles compiled on Alpine will NOT run on distroless (error: `exec: no such file or directory`).

**Solution:** Use `oven/bun:1.3.4-debian` for the builder stage when targeting distroless:
```dockerfile
FROM oven/bun:1.3.4-debian AS builder  # glibc for bundle compilation
FROM oven/bun:1.3.4-distroless AS runner  # glibc runtime
```

### Lessons Learned

| Lesson | Impact |
|--------|--------|
| `bun run X` != `bun --bun X` | Without `--bun`, Next.js uses Node.js internally |
| Distroless = no shell | All scripts must be pre-compiled executables |
| Bun handles signals natively | No need for `dumb-init` in containers |
| Alpine bundles fail on distroless | Must compile bundles in glibc environment (Debian) |
| Next.js 16 simplified standalone | Direct output to `.next/standalone/`, no nested paths |

### Image Size Comparison

| Image | Size | Notes |
|-------|------|-------|
| `oven/bun:1.2-alpine` | ~200-250MB | Alpine packages, musl libc |
| `oven/bun:1.3.4-debian` | ~350-400MB | Full Debian, glibc |
| `oven/bun:1.3.4-distroless` | ~90-120MB | Runtime only, glibc |
| **Final app image** | ~392MB | Includes Next.js bundle + compiled servers |

### Resource Optimization

With full Bun runtime, memory usage decreased:
- **Before:** 512MB limit, 256MB reservation
- **After:** 384MB limit, 192MB reservation

### References

- [Bun Next.js Guide](https://bun.com/docs/guides/ecosystem/nextjs)
- [Vercel Bun Runtime](https://vercel.com/blog/bun-runtime-on-vercel-functions)
- [oven/bun Docker Hub](https://hub.docker.com/r/oven/bun)
- [Distroless Issues #19786](https://github.com/oven-sh/bun/discussions/19786)
