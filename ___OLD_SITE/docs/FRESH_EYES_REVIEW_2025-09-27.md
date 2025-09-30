# Fresh Eyes Review – 27/09/2025

## Atualização · 27/09/2025 18:10 (UTC-3)

### Panorama

| # | Achado | Severidade | Impacto | Detecção Atual |
|---|--------|------------|---------|----------------|
| 1 | Cache de estatísticas não invalida pós-sync (`src/services/stats.ts:68-193`) | Alta | Dashboards e APIs servem dados obsoletos até reinício do servidor | Nenhuma – lint/tests não cobrem fluxo de sync + leitura |
| 2 | `--limit` ignorado no sync incremental (`src/services/sync.ts:84-192`) | Média | Operações não conseguem fatiar cargas, risco de timeouts e janelas de manutenção longas | Não coberto por testes, detectado manualmente |
| 3 | Persistência de apostas replica custo total em cada ticket (`src/services/bet-store.ts:17-118`) | Alta | Métricas infladas, relatórios /bets e CLI incorretos | Não há tests cobrindo consistência de custos |
| 4 | `REPO_BASE_URL` aponta para repo errado (`src/config/repo.ts:1-6`) | Baixa | Links "Abrir no GitHub" quebrados em produção | Observação manual |

### Estratégia em Iterações

#### Iteração 1 – Confiabilidade das estatísticas e sincronização
**Objetivo:** garantir que sync reflita imediatamente em dashboards/APIs e habilitar janelas controladas via `--limit`.

- [x] Substituir `react/cache` por memoização controlada (`memoize` + `clearStatsCache`) em cada consulta (`getFrequencies`, `getPairs`, `getTriplets`, `getRuns`, `getSums`, `getQuadrants`, `getRecency`).
  - *Aceitação:* `clearStatsCache()` remove todas as promessas memorizadas e chamadas subsequentes recalculam dados atualizados (coberto por `src/services/__tests__/stats-cache.test.ts`).
- [x] Ajustar `syncMegaSena` para invocar `clearStatsCache` ao final e respeitar `--limit` em todos os fluxos.
  - *Aceitação:* novos testes (`resolveProcessingRange`) garantem truncamento e o loop processa somente o intervalo determinado.
- [x] Cobrir o comportamento com Vitest (mocks de Prisma + cálculo de faixa de sincronização).


#### Iteração 2 – Integridade dos dados de apostas e UX
**Objetivo:** corrigir consistência de custos e remover ruído em relatórios e integrações.

- [x] Evoluir schema Prisma com a introdução de `BetBatch` + coluna `ticket_cost_cents` em `Bet`; migration inicial atualizada e script `npm run db:fix-bet-totals` adaptado para recalcular totais/leftover.
- [x] Atualizar `persistBatch`, `listBets`, CLI (`bets list`), UI (`HistoryTicketsGrid`) e API `/api/bets` para consumir o novo modelo (totais agregados vindo de `BetBatch`, ticket metadata individual preservada).
- [x] Cobrir fluxo com testes (`bet-store.test.ts`, API e CLI) garantindo soma dos custos, leftover não negativo e serialização consistente.
- [x] Revisar README e documentação Fresh Eyes registrando a mudança estrutural.

#### Iteração 3 – Fricção de navegação e observabilidade
**Objetivo:** eliminar links quebrados e evitar regressão.

- [x] Atualizar `REPO_BASE_URL` para `megasena-analyser-nextjs` e permitir override via `NEXT_PUBLIC_REPO_BASE`.
- [x] Criar teste unitário garantindo fallback correto (`src/config/__tests__/repo.test.ts`).
- [x] Revisar README/guia de instalação e demais docs para apontar para o repositório oficial.

### TODO Consolidado

- [x] Invalidação real das caches de estatísticas + revalidação após sync.
- [x] Respeito ao `--limit` em todos os modos de sync.
- [x] Refatoração de persistência de apostas (schema, serviços, UI/CLI, docs, testes).
- [x] Correção do `REPO_BASE_URL` + testes + revisão de links.
- [x] Suite: `npm run lint`, `npm run typecheck`, `npm run test` com logs anexados + evidências visuais do dashboard atualizando pós-sync (prints ainda pendentes).

### Logs de suporte

- `npm run lint` → ✅
- `npm run test` → ✅ (alertas de logs destacam retries da API; comportamento esperado nos testes atuais)

### Próximos passos imediatos

1. Endereçar Iteração 1 (cache + limit) com prioridade máxima.
2. Validar com dados reais (synced) e capturar prints comparando números pré/pós-sync.
3. Abrir PR com relatório de testes, evidências e atualização de docs.
