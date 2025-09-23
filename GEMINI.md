# GEMINI.md

Diretrizes para agentes Gemini Code atuarem neste repositório.

## Visão geral do projeto

- Aplicação Next.js 15 (App Router) com React 19, TypeScript e TailwindCSS 4.
- Banco SQLite gerenciado via Prisma (`prisma/schema.prisma`).
- Análises estatísticas e motor de apostas residem em `src/services/` e `src/lib/`.

## Comandos úteis

- `npm run dev` — inicia o servidor com Turbopack.
- `npm run lint` — ESLint com `--max-warnings=0` (falha em qualquer aviso).
- `npm run test -- <pattern>` — Vitest ambiente Node; alias `@` aponta para `src/`.
- `npm run build` / `npm run start` — gerar e validar o bundle de produção.

## Convenções fundamentais

- Priorizar React Server Components; só use `'use client'` para interatividade ou APIs do navegador.
- Importar `"server-only"` em serviços que dependem de Prisma ou secrets (`src/services/**`).
- Arquivos e diretórios em `kebab-case`; indentação de 2 espaços.
- Variáveis de ambiente sensíveis ficam fora do versionamento (`.env.sample` lista defaults).

## Estrutura principal

- `src/app/` — rotas, layouts e server actions.
- `src/services/` — módulos de domínio (stats, pricing, strategies, sync).
- `src/lib/` — utilidades compartilhadas (ex.: PRNG determinístico em `random.ts`).
- `docs/` — planos de fase, guias de estratégia (`docs/strategies/balanced.md`) e testes manuais.

## Boas práticas específicas

- Sempre reutilizar `@/lib/prisma` em código server-side; nunca importar Prisma em componentes cliente.
- Registrar seeds e fontes no banco (`Meta`, `Price`) e atualizar documentação correspondente.
- Preferir Server Actions a rotas REST internas para comunicação client→server.
- Manter testes determinísticos usando seeds fixas e bancos SQLite efêmeros.

## Pull Requests

- Confirmar `npm run lint`, `npm run test`, `npm run build` antes de abrir PR.
- Descrever mudanças, riscos e follow-ups; anexar evidências (logs, prints) quando houver alterações visuais.
- Atualizar `docs/` sempre que regras de negócio ou contratos mudarem.

## Contatos úteis

- Planejamento da Fase 5: `docs/PHASE5_STRATEGY_PLAN.md` e `docs/PHASE5_REVIEW_TODO.md`.
- Estratégias de apostas: `src/services/strategies/**`.
- Testes manuais: `docs/testing/strategies.md`.

Siga estas orientações para manter consistência entre agentes (Claude, GPT, Gemini) e assegurar que o projeto continue alinhado à arquitetura React Server Components.
