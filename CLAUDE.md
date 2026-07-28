# CLAUDE.md

`AGENTS.md` is the canonical agent contract for this repo — read it first. This file
adds Claude-specific notes only; it does not duplicate AGENTS.md.

Doc-read order: `AGENTS.md` → `README.md` → `docs/` (DEPLOY, SECURITY, PRIVACY,
LGPD-COMPLIANCE) → `CHANGELOG.md` (single source for versions/history).

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
