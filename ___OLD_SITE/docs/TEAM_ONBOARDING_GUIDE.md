# Guia Técnico para Novos Integrantes – Mega-Sena Analyzer

> Atualizado em 24/09/2025

Bem-vindo(a) ao time responsável pelo Mega-Sena Analyzer. Este guia consolida os conceitos técnicos, fluxos críticos e práticas de engenharia adotadas no projeto. Utilize-o junto do `docs/INSTALLATION_MANUAL.md`, que cobre o setup local passo a passo.

---

## 1. Visão Geral do Produto

- **Objetivo:** centralizar ingestão de concursos oficiais da Mega-Sena, gerar análises estatísticas e sugerir apostas otimizadas com histórico auditável.
- **Stack principal:** Next.js 15 (App Router com React Server Components), Prisma/SQLite, TypeScript, Tailwind, Vitest.
- **Filosofia:** tratar cliente e servidor como um único programa. Tudo é Server Component por padrão; `"use client"` apenas para interatividade, e Server Actions no lugar de rotas REST internas.

### Principais Rotas (App Router)

| Caminho     | Tipo            | Descrição                                                                       |
| ----------- | --------------- | ------------------------------------------------------------------------------- |
| `/`         | Server          | Landing interna com métricas dinâmicas (frequência, sincronização, preço base). |
| `/stats`    | Server          | Dashboard com gráficos e listas de números quentes/frios.                       |
| `/generate` | Server + Client | Formulário client-side que dispara `generateBetsAction` (Server Action).        |
| `/bets`     | Server          | Listagem de apostas persistidas com seed, orçamento e dezenas.                  |
| `/docs`     | Server          | Hub da documentação interna (`docs/`).                                          |

---

## 2. Arquitetura e Módulos

### 2.1 Camada de UI

- **Server Components:** páginas em `src/app/**` puxam dados diretamente via serviços (`@/services/*`).
- **Client Components:** concentrados em `src/components/forms` e `src/components/layout`. Diretrizes de uso em `docs/THEME-PLAN.md` e `docs/RSC-PLAN.md`.
- **Tokens visuais:** centralizados em `src/app/globals.css` (CSS custom properties) e `tailwind.config.ts`. Utilize `buttonStyles` e `Card` para consistência.

### 2.2 Serviços (Server-only)

| Módulo                          | Função                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `@/services/sync.ts`            | Orquestra ingestão dos concursos (fetch CAIXA, persistência, auditoria).                         |
| `@/services/stats.ts`           | Calcula frequências, pares, quadrantes, recência. Realiza cache in-memory simples.               |
| `@/services/pricing.ts`         | Resolve custos de apostas (`k`) com fallback para `.env`. Exporta `calculateBudgetAllocation`.   |
| `@/services/bets.ts`            | Coração do motor: gera apostas, distribui orçamento, aplica estratégias com PRNG determinístico. |
| `@/services/strategy-limits.ts` | Gerencia limites dinâmicos (k, orçamento, tickets) com auditoria (`BettingLimitAudit`).          |
| `@/services/bet-store.ts`       | Persistência e consulta de apostas (tabelas `Bet` e `BetDezena`).                                |

### 2.3 Estratégias de Aposta

- Localizadas em `src/services/strategies/**` com types em `types.ts`.
- Estratégias atuais: `balanced` (usa frequências, quadrantes e paridade), `uniform` (baseline), `hot-streak` (pondera frequência recente) e `cold-surge` (prioriza dezenas atrasadas).
- Novas estratégias devem retornar `{ dezenas, metadata }`, onde `metadata` segue o schema `docs/data-contracts/strategy_payload.schema.json`.

### 2.4 Dados & ORM

- Prisma schema em `prisma/schema.prisma` (modelo `Draw`, `Bet`, `Price`, `Meta`, etc.).
- Seeds em `prisma/seed.js`. Use `npm run db:seed` após migrations ou reset.
- Conexões Prisma são encapsuladas em `@/lib/prisma`; nunca importar Prisma em Client Components.

### 2.5 Logs

- Pino (`src/lib/logger.ts`). Em runtime Next, o transporte `pino-pretty` está desativado por padrão para evitar bug com Turbopack. Para scripts locais, exporte `LOG_PRETTY=1` antes do comando.

---

## 3. Fluxos Críticos

### 3.1 Sincronização de concursos

1. `npm run sync -- --full --limit=4000` → chama `syncMegaSena`.
2. Serviço busca o concurso mais recente, calcula a janela de backfill (`determineStart`).
3. Cada concurso normalizado é persistido via transação (apaga dezenas/premiações antigas se existir).
4. Metadata `last_sync` é atualizada; caches em `services/stats` são limpos.

> Falhas ou anomalias devem ser registradas em `docs/DEV_SERVER_RECOVERY_PLAN.md`.

### 3.2 Motor de apostas

1. Formulário `/generate` envia `FormData` → `generateBetsAction` valida via Zod.
2. `generateBatch` recebe `budgetCents`, `seed`, `strategies`.
3. Consulta limites dinâmicos (`getBettingLimits`) e chama `calculateBudgetAllocation`.
4. Executa cada estratégia aplicando PRNG para garantir determinismo e evita duplicados via `Set`.
5. Persiste lotes em `Bet` + `BetDezena` e revalida `/bets`.
6. Qualquer exceção vira mensagens amigáveis para o usuário.

### 3.3 UI e Tema

- `src/app/layout.tsx` injeta fontes (Inter) e script inicial para sincronizar tema com `localStorage`/`prefers-color-scheme`.
- Toggle de tema (Client Component) reside em `src/components/layout/theme-toggle.tsx`. Sempre validar hidratação ao introduzir novos Client Components.

---

## 4. Convenções de Código

- **TypeScript estrito** (`tsconfig.json`). Sempre tipar retornos de funções públicas.
- **React Server Components:** leia `docs/RSC-PLAN.md` e `AGENTS.md`. Prefira data fetching direto em Server Components.
- **Diretivas:** `"use client"` ou `"use server"` devem ser a primeira linha do arquivo quando usadas.
- **Estilo:** Tailwind utilitário + tokens customizados. Evite CSS global extra; se necessário, estenda `tailwind.config.ts`.
- **Imports absolutos:** usar alias `@/...` conforme `tsconfig.json`.
- **Comentários:** apenas quando agregarem contexto (evitar óbvios).

---

## 5. Fluxo de Trabalho & Qualidade

1. **Antes de qualquer PR**
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test -- bets strategies pricing`
   - `npm run build`

2. **Documentação obrigatória**
   - Atualizar `docs/` quando alterar regras de negócio, limites, planos ou tokens.
   - Registrar verificações manuais (inputs, edge cases) em PRs até termos suíte de testes e2e.

3. **Commits/PRs**
   - Mensagens no formato imperativo curto (`Add draw frequency table`).
   - PRs devem incluir resumo, evidências (prints/logs), resultados de lint/build e follow-ups.

4. **Branches**
   - Base: `main`. Use feature branches (`feature/stage6-stats`) e abra PR para `main`.

5. **Hooks Husky**
   - `pre-commit` executa `lint-staged` (ESLint + Prettier). Corrija toda saída antes de prosseguir.

---

## 6. Padrões de Observabilidade

- Logs JSON (Pino). Em produção, usar agregação centralizada (config futura).
- Métricas futuras previstas no `docs/PHASE5_STAGE6_ROADMAP.md` (observabilidade e backtesting).
- Para inspeção manual durante dev, habilite `LOG_PRETTY=1` e use `jq` ou `grep` para filtrar.

---

## 7. Segurança e Configurações

- Segredos devem permanecer em `.env.local` (não versionado).
- Tokens externos (ex.: APIs CAIXA) precisam ser documentados em `docs/` com propósito e limite de rate.
- Jamais chamar ORM diretamente em Client Components; validar via TypeScript/ESLint é fundamental.

---

## 8. Recursos Complementares

| Documento                              | Conteúdo                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/INSTALLATION_MANUAL.md`          | Guia completo de setup local e backfill de dados.                                  |
| `docs/DEV_SERVER_RECOVERY_PLAN.md`     | Playbook para erros do dev server (`_buildManifest.js.tmp`, Turbopack vs Webpack). |
| `docs/GENERATE_PAGE_DIAGNOSIS_PLAN.md` | Diagnóstico contínuo da rota `/generate`.                                          |
| `docs/THEME-PLAN.md`                   | Diretrizes de design e componentes visuais.                                        |
| `docs/STAGE6_UI_DELIVERY_PLAN.md`      | Roadmap atual da interface (Stage 6).                                              |
| `docs/PROMPT MEGASENA APP.md`          | Prompt operacional com restrições funcionais.                                      |

---

## 9. Checklist inicial para novos membros

1. Completar o setup local (`docs/INSTALLATION_MANUAL.md`).
2. Rodar `npm run sync -- --full --limit=4000`.
3. Validar `/generate` (orçamento padrão + customizado) e `/bets`.
4. Ler `docs/STAGE6_UI_DELIVERY_PLAN.md` + roadmap Stage 6.
5. Escolher item do backlog/roadmap e anunciar no canal interno.
6. Criar branch feature e iniciar a tarefa seguindo as práticas descritas aqui.

---

## 10. Contato e suporte

- **Canal interno:** `#megasena-app` (Slack/Teams) para dúvidas técnicas.
- **Responsável atual:** React Server Components Expert (Codex). Atualize este documento ao transferir ownership.

Boas contribuições! Lembre-se de manter a documentação viva e focar na confiabilidade do motor antes de introduzir novas features.
