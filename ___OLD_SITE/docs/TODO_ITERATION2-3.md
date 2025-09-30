# TODO – Iterações Pendentes (27/09/2025)

## Iteração 2 · Integridade das apostas
- [x] Definir modelo Prisma (`BetBatch`) e atualizar migração inicial.
- [x] Atualizar `src/services/bet-store.ts`/`persistBatch` para gravar custo por ticket e totais agregados separados.
- [x] Ajustar UI (`HistoryTicketsGrid`, `TicketMetadataDialog`) e CLI (`bets list`) para refletir novos campos.
- [x] Revisar contratos/API (`/api/bets`) e docs (`README`, `docs/API_BET_ENGINE.md`).
- [x] Adicionar testes cobrindo soma dos custos, leftover não negativo e formatos JSON.

## Iteração 3 · Navegação e referencias externas
- [x] Atualizar `src/config/repo.ts` com o repositório correto (`megasena-analyser-nextjs`).
- [x] Criar teste unitário garantindo o default correto para `REPO_BASE_URL`.
- [x] Auditar componentes/README para links "Abrir no GitHub" e corrigir eventuais hardcodes.

## Verificações finais
- [x] Rodar `npm run lint`, `npm run typecheck`, `npm run test` após cada iteração.
- [ ] Capturar evidências (prints da UI, logs relevantes) para anexar ao PR.
- [x] Atualizar `docs/FRESH_EYES_REVIEW_2025-09-27.md` com o progresso de cada item ao concluir.
