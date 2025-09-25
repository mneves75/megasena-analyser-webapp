# RSC Compliance Audit Plan & TODO

## Plan

1. Catalogue all modules that declare `'use client'` and confirm they only depend on client-safe utilities.
2. Audit server actions and data services for `'use server'`/`"server-only"` boundaries and verify they return serializable payloads.
3. Trace data passed from server components to client components to ensure props remain JSON-serializable (Dates converted, Maps avoided).
4. Review every `useEffect` usage to ensure it matches the "You Might Not Need an Effect" guidance and document any unavoidable effects.
5. Document outcomes and open follow-up tasks so future contributors can close the remaining gaps.

## TODO

- [ ] Relocate shared `StrategyMetadata`-related types to a neutral module (e.g. `src/types/strategies.ts`) so client components (`src/components/bets/tickets-grid.tsx`, `src/components/bets/ticket-metadata-dialog.tsx`) no longer import the `"server-only"` module `@/services/strategies/types`.
- [ ] Revisit the derived state/effect combo in `src/components/ui/select.tsx` to confirm it cannot be replaced by calculations during render, keeping us aligned with the no-superfluous-`useEffect` guideline.
- [ ] Clarify in docs or code comments whether `src/app/api/bets/generate/route.ts` is required for external integrations; if it is internal-only, prefer routing callers through the existing server action to stay within the recommended RSC flow.
