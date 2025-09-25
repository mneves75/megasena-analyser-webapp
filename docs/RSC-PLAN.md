## React Server Components & Server Actions Plan

### Applicability to This Project

- Default to Server Components: Project uses Next.js App Router under `src/app`, server by default. Client Components are opt-in and correctly marked with `"use client"` (e.g., `src/components/ui/button.tsx`, `src/components/layout/navigation.tsx`).
- Server Actions: Present in `src/app/generate/actions.ts` with `"use server"`, returning serializable data and calling Prisma-backed services.
- Server-only Modules: Critical data access modules (`src/services/**`, `src/lib/prisma.ts`, `src/data/**`) either import `server-only` or are only used from server contexts. `src/services/bets.ts` and `src/services/bet-store.ts` explicitly import `"server-only"`.
- API vs Server Actions: Internal mutations exist both as Server Action (`generateBetsAction`) and API routes (`/api/bets/generate`, `/api/sync`). This is acceptable for external integrations; app-internal flows should prefer Server Actions.
- Effects & Browser APIs: No stray `useEffect`, `window`, or `document` in Server Components. Client usage is confined to files with `"use client"`.

### Fresh Eyes Findings · 23/09/2025

- **Client / Server boundaries seguem o guia**: apenas `navigation`, `button`, `theme-toggle` estão marcados com `"use client"`; todas usam apenas APIs de navegador. Componentes de página continuam server-first.
- **Server Actions**: `generateBetsAction` continua serializando adequadamente (`StrategyPayload`). Nenhuma fuga de BigInt ou Map para o cliente.
- **Typed route handler**: `/api/stats/[stat]` exige `{ params: Promise<{ stat: string }> }` por contrato Next 15. Mantivemos `await params` e documentamos para evitar regressões futuras.
- **Global Theme**: tokens atualizados em `globals.css` + script `beforeInteractive` eliminam FOUC. `ThemeToggle` se limita ao cabeçalho do `AppShell`, mantendo lógica cliente isolada.
- **Bet persistence**: `strategy_payload` guarda snapshots completos; recomendo auditar tamanho quando tickets >100 (ver roadmap Stage 6).

### Regression Watch

- `persistBatch` grava `total_cost_cents` por ticket (valor unitário). Confirmar se desejo era custo do lote inteiro; decidir antes de expor na UI `/bets`.
- `ThemeToggle` usa ícones emoji. Se o design exigir ícones vetoriais, migrar para Lucide e garantir `aria-pressed`.
- Monitorar crescimento de `statsCache` (in-memory). Hoje o sync limpa via `clearStatsCache`, mas um cron de longa duração deve prever TTL.

### Current Boundaries Summary

- Client Components: `src/components/ui/button.tsx`, `src/components/layout/navigation.tsx`, `src/components/layout/theme-toggle.tsx`.
- Server Components: All pages under `src/app/**` that do not declare `"use client"`.
- Server Actions: `src/app/generate/actions.ts`.
- API Routes for external use: `src/app/api/bets/**`, `src/app/api/stats/[stat]`, `src/app/api/sync`.

### Gaps & Recommendations

- Prefer Server Actions for app-internal interactions instead of hitting internal API routes with `fetch`. Keep API routes for external consumers/automation.
- Ensure all data-returning Server Actions and services only return serializable structures. Audit bigints to string when surfacing to Client Components or JSON.
- Document env vars in `README.md` (already present). Keep secrets in `.env.local`.
- Ensure `src/services/stats.ts` BigInt values are normalized when exposed via API (currently cast to Number where applicable; safe for counts; keep care for monetary fields elsewhere).

### TODO (próximos incrementos)

1. **Generate UI Server-first** – Montar `<form action={generateBetsAction}>` em `app/generate/page.tsx` com streaming e exibição de `payload`/avisos (evitar `fetch` lado cliente).
2. **Stats dashboard server-side** – `app/stats/page.tsx` deve consumir `getFrequencies`, `getPairs` etc direto no servidor com seções suspensas.
3. **Persistência de lotes** – Decidir se `total_cost_cents` deve refletir custo do bilhete ou do lote; alinhar schema/seed e atualizar testes.
4. **Auditoria CLI** – Adicionar teste de fumaça para `scripts/limits.ts` (via Vitest + `execa`) garantindo `--set`/`--reset`.
5. **Documentar typed routes** – Registrar em `docs/PHASE5_STAGE6_ROADMAP.md` ou README o motivo do `Promise` em handlers (bloqueio para futuros PRs).
6. **Iconografia do tema** – Se migrar para ícones, adicionar `aria-pressed` e contraste mínimo AA.

### Notes on Hono/Drizzle

- Not used here. If introduced, keep routes thin, validate with Zod, and have Drizzle be the source of truth for types.

### Verification

- `npm run lint`, `npm run build` (23/09/2025) executados após auditoria.
- Estrutura App Router permanece consistente com RSC; nenhum módulo cliente importa Prisma/env.
