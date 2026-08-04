# 06 - Tecnologias Explicadas (Onboarding Completo)

> Trilha de onboarding do **sistema** (código como fonte primária). Para a trilha de
> **matemática da loteria**, veja `chapter-01-introduction.md` ... `chapter-08-testing.md`.

## O que este capítulo ensina

Cada tecnologia real do projeto: o que é, por que está aqui, **onde** aparece no
código, e o mínimo que um júnior precisa saber para não quebrar nada.

## Por que isso importa

Você vai abrir `package.json` e ver 30+ pacotes. Sem um mapa, é fácil supor que
tudo é usado, ou copiar um padrão de um tutorial que não se aplica a este runtime.
Duas armadilhas concretas deste repositório: ele **não roda em Node.js** (depende de
`bun:sqlite`), e há **dependências declaradas que o código não importa**. Saber disso
evita horas perdidas.

## Modelo mental

Pense em três camadas:

1. **Runtime e dados** — Bun executa tudo; `bun:sqlite` guarda os sorteios.
2. **Web** — Next.js 16 (App Router) renderiza no servidor; React 19 hidrata só o
   que é interativo; um servidor Bun separado (`server.ts`) expõe a API JSON.
3. **Qualidade e segurança** — TypeScript, Zod, Vitest, Playwright, ESLint, mais
   helpers próprios de CSP, pseudonimização e sanitização.

---

## Explicação detalhada (por tecnologia)

### Bun (`>=1.3.14`) — runtime, gerenciador de pacotes e SQLite nativo

- **O que é:** runtime JavaScript/TypeScript (alternativa a Node.js) que executa
  `.ts` direto, traz um gerenciador de pacotes e um cliente SQLite embutido.
- **Por que aparece:** o projeto usa `bun:sqlite`, que **só existe no Bun**. Rodar em
  Node falha de propósito com mensagem explícita.
- **Onde:**
  - `package.json` → `"engines": { "bun": ">=1.3.14" }` e `"runtime": "bun"`.
  - `server.ts:7` → `import { serve } from 'bun'` (servidor HTTP da API).
  - `lib/db.ts:665` → `const { Database } = require('bun:sqlite')`.
  - `lib/db.ts:679-686` → erro deliberado se `bun:sqlite` não existir ("must be run
    with Bun, not Node.js").
  - `bunfig.toml` → `run.noOrphans` (mencionado em `AGENTS.md`) evita processos Bun
    órfãos quando o pai morre.
- **Júnior precisa saber:** pnpm gerencia dependências e Bun executa a aplicação.
  Use `pnpm install`, `bun run dev` e `bun x vitest`.
- Docs: https://bun.sh/docs

### Next.js (`16.3.0`) — framework web (App Router)

- **O que é:** framework React full-stack. Aqui usado em modo **App Router** com
  `output: standalone`.
- **Por que aparece:** renderização no servidor (RSC), Server Actions, geração de
  metadados/imagens, e o middleware de segurança (CSP por requisição).
- **Onde:**
  - `app/` — rotas (App Router). Cada `page.tsx` é um Server Component por padrão.
  - `proxy.ts` — **middleware** do Next 16. No Next 16 o arquivo de middleware foi
    renomeado de `middleware.ts` para `proxy.ts`; a função exportada chama-se `proxy`.
    Gera o nonce CSP e injeta os headers de segurança.
  - `app/icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`,
    `app/apple-icon.tsx` — usam `next/og` (`ImageResponse`) para gerar PNG/OG.
  - `app/manifest.ts`, `app/robots.ts`, `app/sitemap.ts` — route handlers de metadados.
  - `app/dashboard/generator/actions.ts` → `'use server'` (Server Action).
- **Detalhe importante (verificado):** os Server Components **não** falam direto com o
  banco. Eles chamam o servidor Bun via `fetchApi(...)` (ver `app/dashboard/page.tsx`,
  `app/dashboard/statistics/page.tsx`, `app/dashboard/generator/actions.ts`). O motivo
  está comentado em `actions.ts`: Server Actions rodam em Node, mas o banco exige Bun.
- Docs: https://nextjs.org/docs

### React (`19.2.6`) — biblioteca de UI

- **O que é:** biblioteca de componentes. Versão 19 com Server Components.
- **Por que aparece:** define a fronteira servidor/cliente. Tudo é Server Component a
  menos que precise de interatividade.
- **Onde:** `'use client'` aparece em `components/ui/*`, `components/charts/*`,
  `components/bet-generator/*`, `components/theme-provider.tsx`,
  `components/storage-disclosure.tsx`, `app/dashboard/generator/generator-form.tsx`,
  e nos `error.tsx` (error boundaries exigem cliente).
- **Júnior precisa saber:** só marque `'use client'` quando houver `useState`,
  `useEffect`, handlers de evento (`onClick`) ou APIs de browser (`localStorage`,
  `navigator.clipboard`).
- Docs: https://react.dev

### TypeScript (`5.9.3`, strict) — tipagem estática

- **Onde:** `tsconfig.json` (`"strict": true`); tipos de retorno explícitos em funções
  exportadas (ex.: `lib/analytics/statistics.ts` exporta interfaces `DrawStatistics`,
  `NumberFrequency`, `Pattern`).
- **Regra do projeto:** proibido `any`; use `unknown` + type guards (ver
  `toNumberValue` em `lib/db.ts:934`).

### `bun:sqlite` — banco de dados embutido

- **O que é:** SQLite nativo do Bun, sem compilação.
- **Onde:** `lib/db.ts:661-689` (`initializeDatabase`), incluindo os PRAGMAs:
  `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`,
  `busy_timeout = 5000`, `cache_size = -8000`, `wal_autocheckpoint = 1000`,
  `trusted_schema = OFF`, `application_id = 0xA17E6D42`.
- **Detalhe de teste:** em Vitest, `lib/db.ts` substitui o SQLite por uma
  `InMemoryDatabase` (linhas 132-549) que normaliza SQL em memória. Força banco real
  com `VITEST_FORCE_FILE_DB=1`.

### Zod (`^3.24.1`) — validação de entrada

- **Onde:** `server.ts:65-77` define `generateBetsSchema` (orçamento 6..1.000.000,
  enums de estratégia/modo) e `trendsQuerySchema` (regex de números, período).
  `safeParse` rejeita entradas inválidas com `400`.
- **Por que importa:** é a fronteira de confiança da API. Nenhum corpo/query chega à
  lógica sem passar por Zod.

### TailwindCSS v4 + tokens semânticos

- **O que é:** CSS utilitário. Versão 4 via `@tailwindcss/postcss`.
- **Onde:** `app/globals.css` (`@import "tailwindcss"`, `@config "../tailwind.config.js"`),
  tokens HSL em `:root` e `.dark` (`--background`, `--primary`, `--chart-1..5`, etc.),
  `tailwind.config.js` (`darkMode: 'class'`, mapeia tokens para classes utilitárias).
- **Regra do projeto:** nunca cores fixas (`text-white`); só tokens (`text-foreground`,
  `bg-background`).

### shadcn/ui (padrão), `class-variance-authority`, `clsx`, `tailwind-merge`

- **O que é:** componentes copiados para o repo (não um pacote), construídos com `cva`
  para variantes.
- **Onde:** `components/ui/*` (button, card, input, badge, label). O helper `cn`
  (`lib/utils.ts`) combina `clsx` + `tailwind-merge` para resolver conflitos de classe.

### Recharts (`^3.8.1`) — gráficos

- **Onde:** `components/charts/bar-chart.tsx`, `donut-chart.tsx`, `line-chart.tsx`
  (todos `'use client'`). `bar-chart` e `donut-chart` incluem uma lista `sr-only` para
  acessibilidade; `line-chart` não tem esse fallback (ver Mal-entendidos).

### lucide-react (`^0.462.0`) — ícones

- **Onde:** importado em ~15 arquivos de `app/` e `components/` (ex.: ícone `Info` no
  card de "atualização" da página de estatísticas).

### Intl API (nativa) — formatação pt-BR (NÃO `date-fns`)

- **Onde:** `lib/utils.ts` → `formatCurrency` (`Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`),
  `formatNumber` (`Intl.NumberFormat('pt-BR')`), `formatDate` (`Intl.DateTimeFormat('pt-BR', ...)`),
  `formatPercentage`.
- **Importante:** a formatação de datas usa `Intl`, não `date-fns`.

### `node:crypto` — hashing e HMAC

- **Onde:** `lib/security/pseudonymize.ts` (`createHmac`, `createHash`, `timingSafeEqual`);
  `crypto.randomUUID()` em `server.ts` (requestId) e `bet-generator.ts` (id da aposta).

### `server-only` (`^0.0.1`) — fronteira servidor

- **Onde:** `lib/log-sink.server.ts`. Garante (em build) que o módulo nunca seja
  importado no bundle do cliente.

### Vitest (`4.1.5`) + coverage v8 + Testing Library + jsdom — testes unitários

- **Onde:** `vitest.config.ts`, `tests/**`, `tests/setup.ts` (cleanup + `stopLogWriter`).
  Threshold de cobertura 80% (ver `CLAUDE.md` e `vitest.config.ts`).

### Playwright (`^1.57.0`) — testes E2E

- **Onde:** `playwright.config.ts`, `tests/app/*.spec.ts` (dashboard, statistics,
  generator, layout, security).

### ESLint 9 + `eslint-config-next` + Prettier — qualidade de código

- **Onde:** `eslint.config.mjs`, `.prettierrc`. `bun run lint` usa `--max-warnings=0`
  (qualquer warning falha).

### Vite 8 + `@vitejs/plugin-react` — infraestrutura de teste

- **Por que aparece:** Vitest usa o Vite por baixo; `@vitejs/plugin-react` compila JSX
  nos testes de componente. Não serve a aplicação em produção (quem serve é Next/Bun).

---

## Como verificar isso no código

```bash
# Runtime e SQLite nativo
grep -n "bun:sqlite" lib/db.ts
grep -n "\"runtime\"\|engines" package.json

# Fronteira cliente/servidor
grep -rln "'use client'" app components | sort

# Validação Zod
grep -n "z.object\|safeParse" server.ts

# Formatação pt-BR via Intl (não date-fns)
grep -n "Intl\." lib/utils.ts

# Dependências declaradas porém NÃO importadas
grep -rl "framer-motion" app components lib   # esperado: vazio
grep -rl "date-fns" app components lib        # esperado: vazio
```

## Mal-entendidos comuns

- **"É Node.js."** Não. `bun:sqlite` e `Bun.serve` quebram em Node. Use sempre `bun`.
- **"Framer Motion anima a UI."** O `CLAUDE.md` afirma isso, mas **nenhum arquivo de
  `app/`, `components/` ou `lib/` importa `framer-motion`** (verificado por grep).
  Trate como dependência declarada e não usada (ver `09-open-questions-and-risks.md`).
- **"Datas usam `date-fns`."** Também declarada e não importada; a formatação real é
  `Intl.DateTimeFormat` em `lib/utils.ts`.
- **"`overrides` no `package.json` são preferências."** São **gates de segurança
  temporários** (pins de `ajv`, `minimatch`, `ws`, etc.); só removê-los quando
  `bun audit` continuar limpo sem eles (`AGENTS.md`).
- **"Os gráficos são todos acessíveis igualmente."** `line-chart.tsx` não tem o
  fallback `sr-only` que `bar-chart`/`donut-chart` têm.

## Exercícios

1. **(Fácil / compreensão)** Liste, lendo `package.json`, todas as dependências de
   produção e marque cada uma como "importada no código" ou "não encontrada" usando
   `grep -rl <pacote> app components lib`. Esperado: encontrar pelo menos duas não
   usadas. **Gabarito:** `framer-motion` e `date-fns`.
2. **(Médio / rastreamento)** Partindo de `app/dashboard/statistics/page.tsx`, siga a
   cadeia até o banco: qual função busca os dados? Para qual host/porta? Qual processo
   responde? **Gabarito:** `fetchApi('/api/statistics?...')` → `lib/api/api-fetch.ts`
   (`API_HOST`/`API_PORT`, default `localhost:3201`) → `server.ts` handler
   `'/api/statistics'` → `StatisticsEngine` → `bun:sqlite`.
3. **(Médio / mudança)** Adicione um novo token de cor semântico (`--info`) em
   `app/globals.css` (`:root` e `.dark`) e exponha-o em `tailwind.config.js`. Use-o em
   um componente sem nenhuma cor fixa. **Aprendizado:** o fluxo "design tokens primeiro,
   componente depois".
4. **(Difícil / investigação)** O projeto declara `vite` e `@vitejs/plugin-react` como
   devDependencies, mas serve a aplicação com Next/Bun. Explique, com base em
   `vitest.config.ts`, por que o Vite ainda é necessário. **Gabarito:** Vitest roda
   sobre o Vite; o plugin React compila JSX nos testes de componente.

---

### Procedência das afirmações

- **Verificado no código:** versões e flags em `package.json`; `bun:sqlite` em
  `lib/db.ts`; Zod em `server.ts`; tokens em `globals.css`/`tailwind.config.js`;
  `Intl` em `lib/utils.ts`; ausência de imports de `framer-motion`/`date-fns` (grep);
  `server-only` em `log-sink.server.ts`; charts em `components/charts/*`.
- **Inferido do código:** papel do Vite como infraestrutura do Vitest (deduzido de
  `vitest.config.ts` + ausência de uso em runtime).
- **Conhecimento externo:** descrições gerais de cada biblioteca e links oficiais.
