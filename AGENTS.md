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
