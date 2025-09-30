# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega-Sena Analyser** is a Next.js-based lottery analysis application focused on Brazil's Mega-Sena lottery. The system fetches historical draw data from the official CAIXA API, stores it in a local SQLite database, performs statistical analysis, and generates betting strategies based on various heuristics.

### Core Requirements

- Expert-level data analysis and statistics capabilities
- No speculation or "hallucination" - all claims must be verifiable
- Explicit acknowledgment that lottery prediction is statistically impossible
- Focus on historical analysis, pattern detection, and budget-constrained betting strategies
- Clean, minimal, Apple/Linear-level UI polish

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript (strict mode)
- **Runtime:** Bun (≥1.1) **[REQUIRED - Not compatible with Node.js]**
- **Database:** SQLite (bun:sqlite - native, zero compilation)
- **Styling:** TailwindCSS v4 with semantic design tokens
- **UI Components:** shadcn/ui (heavily customized)
- **Animations:** Framer Motion for micro-interactions
- **Package Manager:** Bun (npm/yarn/pnpm not supported)
- **Testing:** Vitest (unit) + Playwright (E2E)

**⚠️ CRITICAL:** This project uses Bun's native SQLite (`bun:sqlite`) and **will not work with Node.js**. All commands must use `bun`, not `node` or `npm`.

## Essential Commands

**⚠️ All commands MUST use `bun` (not `node`, `npm`, `yarn`, or `pnpm`)**

```bash
# Environment setup
bun install                     # Install dependencies with Bun
bun --version                   # Verify Bun runtime (>=1.1)

# Database (uses bun:sqlite - native)
bun scripts/migrate.ts          # Apply SQLite migrations
bun run db:migrate              # Same as above (via package.json script)

# Development
bun run dev                     # Start Next.js dev server (localhost:3000)
bun run lint                    # Run ESLint with --max-warnings=0
bun run lint --fix              # Auto-fix linting issues
bun run format                  # Run Prettier

# Testing
bun run test                    # Run Vitest in watch mode
bun run test -- --run           # Run tests once (CI mode)
bunx vitest --coverage          # Generate coverage report (≥80% required)

# Production
bun run build                   # Create production bundle + type check
```

## Architecture

### Directory Structure

- **`app/`** - Next.js App Router routes
  - Start with `app/dashboard/page.tsx` for main analytics dashboard
- **`components/`** - Reusable UI components
  - Use TailwindCSS semantic tokens exclusively
  - Heavily customize shadcn/ui components with variants
- **`lib/`** - Business logic and utilities
  - `lib/analytics/` - Mega-Sena statistical analysis
  - `lib/api/` - CAIXA API integration and data fetching
  - `lib/constants.ts` - Centralized configuration (no magic numbers)
- **`db/`** - Database layer
  - `db/migrations/` - SQL migrations (versioned)
  - `db/mega-sena.db` - SQLite database file
- **`scripts/`** - Bun CLI utilities
  - `scripts/pull-draws.ts` - Ingest historical draw data from CAIXA API
- **`tests/`** - Test suites mirroring source structure
  - `tests/lib/**/*.test.ts` - Vitest unit tests
  - `tests/app/**/*.spec.ts` - Playwright E2E tests
  - `tests/mocks/` - MSW handlers for HTTP mocking
- **`docs/`** - Product specifications and prompts
  - Update when scope changes

### Data Source

**Official API:** `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`

- Implement exponential backoff and ETag/If-Modified-Since caching
- Never fabricate data if API fails - log errors explicitly
- Parametrize all pricing/rules (do not hardcode values)

## Code Style & Standards

### TypeScript

- Strict mode enabled
- Explicit return types on all exported functions
- Two-space indentation
- `PascalCase` for React components
- `camelCase` for utilities and variables
- `kebab-case` for file names (e.g., `budget-panel.tsx`)

### Styling Philosophy

**CRITICAL:** Never use ad-hoc inline styles or explicit color classes (`text-white`, `bg-black`). All styles must be defined via semantic design tokens in `index.css` and `tailwind.config.ts`.

#### Design System Rules

1. **Semantic Tokens Only**
   - Define colors, gradients, shadows, animations in design system
   - Use HSL colors exclusively in `index.css`
   - Create component variants for all states (hover/press/focus/disabled/loading)

2. **Component Variants**
   - Extend shadcn/ui components with custom variants
   - Example: `<Button variant="hero">` instead of `<Button className="bg-white/10">`

3. **Premium Polish**
   - Clean, minimal aesthetic (Apple/Linear/Mercury level)
   - Typography: Inter font, regular/medium weight, tracking ~-0.02 to -0.04em
   - Neutral base palette + 1 accent color for priority states
   - Rounded-2xl cards, soft shadows, subtle depth
   - No stock AI gradients or emojis

4. **Micro-interactions**
   - Smooth transitions (120-220ms, cubic-bezier easing)
   - Drag-and-drop for task ordering
   - Ripple effects on buttons (discrete, non-intrusive)
   - Loading skeletons for data fetching
   - Toast notifications for user feedback

### Accessibility

- Complete keyboard navigation with visible focus rings
- ARIA labels/roles on interactive elements
- Focus trapping in modals/sheets
- WCAG 2.2 AA compliance (≥4.5:1 contrast ratios)
- Mobile-first responsive layout

## Testing Requirements

- ≥80% line coverage via Vitest
- Co-locate unit tests with source files in `tests/` mirror structure
- Mock HTTP via MSW handlers
- Seed test database with `scripts/pull-draws.ts --limit 5` before integration tests
- E2E specs in Playwright for critical user flows

## Commit Standards

- **Conventional Commits:** `feat: add jackpot probability panel`
- Single concern per commit
- Include affected file paths in commit body when migrations run
- Reference issue IDs: `Refs #123`
- CI must pass (`bun run lint && bun run test`) before merging

## Pull Requests

Must include:
- Clear scope description
- Edge cases tested
- UI screenshots (if applicable)
- Issue/Jira reference
- Passing CI checks (`bun run lint && bun run test`)

## Security & Configuration

- Secrets in `.env.local` (copy from `.env.example`)
- Never commit credentials or SQLite database files
- Cache CAIXA API responses in Redis or local cache files
- Document security changes in `docs/SYSTEM_PROMPT.md`
- Add `db/*.db` and `db/*.sqlite*` to `.gitignore`

## Development Workflow from Cursor Rules

### Task Execution Procedure

1. **Clarify scope** - Confirm objective and plan approach before coding
2. **Locate insertion points** - Identify precise files/lines for changes
3. **Minimal edits** - Avoid unrelated refactors or scope creep
4. **Verify correctness** - Check for security issues and side effects
5. **Clear delivery** - Summarize changes, files touched, risks/assumptions

### Constraints

- Do not introduce new abstractions unless explicitly requested
- Keep logic isolated to prevent regressions
- Use absolute paths when invoking tools
- Align with existing project patterns
- Preserve indentation style (tabs vs spaces)

## Important Notes

### Statistical Integrity

- **Lottery prediction is impossible** - explicitly acknowledge this
- Focus on historical pattern analysis and frequency statistics
- All betting strategies are heuristic-based with no guaranteed outcomes
- Provide clear disclaimers about randomness and independent trials

### Design System Priority

- Always edit design system (`index.css`, `tailwind.config.ts`) before components
- Create variants for all component states
- Never use explicit color classes in JSX
- Use semantic tokens: `bg-background`, `text-foreground`, `border-accent`

### Code References

When referencing code in discussions, use the format `file_path:line_number` for easy navigation.

Example: "The API integration is implemented in `lib/api/caixa-client.ts:42`"

### Documentation

- `docs/PROMPT_UI.md` - UI/UX requirements and design specifications
- `docs/PROMPT-MAIN.md` - Core domain logic and betting strategies
- `docs/SYSTEM_PROMPT.md` - System architecture and technical context
- `AGENTS.md` - Repository structure and coding guidelines

Update documentation when product scope changes.