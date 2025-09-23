## React Server Components & Server Actions Plan

### Applicability to This Project

- Default to Server Components: Project uses Next.js App Router under `src/app`, server by default. Client Components are opt-in and correctly marked with `"use client"` (e.g., `src/components/ui/button.tsx`, `src/components/layout/navigation.tsx`).
- Server Actions: Present in `src/app/generate/actions.ts` with `"use server"`, returning serializable data and calling Prisma-backed services.
- Server-only Modules: Critical data access modules (`src/services/**`, `src/lib/prisma.ts`, `src/data/**`) either import `server-only` or are only used from server contexts. `src/services/bets.ts` and `src/services/bet-store.ts` explicitly import `"server-only"`.
- API vs Server Actions: Internal mutations exist both as Server Action (`generateBetsAction`) and API routes (`/api/bets/generate`, `/api/sync`). This is acceptable for external integrations; app-internal flows should prefer Server Actions.
- Effects & Browser APIs: No stray `useEffect`, `window`, or `document` in Server Components. Client usage is confined to files with `"use client"`.

### Issues Found (fixed now)

- CSS typos in `src/app/globals.css`: `:root` and `::selection` had typos; corrected.
- Next typed route mismatch for `/api/stats/[stat]`: aligned to Next 15 signature using `{ params: Promise<{ stat: string }> }` and preserved strict typing without `any`.

### Current Boundaries Summary

- Client Components: `src/components/ui/button.tsx`, `src/components/layout/navigation.tsx`.
- Server Components: All pages under `src/app/**` that do not declare `"use client"`.
- Server Actions: `src/app/generate/actions.ts`.
- API Routes for external use: `src/app/api/bets/**`, `src/app/api/stats/[stat]`, `src/app/api/sync`.

### Gaps & Recommendations

- Prefer Server Actions for app-internal interactions instead of hitting internal API routes with `fetch`. Keep API routes for external consumers/automation.
- Ensure all data-returning Server Actions and services only return serializable structures. Audit bigints to string when surfacing to Client Components or JSON.
- Document env vars in `README.md` (already present). Keep secrets in `.env.local`.
- Ensure `src/services/stats.ts` BigInt values are normalized when exposed via API (currently cast to Number where applicable; safe for counts; keep care for monetary fields elsewhere).

### TODO (next increments)

1. Add UI that calls `generateBetsAction` via `<form action={...}>` under `src/app/generate/page.tsx` and stream result with `<Suspense>`.
2. Build basic stats UI under `src/app/stats/page.tsx` using Server Components fetching directly from `src/services/stats.ts` (no client fetch needed initially).
3. Add `revalidateTag`/`revalidatePath` strategy for stats when sync runs; consider tagging per stat.
4. Convert any app-internal consumers now using `/api/*` to Server Actions or direct service imports in Server Components.
5. Add tests for `services/stats` and `services/bets` JSON serializability if returned via API/Actions.

### Notes on Hono/Drizzle

- Not used here. If introduced, keep routes thin, validate with Zod, and have Drizzle be the source of truth for types.

### Verification

- `npm run lint`/`typecheck`/`build` pass.
- App Router structure and RSC boundaries are consistent.
