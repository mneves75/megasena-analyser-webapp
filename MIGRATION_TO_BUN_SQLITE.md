# Migration from better-sqlite3 to bun:sqlite

**Date:** 2025-09-30
**Status:** ✅ Complete

## Problem

The original implementation used `better-sqlite3`, a Node.js native module that caused ABI compatibility issues with Bun:

```
error: The module 'better_sqlite3' was compiled against a different Node.js ABI version using NODE_MODULE_VERSION 127. This version of Bun requires NODE_MODULE_VERSION 137.
```

## Solution

Migrated to Bun's native SQLite implementation (`bun:sqlite`), which:
- ✅ No compilation required
- ✅ Native Bun performance
- ✅ Zero ABI compatibility issues
- ✅ Smaller dependency footprint

## Changes Made

### 1. Database Module (`lib/db.ts`)
- Replaced `import Database from 'better-sqlite3'` with dynamic `require('bun:sqlite')`
- Added runtime detection to throw helpful error if not running in Bun
- Changed `db.pragma()` to `db.exec("PRAGMA ...")`

### 2. Dependencies Removed
- `better-sqlite3` - Native Node.js module
- `@types/better-sqlite3` - Type definitions
- `node-gyp` - Build tool (no longer needed)

### 3. Dependencies Added
- `@types/bun` - Bun type definitions

### 4. TypeScript Configuration
- Added `"types": ["bun-types"]` to `tsconfig.json`

### 5. Next.js Configuration
- Removed `better-sqlite3` from webpack externals
- Added `export const dynamic = 'force-dynamic'` to database-using pages

### 6. Documentation Updates
- `README.md` - Updated tech stack, prerequisites
- `CHANGELOG.md` - Documented breaking change
- This document - Migration guide

## Runtime Requirements

**CRITICAL:** This application now **requires Bun** as the runtime. It will not work with Node.js.

### Error if Run with Node.js

```
Error: Database requires Bun runtime. This application must be run with Bun, not Node.js.
Install Bun: https://bun.sh
Run with: bun run dev
```

## Commands

All commands must use Bun:

```bash
# Development
bun run dev              # NOT: npm run dev

# Build
bun run build            # NOT: npm run build

# Migrations
bun scripts/migrate.ts   # NOT: node scripts/migrate.ts

# Pull data
bun scripts/pull-draws.ts

# Tests (when jsdom is fixed)
bun run test
```

## Benefits

1. **No Build Step**: No need to compile native modules
2. **Faster Install**: No post-install compilation
3. **Better Performance**: Native Bun SQLite is optimized
4. **Simpler Deployment**: No platform-specific binaries
5. **Smaller Bundle**: Fewer dependencies

## Testing

```bash
✅ bun scripts/migrate.ts          # Migrations work
✅ bun run lint                     # No lint errors
✅ bun run build                    # Build succeeds
✅ Database queries work correctly
✅ All CRUD operations functional
```

## Migration Checklist

- [x] Replace better-sqlite3 imports
- [x] Update database initialization
- [x] Remove old dependencies
- [x] Add Bun types
- [x] Update TypeScript config
- [x] Mark dynamic routes
- [x] Test migrations
- [x] Test build
- [x] Update documentation
- [x] Update CHANGELOG

## Future Considerations

If Node.js support is needed in the future:
1. Create conditional imports based on runtime
2. Use `better-sqlite3` in Node.js, `bun:sqlite` in Bun
3. Abstract database interface

However, **this is not recommended** as Bun provides better performance and simpler deployment.

## Rollback (Not Recommended)

To rollback to `better-sqlite3`:

```bash
# Install old dependencies
bun add better-sqlite3 @types/better-sqlite3

# Revert lib/db.ts to:
import Database from 'better-sqlite3';
// ... (see git history)

# Rebuild native module
cd node_modules/better-sqlite3
bunx node-gyp rebuild
```

**Note:** You'll still face ABI issues.

---

**Recommendation:** Stay with `bun:sqlite` for best compatibility and performance.
