# CLAUDE.md

`AGENTS.md` is the canonical agent contract for this repo — read it first. This file
adds Claude-specific notes only; it does not duplicate AGENTS.md.

Doc-read order: `AGENTS.md` → `README.md` → `docs/` (DEPLOY, SECURITY, PRIVACY,
LGPD-COMPLIANCE) → `CHANGELOG.md` (single source for versions/history).

## Architecture facts the file tree hides

- **Two processes, not one.** Next.js (port 3000) renders pages; a standalone Bun
  server (`server.ts`, port 3201) owns every `/api/*` endpoint. There is no
  `app/api/` directory — `next.config.js` `rewrites()` forwards `/api/:path*` to
  `${API_HOST}:${API_PORT}`. `scripts/dev.ts` boots both and waits on
  `/api/health` before Next starts. Add an endpoint in `server.ts`, never in `app/`.
- **`proxy.ts` is the Next.js 16 middleware** (Next renamed `middleware` →
  `proxy`). It mints the per-request CSP nonce, passes it down via the `x-nonce`
  request header, and sets page security headers. The Bun API sets its own headers
  independently via `buildApiSecurityHeaders` (`lib/security/csp.ts`) — two header
  stacks, one shared builder. Changing CSP means touching both paths.
- **Routes nest under the dashboard:** `app/dashboard/{statistics,generator}/`,
  plus top-level `about/`, `privacy/`, `terms/`. Playwright specs mirror them in
  `tests/app/`.
- **Test split:** Vitest excludes `tests/app/**` (those are Playwright), so
  `bun run test` and `bun run test:e2e` cover disjoint sets. Vitest coverage counts
  only `components/**` and `lib/**` and carries a long explicit exclusion list in
  `vitest.config.ts` — a new `lib/` file lands inside the 80% gate unless added
  there. `tests/scripts/` covers the Bun CLIs.
- **Git hooks:** one path only — `core.hooksPath` must be `.githooks`, whose
  `pre-commit` runs the gitleaks staged secret scan *and* React Doctor
  (`--blocking error`). Git honours a single hooks directory, so adding a second one
  (a `.husky/` reinstall, for example) silently disables this hook.
- **Duplicated agent guidance:** `.cursor/rules/*.mdc` restate the stack for Cursor
  and drift easily — they were rewritten on 2026-07-28 after describing a Supabase /
  `better-sqlite3` / Next.js 15 project that never existed here. When architecture
  changes, update `AGENTS.md` first, then sweep `.cursor/rules/`.

## Claude-specific notes

- After UI changes, verify in the real browser with agent-browser (`/browse`), covering
  interaction, responsiveness, accessibility, and console. Do not stop until verified.
- Bug reports: write the failing regression test first, then fix and prove green.
- Close nontrivial work with the `autoreview` skill.
- Structural search via `ast-grep --lang tsx|typescript -p '<pattern>'`; `rg` only for
  plain-text/config/docs.
- Hot-path reminder: this is Bun-runtime + `bun:sqlite` (not Node); pnpm manages deps.
  The CSP nonce path and the in-memory test DB swap are the two facts most likely to
  trip up a change — see AGENTS.md before touching security headers or `lib/db.ts`.
- Model routing: see `AGENTS.md` § "Model routing & review discipline". Default to
  Opus 5 for deep code/architecture/security work and Fable 5 for UI/copy/design.
