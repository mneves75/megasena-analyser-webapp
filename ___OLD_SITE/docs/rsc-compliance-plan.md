# RSC Compliance Audit Plan & TODO

## Plan

1. Catalogue all modules that declare `'use client'` and confirm they only depend on client-safe utilities.
2. Audit server actions and data services for `'use server'`/`"server-only"` boundaries and verify they return serializable payloads.
3. Trace data passed from server components to client components to ensure props remain JSON-serializable (Dates converted, Maps avoided).
4. Review every `useEffect` usage to ensure it matches the "You Might Not Need an Effect" guidance and document any unavoidable effects.
5. Document outcomes and open follow-up tasks so future contributors can close the remaining gaps.

## Checklist Review

- [PASS] Directives applied correctly: every interactive component starts with `'use client'` (`src/components/forms/bet-generator-form.tsx:1`, `src/components/layout/theme-toggle.tsx:1`) and the orchestrator action is declared with `'use server'` (`src/app/generate/actions.ts:1-92`).
- [PASS] Server-only boundaries enforced with `import "server-only";` in data modules (`src/services/bets.ts:1-15`, `src/services/pricing.ts:1-18`), preventing accidental client bundling.
- [PASS] Props crossing the boundary stay serializable: server code converts Dates before handing to client grids (`src/app/bets/page.tsx:42-66`), and metadata utilities sanitize nested structures to JSON-friendly shapes (`src/components/bets/metadata-utils.ts:1-48`).
- [PASS] Remaining `useEffect` hooks synchronize with browser APIs only (clipboard timers, body scroll lock, persisted theme) and guard against SSR access (`src/components/bets/copy-seed-button.tsx:55-83`, `src/components/ui/modal.tsx:33-88`, `src/components/layout/theme-toggle.tsx:11-30`).
- [PASS] Shared strategy metadata now lives in `src/types/strategy.ts`; client modules import from there (`src/components/bets/tickets-grid.tsx:13-19`, `src/components/bets/ticket-metadata-dialog.tsx:11-16`), while server utilities continue to source constants from `@/services/strategies/types` (`src/services/strategies/utils.ts:7-15`).
- [PASS] `Select` now derives placeholder visibility from render-time values without any `useEffect`, keeping controlled/uncontrolled support intact (`src/components/ui/select.tsx:1-109`).
- [PASS] Added inline documentation explaining that `/api/bets/generate` remains for external automations per `docs/API_BET_ENGINE.md`, while App Router traffic should use the server action (`src/app/api/bets/generate/route.ts:18-23`).

## TODO

- [x] Relocate shared `StrategyMetadata`-related types to a neutral module (e.g. `src/types/strategy.ts`) so client components (`src/components/bets/tickets-grid.tsx`, `src/components/bets/ticket-metadata-dialog.tsx`) no longer import the `"server-only"` module `@/services/strategies/types`.
- [x] Revisit the derived state/effect combo in `src/components/ui/select.tsx` to confirm it cannot be replaced by calculations during render, keeping us aligned with the no-superfluous-`useEffect` guideline.
- [x] Clarify in docs or code comments whether `src/app/api/bets/generate/route.ts` is required for external integrations; if it is internal-only, prefer routing callers through the existing server action to stay aligned with the recommended RSC flow.
