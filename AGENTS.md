# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts App Router routes; the dashboard entry point is `app/dashboard/page.tsx`.
- `components/` keeps reusable UI built with Tailwind tokens and shadcn/ui variants.
- `lib/` groups analytics (`lib/analytics/`), Caixa clients (`lib/api/`), and shared config (`lib/constants.ts`).
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

#### Common cases where useEffect is NOT needed:
- Transforming data for rendering (use variables or `useMemo`)
- Handling user events (use event handlers)
- Resetting state when props change (use `key` prop)
- Updating state based on props/state (calculate during render)

#### Only use useEffect for:
- Synchronizing with external systems (APIs, DOM, third-party libraries)
- Cleanup that must happen when component unmounts

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

## Testing Guidelines
- Unit specs live in `tests/lib/**/{file}.test.ts`; mock HTTP with MSW handlers
- UI flows live in `tests/app/**/{route}.spec.ts` using Playwright
- Prime SQLite via `bun scripts/pull-draws.ts --limit 5`, which seeds the `db/mega-sena.db` test copy
- Database uses `bun:sqlite` (native), not `better-sqlite3`
- Fail CI if `bunx vitest --coverage` drops below 80%

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
