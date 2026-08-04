# 08 - Exercícios

## O que este capítulo ensina

Exercícios práticos por capítulo, do entendimento à mudança real. Cada um tem
objetivo, arquivos iniciais, aprendizado esperado, dificuldade e gabarito.

## Por que isso importa

Você só entende um sistema quando consegue alterá-lo com segurança. Estes exercícios
forçam leitura ativa e mudanças pequenas e verificáveis.

> Antes de qualquer mudança: `pnpm install`, `bun run db:migrate`,
> `bun run db:pull -- --limit 100`. Valide com `bun run lint`, `bun x tsc --noEmit`,
> `bun run test -- --run`.

---

## Capítulo 01 - Visão geral

1. **Mapear as rotas** · Dificuldade: fácil · Arquivos: `server.ts`.
   - Objetivo: listar as 5 rotas e seus métodos a partir de `apiHandlers` e
     `apiAllowedMethods`.
   - Aprendizado: a superfície real da API.
   - Gabarito: `/api/health` GET, `/api/dashboard` GET, `/api/statistics` GET,
     `/api/trends` GET, `/api/generate-bets` POST.
2. **Traçar o gerador** · Médio · `generator-form.tsx`, `actions.ts`, `server.ts`.
   - Objetivo: documentar o caminho do clique "Gerar" até o `BetGenerator`.
   - Gabarito: form (cliente) → Server Action `generateBets` → `fetchApi POST
     /api/generate-bets` → handler → `BetGenerator.generateOptimizedBets`.
3. **Provar a separação de processos** · Médio · `scripts/dev.ts`, `next.config.js`.
   - Objetivo: explicar por que existem portas 3000 e 3201.
   - Gabarito: Next (3000) renderiza; Bun (3201) tem o banco; rewrite liga os dois.

## Capítulo 02 - Mapa do repositório

1. **Mapear scripts** · Fácil · `package.json`, `scripts/`.
   - Objetivo: para cada script npm, achar o `.ts` correspondente.
2. **Achar o dono** · Médio · repositório.
   - Objetivo: dado "mudar limite de tamanho do corpo da requisição", localizar o
     arquivo. Gabarito: `server.ts` (`MAX_REQUEST_BODY_SIZE`) + `lib/security/http.ts`
     (`readJsonBodyWithLimit`).
3. **Trilha dupla** · Fácil · `docs/learn/`.
   - Objetivo: diferenciar a trilha de sistema (`01`–`10`) da de matemática
     (`chapter-*`).

## Capítulo 03 - Runtime

1. **Encontrar o fail-closed** · Médio · `server.ts`.
   - Objetivo: localizar onde a produção recusa iniciar sem `IP_HASH_SECRET` e explicar
     por que isso vem antes das migrations. Gabarito: bloco `process.exit(1)` antes de
     `runMigrations()` — evita mutar o banco em deploy mal configurado.
2. **Rate limit no health** · Fácil · `server.ts`.
   - Objetivo: provar que `/api/health` está sujeito ao rate limit.
3. **Mudança segura de shutdown** · Difícil · `lib/process-lifecycle.ts`, `tests/lib/process-lifecycle.test.ts`.
   - Objetivo: aumentar o `graceMs` padrão e ajustar o teste; rodar `bun x vitest
     tests/lib/process-lifecycle.test.ts --run`.
   - Aprendizado: por que esperar `proc.exited` (não `proc.killed`) em Bun.

## Capítulo 04 - Fluxo de dados / MER

1. **Reconstruir o MER** · Médio · `db/migrations/*.sql`.
   - Objetivo: desenhar tabelas e marcar caches; confirmar que não há FKs.
2. **Bug de cache** · Médio · `scripts/pull-draws.ts`, `lib/analytics/statistics.ts`.
   - Objetivo: explicar por que frequências podem ficar desatualizadas. Gabarito: faltou
     `updateNumberFrequencies()`.
3. **Defesa em profundidade** · Difícil · `db/migrations/007_draw_number_integrity.sql`.
   - Objetivo: escrever um teste que tente inserir um sorteio com números repetidos e
     espere `ABORT`. Use banco real (`VITEST_FORCE_FILE_DB=1`).

## Capítulo 05 - Subsistemas

1. **Estratégias do gerador** · Fácil · `bet-generator.ts`.
2. **Custo por engine** · Médio · `lib/analytics/*`.
   - Objetivo: classificar cada engine como "1 query", "full scan + JS" ou "chatty".
3. **Nova flag de estatística** · Difícil · `server.ts`, `complexity-score.ts`.
   - Objetivo: adicionar `?complexity=true` retornando o score de `[5,10,23,34,45,60]`.
   - Aprendizado: como uma nova capacidade entra na API sem tocar o banco.

## Capítulo 06 - Tecnologias

1. **Dependências não usadas** · Fácil · `package.json`.
   - Gabarito: `framer-motion`, `date-fns`.
2. **Token de design** · Médio · `globals.css`, `tailwind.config.js`.
   - Objetivo: criar `--info` e usá-lo sem cor fixa.
3. **Por que Vite?** · Difícil · `vitest.config.ts`.
   - Gabarito: Vitest roda sobre Vite; plugin React compila JSX nos testes.

## Capítulo 07 - Operações

1. **Portões pós-deploy** · Fácil · `package.json`.
   - Gabarito: `deploy:verify` e `security:csp:edge`.
2. **Banco isolado de E2E** · Médio · `playwright.config.ts`, `prepare-e2e-db.ts`.
   - Objetivo: dizer onde o banco de E2E é criado e quais sorteios fixos entram.
3. **Quebrar e consertar o build** · Difícil · `scripts/assert-standalone-clean.ts`.
   - Objetivo: simular um `.db` em `.next/standalone/db/` e ver o build falhar; depois
     remover e ver passar.

## Capítulo 10 - LGPD

1. **Inventário de dados** · Fácil · `components/theme-provider.tsx`,
   `components/storage-disclosure.tsx`, `server.ts`.
   - Objetivo: listar todo dado pessoal (2 chaves `localStorage` + IP pseudonimizado +
     user-agent).
2. **Pseudonimização** · Médio · `lib/security/pseudonymize.ts`.
   - Objetivo: explicar a janela de salt de 30 dias e o efeito de trocar
     `IP_HASH_SECRET`.
3. **Fechar uma lacuna** · Difícil · `lib/log-store.ts`, `lib/security/sanitize-metadata.ts`.
   - Objetivo: chamar `sanitizeStructuredMetadata` dentro de `buildLogRow` (defesa em
     profundidade) e cobrir com teste. Veja o gap 1 em `10-lgpd-compliance-plan.md`.

---

### Procedência das afirmações

- **Verificado no código:** todos os gabaritos referenciam arquivos/símbolos reais já
  citados nos capítulos 01–07 e 10.
- **Inferido do código:** dificuldades atribuídas por estimativa de esforço.
- **Conhecimento externo:** nenhum específico além do já citado.
