# 06 - Tecnologias Explicadas (Onboarding Completo)

## Cloudflare em produção e staging

Produção e staging executam páginas App Router via vinext/Vite em Workers e armazenam SQLite no Durable Object `MegaSenaData`, acessível pelo binding privado `DATA`. Next standalone + API Bun continua disponível localmente e para recuperação. Critérios de implantação: [DEPLOY.md](../DEPLOY.md).


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

### Bun (`>=1.4.2`) — runtime e SQLite nativo

- **O que é:** runtime JavaScript/TypeScript (alternativa a Node.js) que executa
  `.ts` direto, traz um gerenciador de pacotes e um cliente SQLite embutido.
- **Por que aparece:** o projeto usa `bun:sqlite`, que **só existe no Bun**. Rodar em
  Node falha de propósito com mensagem explícita.
- **Onde:**
  - `package.json` → `"engines": { "bun": ">=1.4.2" }` e `"runtime": "bun"`.
  - `server.ts` → `import { serve } from 'bun'` (servidor HTTP da API).
  - `lib/db.ts` → `const { Database } = require('bun:sqlite')`.
  - `lib/db.ts` → erro deliberado se `bun:sqlite` não existir ("must be run
    with Bun, not Node.js").
  - `bunfig.toml` → `run.noOrphans` (mencionado em `AGENTS.md`) evita processos Bun
    órfãos quando o pai morre.
- **Júnior precisa saber:** pnpm gerencia dependências e Bun executa a aplicação.
  Use `pnpm install`, `bun run dev` e `bun x vitest`.
- Docs: https://bun.sh/docs

### Next.js (`16.4.6`) — framework web (App Router)

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
  - `app/manifest.ts`, `app/robots.ts`, `app/sitemap.xml/route.ts` — metadados e sitemap.
  - `app/dashboard/generator/actions.ts` → `'use server'` (Server Action).
- **Detalhe importante (verificado):** os Server Components **não** falam direto com o
  banco. Eles chamam o servidor Bun via `fetchApi(...)` (ver `app/dashboard/page.tsx`,
  `app/dashboard/statistics/page.tsx`, `app/dashboard/generator/actions.ts`). O motivo
  é manter a API como dona do acesso ao banco. O build do Next roda em Node;
  o servidor standalone de produção, as Server Actions e a API rodam em Bun.
- Docs: https://nextjs.org/docs

### React (`19.3.1`) — biblioteca de UI

- **O que é:** biblioteca de componentes. Versão 19 com Server Components.
- **Por que aparece:** define a fronteira servidor/cliente. Tudo é Server Component a
  menos que precise de interatividade.
- **Onde:** `'use client'` aparece em `components/ui/button.tsx`,
  `components/bet-generator/*`, `components/site-header.tsx`, `components/theme-provider.tsx`,
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
- **Regra do projeto:** proibido `any`; use `unknown` + type guards.

### `bun:sqlite` — banco de dados embutido

- **O que é:** SQLite nativo do Bun, sem compilação.
- **Onde:** `lib/db.ts` (`initializeDatabase`), incluindo os PRAGMAs:
  `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`,
  `busy_timeout = 5000`, `cache_size = -8000`, `wal_autocheckpoint = 1000`,
  `trusted_schema = OFF`, `application_id = 0xA17E6D42` representado como inteiro assinado de 32 bits.
- **Detalhe de teste:** em Vitest, `lib/db.ts` abre um `node:sqlite` `:memory:` com as
  migrações reais. Força o banco Bun em arquivo com `VITEST_FORCE_FILE_DB=1`.

### Zod (`^4.6.7`) — validação de entrada

- **Onde:** `lib/api/handler.ts` define `generateBetsSchema` (orçamento entre
  `BET_GENERATION_LIMITS.MIN_BUDGET` e `MAX_BUDGET`, enums de estratégia/modo) e
  `lib/security/trends-input.ts` define `trendsQuerySchema` (regex de números, período).
  `safeParse` rejeita entradas inválidas com `400`.
- **Por que importa:** é a fronteira de confiança da API. Nenhum corpo/query chega à
  lógica sem passar por Zod.

### TailwindCSS 4.3.5 + tokens semânticos

- **O que é:** CSS utilitário. Versão 4 via `@tailwindcss/postcss`.
- **Onde:** `app/globals.css` (`@import "tailwindcss"`, `@config "../tailwind.config.cjs"`),
  tokens HSL em `:root` e `.dark` (`--background`, `--primary`, `--tint`, etc.),
  `tailwind.config.cjs` (`darkMode: 'class'`, mapeia tokens para classes utilitárias).
- **Regra do projeto:** nunca cores fixas (`text-white`); só tokens (`text-foreground`,
  `bg-background`).

### `class-variance-authority`, `clsx`, `tailwind-merge` (`^3.7.0`)

- **O que é:** sem shadcn/ui nem biblioteca de componentes. O único primitivo é um
  `Button` escrito à mão, com variantes via `cva`.
- **Onde:** `components/ui/button.tsx`. O helper `cn`
  (`lib/utils.ts`) combina `clsx` + `tailwind-merge` para resolver conflitos de classe.

### Sem biblioteca de gráficos

- **Onde:** desde a 1.19.0 as estatísticas são tabelas e listas ranqueadas
  (`app/_components/archive-ui.tsx`) e o volante de 60 (`components/number-field.tsx`);
  `recharts` saiu das dependências. Na 1.20.0 entram figuras SVG renderizadas no
  servidor (`Bar` e `Columns` em `components/figures.tsx`), sem atributo `style` e sem
  JavaScript no cliente; os números de cada figura ficam no texto ao lado.

### lucide-react (`^1.70.0`) — ícones

- **Onde:** só em controles: o menu e o tema (`components/site-header.tsx`,
  `components/theme-toggle.tsx`) e as setas de abrir/fechar (`app/(home)/page.tsx`,
  `app/dashboard/generator/page.tsx`, `app/dashboard/statistics/page.tsx`,
  `components/storage-disclosure.tsx`). Títulos não levam ícones.

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

### Vitest (`5.1.0`) + coverage v8 + Testing Library + jsdom (`^31.0.0`) — testes unitários

- **Onde:** `vitest.config.ts`, `tests/**`, `tests/setup.ts` (cleanup + `stopLogWriter`).
  A cobertura conta só `components/**` e `lib/**`. Os limites ficam em
  `vitest.config.ts` e sobem com a cobertura medida, rumo a 80%; nunca descem. `bun run test:sqlite`
  executa os 12 casos de atraso com Bun/SQLite real, após preparar uma fixture
  descartável com a proteção contra caminhos externos e links simbólicos.

### Playwright (`^1.65.0`) — testes E2E

- **Onde:** `playwright.config.ts`, `tests/app/*.spec.ts` (dashboard, statistics,
  generator, layout, security).
  Nesta revisão, o responsável exige Argent: use o fluxo e as verificações em
  desktop/celular documentados no README; não execute Playwright.

### ESLint 9 (`9.39.5`) + `eslint-config-next` + Prettier — qualidade de código

- **Onde:** `eslint.config.mjs`, `.prettierrc`. `bun run lint` usa `--max-warnings=0`
  (qualquer warning falha).

### Vite (`8.3.7`) + vinext (`1.4.4`) + `@vitejs/plugin-react` — Worker e testes

- **Por que aparece:** o vinext usa o Vite para gerar o Worker que serve produção e
  staging (`vite.config.ts`); o Vitest também roda sobre o Vite, e
  `@vitejs/plugin-react` compila JSX nos testes de componente. O caminho Next/Bun não
  usa o Vite.

---

## Como verificar isso no código

```bash
# Runtime e SQLite nativo
grep -n "bun:sqlite" lib/db.ts
grep -n "\"runtime\"\|engines" package.json

# Fronteira cliente/servidor
grep -rln "'use client'" app components | sort

# Validação Zod
grep -n "z.object\|safeParse" lib/api/handler.ts lib/security/trends-input.ts

# Formatação pt-BR via Intl (não date-fns)
grep -n "Intl\." lib/utils.ts

# Pacotes que não são dependências
grep -rl "framer-motion" app components lib   # esperado: vazio
grep -rl "date-fns" app components lib        # esperado: vazio
```

## Mal-entendidos comuns

- **"É Node.js."** Não. `bun:sqlite` e `Bun.serve` quebram em Node. Use sempre `bun`.
- **"Framer Motion anima a UI."** Não é uma dependência atual do projeto.
- **"Datas usam `date-fns`."** Não é uma dependência atual; a formatação real usa
  `Intl.DateTimeFormat` em `lib/utils.ts`.
- **"`overrides` no `package.json` são preferências."** O pnpm ignora esse campo.
  Os **gates de segurança temporários** efetivos ficam em `pnpm-workspace.yaml`;
  só removê-los quando `pnpm audit` continuar limpo sem eles (`AGENTS.md`).

## Exercícios

1. **(Fácil / compreensão)** Liste, lendo `package.json`, todas as dependências de
   produção e marque cada uma como "importada no código" ou "não encontrada" usando
   `rg -l <pacote> app components lib`. Confira também usos em build e configuração;
   não concluir que um pacote é inútil apenas por não aparecer nesses diretórios.
2. **(Médio / rastreamento)** Partindo de `app/dashboard/statistics/page.tsx`, siga a
   cadeia até o banco: qual função busca os dados? Para qual host/porta? Qual processo
   responde? **Gabarito:** `fetchApi('/api/statistics?...')` → `lib/api/api-fetch.ts`
   (`API_HOST`/`API_PORT`, default `localhost:3201`) → `server.ts` → `apiRoutes`
   `'/api/statistics'` em `lib/api/handler.ts` → `StatisticsEngine` → `bun:sqlite`.
3. **(Médio / mudança)** Adicione um novo token de cor semântico (`--info`) em
   `app/globals.css` (`:root` e `.dark`) e exponha-o em `tailwind.config.cjs`. Use-o em
   um componente sem nenhuma cor fixa. **Aprendizado:** o fluxo "design tokens primeiro,
   componente depois".
4. **(Difícil / investigação)** O projeto tem dois caminhos de build: Next/Bun e
   vinext/Vite. Explique, com base em `vite.config.ts` e `vitest.config.ts`, onde o
   Vite entra em cada um. **Gabarito:** o vinext usa o Vite para gerar o Worker de
   produção e staging; o Vitest roda sobre o Vite; o caminho Next/Bun não o usa.

---

### Procedência das afirmações

- **Verificado no código:** versões e flags em `package.json`; `bun:sqlite` em
  `lib/db.ts`; Zod em `server.ts`; tokens em `globals.css`/`tailwind.config.cjs`;
  `Intl` em `lib/utils.ts`; ausência de imports de `framer-motion`/`date-fns` (grep);
  `server-only` em `log-sink.server.ts`; ausência de `recharts` em `package.json`.
- **Inferido do código:** papel do Vite no Worker e no Vitest (deduzido de
  `vite.config.ts` e `vitest.config.ts`).
- **Conhecimento externo:** descrições gerais de cada biblioteca e links oficiais.
