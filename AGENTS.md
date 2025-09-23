# Repository Guidelines

## Project Structure & Module Organization

- App Router code lives in `src/app`; group routes, server actions, and UI components by feature.
- Introduce `src/lib` once multiple features share analytics helpers; keep accompanying notes in `docs/`.
- Global styles stay in `src/app/globals.css`, and all static assets or mock CSVs belong in `public/` for root-level serving.
- Capture planning updates and data dictionaries in `docs/` whenever you add a new lottery model or pipeline.

## Build, Test, and Development Commands

- `npm run dev` launches the Turbopack dev server with hot reload.
- `npm run build` generates the production bundle; run it before every push or PR.
- `npm run start` serves the built output for smoke tests.
- `npm run lint` runs ESLint with the Next.js config; treat warnings as blockers.
- `npm run typecheck` and `npm run format` ensure tipos e estilo estão em ordem antes do PR.

## Coding Style & Naming Conventions

- Write TypeScript and default to React Server Components; adicione `"use client"` apenas quando browser APIs ou estado local forem necessários.
- Keep 2-space indentation, rely on format-on-save, and let ESLint handle spacing and import order.
- Use `kebab-case` for files and directories (`draw-frequency-table.tsx`). Favor Tailwind utilities and extend the Tailwind config instead of adding global CSS.

## Testing Guidelines

- Automated tests are not configured yet; place new specs as `*.test.ts(x)` beside the code or under `src/__tests__/` and register the script in `package.json`.
- Cover deterministic logic first (e.g., probability aggregations) and ship lightweight fixtures near the tests or in `public/mock-data/`.
- Until a runner exists, document manual verification—inputs tried, edge cases, screenshots—in every PR.

## Commit & Pull Request Guidelines

- Current history only shows the scaffold commit (`Initial commit from Create Next App`); continue using concise, imperative subjects such as `Add draw frequency table`.
- Reference issue IDs when applicable and keep bodies focused on rationale, risk, and rollout.
- PRs must report lint/build status, summarize changes, attach UI screenshots for visual updates, list follow-up tasks, and request at least one reviewer (two when data flows change).

## Security & Configuration Tips

- Store secrets in `.env.local`; never commit environment files. Document variable purpose and defaults in `README.md`.
- When adding external lottery APIs, record authentication steps, rate limits, and failure handling in `docs/` so collaborators can reproduce safely.

# Guia para Agentes · React Server Components

## Persona & Filosofia

- Aja como especialista em Next.js App Router, tratando cliente e servidor como um único programa.
- `'use client'` abre uma porta para rodar UI no navegador; `'use server'` expõe chamadas RPC tipadas a partir do cliente.
- Priorize componentes de servidor e mova lógica de banco/estatística para módulos server-only (`@/data`, `@/lib`).

## `'use client'` — Quando e Como

- Use apenas se houver eventos, estado, `useEffect`, APIs do navegador ou bibliotecas imperativas.
- A diretiva deve ser a primeira linha do arquivo; mantenha props serializáveis (strings, numbers, boolean, arrays, objetos plain).
- Extraia utilitários puros para módulos compartilhados e passe dados via props ou contextos cliente.

## `'use server'` — Server Actions

- Coloque `'use server'` na primeira linha do arquivo de ações; exporte funções `async` que retornem dados serializáveis.
- Utilize formulários (`<form action={serverAction}>`) ou `useTransition` para estados de envio e chame `revalidatePath`/`revalidateTag` após mutações.
- Encapsule acesso a Prisma/SQLite, secrets e cálculos pesados nesses módulos.

## Padrões Recomendados no App Router

- Carregue dados diretamente em Server Components (`await` no topo) e use `cache()`/`revalidatePath` quando precisar de reutilização.
- Organize arquivos por feature (`app/feature/page.tsx`, `app/feature/actions.ts`) e mantenha providers cliente isolados.
- Prefira streaming com `<Suspense>` + `loading.tsx` para seções pesadas.

## Serialização & Segurança

- Converta `Date` para ISO e `BigInt` para string antes de enviar para o cliente; evite `Map`/`Set` e instâncias personalizadas.
- Nunca importe ORM ou env vars direto em módulos cliente.
- Registre metadados de ingestão em tabelas (`meta`) e invalide caches após sincronizar concursos.

## Diretrizes para `useEffect`

- Leia [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).
- Evite efeitos para transformação de dados, eventos ou estado derivado; prefira cálculos durante render ou hooks puros.
- Use `useEffect` apenas para integrar sistemas externos, timers, listeners globais ou sincronização com storage local, sempre com cleanup.

## Anti-patterns a evitar

- Marcar arquivos com `'use client'` por conveniência.
- Repetir `fetch` em Client Components para dados que poderiam ser carregados no servidor.
- Passar funções/objetos não serializáveis entre client/server.
- Criar API Routes internas quando Server Actions resolvem o fluxo.

## Checklist Antes do PR

- [ ] Módulos cliente começam com `'use client'` e contêm apenas lógica necessária no navegador.
- [ ] Server Actions retornam objetos serializáveis e acionam revalidações apropriadas.
- [ ] Consultas a banco estão em módulos server-only; nada de ORM em componentes cliente.
- [ ] Não há `useEffect` supérfluo e os restantes têm justificativa clara.
- [ ] Exemplos e importações seguem o padrão do projeto (`app/`, `@/lib`, `@/data`).
