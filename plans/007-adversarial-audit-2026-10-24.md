# Plans — adversarial audit 2026-10-24 (v1.18.0)

Escritos contra o commit `26e9f8b` (main + 1 commit de bump de digest). A auditoria
foi feita em três frentes paralelas e somente leitura (correção, segurança,
performance/dívida), com verificação de cada achado no código antes de agir.

## O que já foi corrigido nesta versão

| # | Achado | Arquivos | Prova |
|---|--------|----------|-------|
| 1 | Faixa de privacidade fixa cobria o botão "Gerar Apostas" e as dezenas do último sorteio | `components/storage-disclosure.tsx`, `app/layout.tsx` | Medido em 1440×1000, 1024×768 e 390×844: `position: static`, sem sobreposição (`overlap: false`) |
| 2 | Decimais em formato en-US na UI pt-BR (`3.19x`, `28.57%`, `R$ 24.90M`) | `lib/utils.ts`, `app/dashboard/page.tsx`, `app/dashboard/statistics/page.tsx` | `formatDecimal` + `formatCurrency`; snapshot do dashboard mostra `3,19×` e `3 de 10` |
| 3 | `--destructive` (semântica de erro) usado como selo de "número quente" | `app/dashboard/page.tsx` | Selo removido; a métrica passou a ser o número principal |
| 4 | Ícone de disclosure em glifo Unicode (`&#9660;`) | `app/(home)/page.tsx` | `ChevronDown` do lucide, mesma família dos demais ícones |
| 5 | Matcher do proxy usava `api` e `_next/static` sem `/`, serviria `/api-docs` sem CSP | `proxy.ts` | `api/`, `_next/static/`, `_next/image/`, `.well-known/` |
| 6 | Chave de rate limit no `/128`: um cliente IPv6 com um `/64` obtinha um balde novo por endereço | `lib/security/http.ts`, `lib/api/handler.ts` | `rateLimitSubject` reduz IPv6 ao `/64`; 8 testes em `tests/lib/security/rate-limit-subject.test.ts` |
| 7 | Fallback sem `IP_HASH_SECRET` gravava SHA-256 sem sal do IP (reversível por força bruta) no audit por 400 dias | `lib/api/handler.ts` | HMAC com sal aleatório por processo |
| 8 | `method`/`route` do cliente gravados sem limite em `audit_logs` | `lib/audit.ts` | 16/200 caracteres, teste com método de 64 bytes |
| 9 | `audit:prune` apagava 365 dias enquanto a política publicada diz 400 | `lib/audit-retention.ts`, `scripts/prune-audit-logs.ts` | Padrão único de 400 + teste |
| 10 | Erro de orçamento mínimo voltava como HTTP 500 genérico | `lib/analytics/bet-generator.ts`, `lib/api/handler.ts` | `BetGenerationInputError` → 400 com o texto acionável; verificado no navegador |
| 11 | Requisição limitada (429) não era auditada | `lib/api/handler.ts` | `finalize()` único; teste `records a throttled request in the audit log` |
| 12 | Quatro cópias da finalização de resposta e um ramo inalcançável | `lib/api/handler.ts` | Uma função `finalize`, ramo morto removido |
| 13 | Limite de 100/min duplicado como literal no Durable Object | `lib/api/handler.ts`, `cloudflare/data-object.ts` | Constantes exportadas e reutilizadas |
| 14 | `db:pull` segurava a transação de escrita durante ~3.065 requisições de rede | `scripts/pull-draws.ts` | Busca antes de abrir a transação, como já faz o backfill |
| 15 | `--allow-partial` podia gravar arquivo com buraco interno | `scripts/pull-draws.ts` | `assertGapFreeArchive` (buraco só é aceito no fim) |
| 16 | `db:backfill-prizes` saía 0 com prêmios faltando | `scripts/backfill-prizes.ts` | `process.exitCode = 1` quando `failed > 0` |
| 17 | Workflow compilava com Node 22.23.2 enquanto a imagem roda 22.23.4 | `.github/workflows/*.yml`, `tests/scripts/supply-chain-controls.test.ts` | Teste lê `.nvmrc` em vez de literal |
| 18 | `overrides`/`patchedDependencies` inertes no `package.json` | `package.json` | Teste garante que os pins vivem só no `pnpm-workspace.yaml` |
| 19 | `changes()` como segunda query em toda escrita do Durable Object | `lib/cloudflare/database.ts`, `cloudflare/ingestion.ts` | Só a ingestão lê a contagem, explicitamente |
| 20 | Sem índice em `rate_limit_windows.reset_at`, varredura a cada request | `cloudflare/data-object.ts` | `CREATE INDEX IF NOT EXISTS` idempotente |
| 21 | Código morto (`ComplexityScoreEngine`, `getTopPairsForNumber`, 3 constantes) | `lib/analytics/`, `lib/constants.ts`, `vitest.config.ts` | Referências zero verificadas antes de remover |
| 22 | Notas privadas de handoff a um `git add -A` da publicação | `.gitignore` | `docs/handoffs/` ignorado |
| 23 | Menu mobile sem fechar no Escape | `components/site-header.tsx` | `keydown` listener enquanto aberto |

## Pendências priorizadas (não feitas nesta versão)

### 101 — Trocar o `InMemoryDatabase` por SQLite real na suíte (L, risco médio)

`lib/db.ts:109-584` embute um emulador de SQL que só existe sob Vitest. Ele responde
`undefined`/`[]` para leituras que não reconhece (visto nesta sessão: um `SELECT ... WHERE
request_id = ?` com parâmetro não retorna linha), então um erro de SQL real passa no
`bun run test` e só aparece em produção. `tests/lib/api-http.integration.test.ts`
já roda `node:sqlite` com as migrações reais; o caminho está provado no próprio repo.
Passos: criar um setup que faça `vi.mock('@/lib/db')` com `node:sqlite(':memory:')` +
`db/migrations/*.sql`, apagar `InMemoryDatabase` e seus parsers, manter `test:sqlite`
para os caminhos específicos de Bun. Critério: `bun run test -- --run --coverage`
passa com o emulador removido e o percentual de cobertura não cai.

### 102 — Cobrir o arquivo público e o metadata no gate de PR (M, risco baixo)

`tests/app/seo.spec.ts` é a única prova de canonical/og:url/lastmod/404 duro, e nenhum
job de PR roda Playwright. Já existe `tests/lib/seo/metadata.test.ts` (5 casos, feito
agora); falta um teste com SQLite real para `getDrawPage`/`getYearArchive`/`getSitemapData`
em `lib/analytics/draw-archive.ts`, que segue com 0% de cobertura e é a superfície de
aquisição (3.000+ URLs). Critério: os testes falham se `lastmod` ou o par
`previous`/`next` mudarem de semântica.

### 103 — `launchStage` de staging gravado como `production` (S, risco médio)

`cloudflare.config.ts:28` fixa `ENVIRONMENT: 'production'` nos dois modos; o único
marcador de staging é `DEPLOYMENT_STAGE`. O valor entra em `log_events.launch_stage`,
então a evidência de staging fica indistinguível da de produção. Correção: derivar
`launchStage` de `DEPLOYMENT_STAGE` e separar a exigência de `IP_HASH_SECRET` numa
flag explícita, para não afrouxar o fail-closed.

### 104 — Arquivo por ano sem cache e 6 queries por página de concurso (S, risco baixo)

`lib/analytics/draw-archive.ts:223-255` executa `GROUP BY substr(draw_date,1,4)` e a CTE
de janela em toda visita a `/resultados/[ano]`, ao contrário do que o comentário em
`lib/api/handler.ts:170` afirma. `:450-478` prepara uma consulta por dezena sorteada,
embora `:434-448` já tenha agrupado as mesmas linhas. Custo atual em milissegundos;
cresce linearmente com o arquivo e está no caminho do crawler.

### 105 — Deriva documental da política de privacidade (S, risco baixo)

`docs/PRIVACY.md:4` ainda descreve o Worker como "staging" e `:84` chama o
identificador de rate limit de "em memória", mas `cloudflare/data-object.ts` o persiste
em SQLite. Corrigir junto com a decisão pendente do CMP-06 (janela de PITR de 30 dias,
waiver válido até 2026-11-30).
