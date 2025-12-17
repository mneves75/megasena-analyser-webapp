# Next.js 16 Upgrade Plan - Mega-Sena Analyzer

## Current State Analysis

| Component | Current | Target |
|-----------|---------|--------|
| Next.js | 15.5.4 | 16.x |
| React | 19.1.1 | 19.2.x |
| ESLint | 9.36.0 | 9.x |
| eslint-config-next | 15.5.4 | 16.x |
| Node.js | Not specified | >=20.9.0 |

## Impact Assessment

### Low Impact (This Project)
- No `cookies()`, `headers()`, `draftMode()` usage found
- No dynamic routes with `params` or `searchParams`
- No custom webpack config (Turbopack compatible)
- No `generateStaticParams` usage

### Medium Impact
- **middleware.ts** - Needs rename to `proxy.ts`
- **ESLint config** - Migrate from `.eslintrc.json` to `eslint.config.mjs`
- **next.config.js** - Remove deprecated `experimental.serverActions`

### Breaking Changes Requiring Attention
- `next lint` command removed - must update scripts
- `rewrites()` function signature may change

---

## Phase 1: Pre-Upgrade Preparation

### 1.1 Update Node.js Engine Requirement

**File:** `package.json`

```diff
  "engines": {
-   "bun": ">=1.1.0"
+   "bun": ">=1.1.0",
+   "node": ">=20.9.0"
  },
```

### 1.2 Create ESLint Flat Config

**Delete:** `.eslintrc.json`

**Create:** `eslint.config.mjs`

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
```

### 1.3 Install ESLint Compatibility Layer

```bash
bun add -D @eslint/eslintrc
```

---

## Phase 2: Middleware Migration

### 2.1 Rename middleware.ts to proxy.ts

**Action:** `mv middleware.ts proxy.ts`

The file contents remain the same - Next.js 16 uses `proxy.ts` instead of `middleware.ts` for request manipulation middleware.

**Note:** The `config.matcher` export remains valid in `proxy.ts`.

---

## Phase 3: Configuration Updates

### 3.1 Update next.config.js

**File:** `next.config.js`

```diff
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
- experimental: {
-   serverActions: {
-     bodySizeLimit: '2mb',
-   },
- },
+ serverActions: {
+   bodySizeLimit: '2mb',
+ },
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

**Changes:**
- `serverActions` moved from `experimental` to top-level
- Turbopack is now the default bundler (no config needed)

### 3.2 Update package.json Scripts

**File:** `package.json`

```diff
  "scripts": {
    "dev": "bun run scripts/dev.ts",
    "dev:next-only": "next dev",
    "build": "next build",
    "start": "next start",
-   "lint": "next lint --max-warnings=0",
-   "lint:fix": "next lint --fix",
+   "lint": "eslint . --max-warnings=0",
+   "lint:fix": "eslint . --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
```

**Note:** `next lint` is removed in v16. Use `eslint` directly.

---

## Phase 4: Dependency Upgrade

### 4.1 Update Dependencies

```bash
# Update Next.js and related packages
bun add next@16 react@^19.2 react-dom@^19.2

# Update ESLint config
bun add -D eslint-config-next@16
```

### 4.2 Optional: Enable React Compiler

If you want to try React Compiler (experimental):

```bash
bun add -D babel-plugin-react-compiler
```

**File:** `next.config.js`

```javascript
const nextConfig = {
  // ... existing config
  experimental: {
    reactCompiler: true,
  },
};
```

---

## Phase 5: Post-Upgrade Verification

### 5.1 Verification Checklist

- [ ] `bun run build` completes without errors
- [ ] `bun run lint` works with new eslint config
- [ ] `bun run dev` starts successfully
- [ ] CSP headers still applied (test via browser dev tools)
- [ ] API rewrites function correctly
- [ ] Favicon renders correctly
- [ ] All pages load without hydration errors

### 5.2 Test Commands

```bash
# Clean install
rm -rf node_modules .next
bun install

# Build verification
bun run build

# Development test
bun run dev

# Lint test
bun run lint
```

---

## Migration Script

Execute in order:

```bash
# Phase 1: Pre-upgrade
bun add -D @eslint/eslintrc

# Phase 2: Middleware rename
mv middleware.ts proxy.ts

# Phase 3: Delete old ESLint config (after creating new one)
rm .eslintrc.json

# Phase 4: Upgrade dependencies
bun add next@16 react@^19.2 react-dom@^19.2
bun add -D eslint-config-next@16

# Phase 5: Verify
rm -rf .next
bun run build
bun run lint
```

---

## Rollback Plan

If issues occur:

```bash
# Restore middleware
mv proxy.ts middleware.ts

# Restore ESLint config
# (recreate .eslintrc.json from git)
git checkout .eslintrc.json
rm eslint.config.mjs

# Downgrade dependencies
bun add next@15.5.4 react@19.1.1 react-dom@19.1.1
bun add -D eslint-config-next@15.5.4
bun remove @eslint/eslintrc

# Clean and rebuild
rm -rf node_modules .next
bun install
bun run build
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build failure | Low | High | Rollback plan ready |
| ESLint config issues | Medium | Low | FlatCompat provides compatibility |
| Turbopack incompatibility | Low | Medium | Can disable with `--webpack` flag |
| CSP middleware failure | Low | High | Test thoroughly before deploy |

---

## Timeline Estimate

| Phase | Tasks |
|-------|-------|
| Phase 1 | ESLint migration, engine update |
| Phase 2 | Middleware rename |
| Phase 3 | Config updates |
| Phase 4 | Dependency upgrade |
| Phase 5 | Verification and testing |

**Total:** Single session, ~30-45 minutes

---

## Notes

1. **Bun Compatibility**: Next.js 16 fully supports Bun runtime. No changes needed.

2. **Turbopack**: Now default. If build issues occur, use `next dev --webpack` or `next build --webpack` to fall back.

3. **No Breaking API Changes**: This project doesn't use `cookies()`, `headers()`, `params`, or `searchParams` in ways that require async migration.

4. **Docker**: No Dockerfile changes needed. The image build process remains the same.

5. **Coolify Deployment**: No changes needed. Same `bun run build && bun run start` commands.
