# Repository Guidelines

## Core Development Guidelines

**FOLLOW THESE GUIDELINES ALWAYS!**

- **Never create markdown files after you are done. NEVER!** Use `agent_planning/` for planning docs only, archive when done in `agent_planning/archive/`. Do NOT externalize or document your work, usage guidelines, or benchmarks in markdown files after completing the task, unless explicitly instructed to do so.
- **Never use emojis!** No emojis in code, commit messages, or any output.
- **Think critically and push reasoning to 100% of capacity.** I'm trying to stay a critical and sharp analytical thinker. Walk me through your thought process step by step. The best people in the domain will verify what you do. Think hard! Be a critical thinker!
- **Use `ast-grep` for syntax-aware searches.** This environment has `ast-grep` available. Whenever a search requires syntax-aware or structural matching, default to `ast-grep --lang <language> -p '<pattern>'` (set `--lang` appropriately: typescript, javascript, python, etc.) and avoid falling back to text-only tools like `rg` or `grep` unless explicitly requested for plain-text search.
- **Sacrifice grammar for the sake of concision.** Be brief and direct.
- **List any unresolved questions at the end of your response, if any exist.**
- **Work through every listed task/plan item before stopping; do not quit while items remain.**
- **No workarounds.** Deliver full, durable solutions instead of temporary patches.
- **Treat `docs/GUIDELINES-REF/` as the canonical knowledge base.** Read relevant files for each task (e.g., `PRAGMATIC-RULES.md`, `WEB-NEXTJS-GUIDELINES.md`, `SECURITY-GUIDELINES.md`) and cite them when explaining decisions.
- **Security, logging, audit are mandatory.** Apply `SECURITY-GUIDELINES.md`, `LOG-GUIDELINES.md`, and `AUDIT-GUIDELINES.md` on every task; avoid client-side secrets and sanitize inputs/outputs.
- **Product reality:** Lottery prediction is impossible—limit claims to verifiable historical analysis, pattern detection, and budget-aware strategies; avoid speculation.

## Project Structure & Module Organization
- `app/` hosts App Router routes; the dashboard entry point is `app/dashboard/page.tsx`.
- `components/` keeps reusable UI built with Tailwind tokens and shadcn/ui variants.
- `lib/` groups analytics (`lib/analytics/`), Caixa clients (`lib/api/`), security (`lib/security/`), and shared config (`lib/constants.ts`).
- `middleware.ts` handles CSP nonces and security headers for all page requests.
- `db/` stores SQLite assets: migrations in `db/migrations/` and the main database file `db/mega-sena.db`.
- `scripts/` bundles Bun CLIs such as `scripts/pull-draws.ts` for ingesting and seeding draws.
- `tests/` mirrors source modules for Vitest (`tests/lib`) and Playwright (`tests/app`), with MSW mocks in `tests/mocks`.
- `docs/` carries prompts and decision logs; update alongside feature shifts.

## Build, Test, and Development Commands

**⚠️ CRITICAL:** All commands require **Bun runtime ≥1.1**. This project uses `bun:sqlite` (native) and **will not work with Node.js, npm, yarn, or pnpm**.

- `bun install` installs dependencies (Bun ≥1.1 required)
- `bun scripts/migrate.ts` applies SQLite migrations (uses bun:sqlite native)
- `bun run db:migrate` same as above (via package.json script)
- `bun run dev` serves `http://localhost:3000` with hot reload
- `bun run lint` (or `bun run lint --fix`) enforces ESLint; `bun run format` runs Prettier
- `bun run test` executes Vitest suites; append `-- --run` in CI to disable watch mode
- `bunx vitest --coverage` must report ≥80% line coverage
- `bun run build` bundles for production and type-checks
- `bun scripts/pull-draws.ts` ingests all draws; `bun scripts/pull-draws.ts --incremental` pulls only new draws
- `bun scripts/optimize-db.ts` runs WAL checkpoint, VACUUM, and ANALYZE after large ingests

## Coding Style & Naming Conventions
- Use strict TypeScript with explicit returns on exported APIs.
- Two-space indentation, `PascalCase` components, `camelCase` utilities, and kebab-case files.
- Reference design tokens; centralize shared values in `lib/constants.ts`.
- Run `bun run lint --fix` then `bun run format` before pushing.

## React Server Components (RSC) Guidelines

### Core Philosophy: "Two Worlds, Two Doors"

Treat the frontend and backend as **a single program** split across two machines. The `'use client'` and `'use server'` directives are **doors** that open a bridge across the network within the module system.

#### Key Concepts

1. **`'use client'` is a typed `<script>` tag**
   - Opens a door FROM server TO client
   - Allows server to reference components that execute on the client
   - Props passed must be serializable (no functions except Server Actions)

2. **`'use server'` is a typed `fetch()` call**
   - Opens a door FROM client TO server
   - Creates Server Actions—RPC functions callable from client
   - Arguments and return values must be serializable

### When to Use Each Directive

#### Use `'use client'` ONLY when components require:
- **Interactivity:** `onClick`, `onChange`, event handlers
- **State/Lifecycle:** `useState`, `useEffect`, `useReducer`
- **Browser APIs:** `window`, `document`, `localStorage`
- **Class Components:** All class components are client-side

#### Use `'use server'` for:
- **Data mutations:** Database create/update/delete operations
- **Form submissions:** Server-side form processing
- **Secure operations:** Accessing environment variables, sensitive APIs

### Implementation Rules

1. **Default to Server**
   - All components are Server Components by default
   - Only add `'use client'` when absolutely necessary
   - Keep client-side JavaScript minimal

2. **Directive Placement**
   - `'use client'` or `'use server'` MUST be the first line before imports
   - Cannot be mixed in the same file

3. **Avoid Manual `fetch`**
   - Use Server Actions instead of creating API routes
   - Direct function imports provide type safety and reduce boilerplate
   - Example: `import { createBet } from './actions'` instead of `fetch('/api/bets')`

4. **Props Must Be Serializable**
   - Only pass JSON-serializable data between client and server
   - No functions, Date objects, Maps, Sets, or class instances
   - Exception: Server Actions can be passed as props

### React useEffect Guidelines

**Before using useEffect, read:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

Most `useEffect` usages can be eliminated by restructuring your code.

#### ❌ DON'T use useEffect for:

1. **Transforming data for rendering** - use variables or `useMemo`
2. **Handling user events** - use event handlers directly
3. **Resetting state when props change** - use `key` prop
4. **Notifying parent components** - call during event or lift state up
5. **Subscribing to external stores** - use `useSyncExternalStore`
6. **Fetching data** - use Server Components or React Query/SWR (avoids race conditions)

#### ✅ DO use useEffect for:

1. **Synchronizing with external systems** - WebSocket, analytics, browser APIs
2. **Operations requiring cleanup** - timers, subscriptions, third-party libraries
3. **Browser APIs and third-party libraries** - DOM manipulation, chart initialization

#### Effect Cleanup Checklist

**Always return cleanup for:**
- Event listeners: `removeEventListener`, `unsubscribe`
- Timers: `clearTimeout`, `clearInterval`
- Connections: WebSocket disconnect, abort controllers
- Third-party libraries: chart destroy, player cleanup

**Pattern for async operations:**
```tsx
useEffect(() => {
  let mounted = true;

  async function load() {
    const data = await fetch('/api/data');
    if (mounted) setData(data); // Only update if still mounted
  }

  load();
  return () => { mounted = false; }; // Cleanup
}, []);
```

#### Dependency Array Rules

1. **Never omit dependencies** - always include all values from component scope used inside effect
2. **Empty array `[]`** - only if effect truly runs once (no dependencies)
3. **Extract static values** - move functions/objects outside component if they don't use props/state
4. **Use `useCallback`/`useMemo`** - for functions/objects that must be dependencies

**Example from codebase (correct pattern):**
```tsx
// From components/ui/glass-card.tsx
useEffect(() => {
  let mounted = true;

  async function checkReduceMotion() {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mounted) setReduceMotion(mediaQuery.matches);
    }
  }

  checkReduceMotion();
  return () => { mounted = false; };
}, []);
```

This demonstrates legitimate useEffect usage:
- Synchronizes with OS accessibility API (external system)
- Proper cleanup with mounted flag
- Empty dependency array justified (runs once to check system preference)

### Architecture Pattern

```
app/
  dashboard/
    generator/
      page.tsx           ← Server Component (layout, static content)
      actions.ts         ← 'use server' (data mutations)
      generator-form.tsx ← 'use client' (interactivity)
```

**Benefits:**
- Improved type safety with direct function imports
- Reduced client bundle size
- Better performance with server-side rendering
- Cleaner separation of concerns

## Data Source & API Discipline
- Official draws come from `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`; use backoff and ETag/If-Modified-Since; never fabricate data on failure—log and surface errors.

## Database Operations (SQLite WAL)
- Batch writes inside explicit transactions (`BEGIN`/`COMMIT`; `ROLLBACK` on error) to avoid slow per-row commits.
- Ensure disk has ≥15–20% free space; low space triggers `SQLITE_IOERR_VNODE`.
- Run `bun scripts/optimize-db.ts` after heavy ingest (WAL checkpoint, VACUUM, ANALYZE).
- Default to soft deletes; ensure queries filter on `deleted_at IS NULL`.
- Wrap DB calls in try/catch and log full errors; never bypass error handling.

## Testing Guidelines
- Unit specs live in `tests/lib/**/{file}.test.ts`; mock HTTP with MSW handlers
- UI flows live in `tests/app/**/{route}.spec.ts` using Playwright
- Prime SQLite via `bun scripts/pull-draws.ts --limit 5`, which seeds the `db/mega-sena.db` test copy
- Database uses `bun:sqlite` (native), not `better-sqlite3`
- Fail CI if `bunx vitest --coverage` drops below 80%
- Logging/audit coverage required for user actions per `LOG-GUIDELINES.md` and `AUDIT-GUIDELINES.md`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat: add jackpot probability panel`) with single-focus changes.
- Call out database or migration impacts in commit bodies.
- Pull requests describe scope, edge cases, and UI screenshots when visuals shift; reference issues (`Refs #123`).
- Require green CI (`bun run lint && bun run test`) prior to requesting review.

## Security & Configuration Tips
- Copy `.env.example` to `.env.local`; keep Caixa tokens and other secrets out of VCS.
- Add `db/*.db` and related migration artifacts to `.gitignore` to avoid committing stateful files.
- Cache Caixa responses in memory or Redis; never embed credentials in source files.
- Document security-sensitive changes in `docs/SYSTEM_PROMPT.md`.
