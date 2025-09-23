# Plano de Revisão — Stage 5

## Contexto

- Data da revisão: 23/09/2025.
- Persona ativa: **React Server Components Expert** — diretrizes confirmadas como aplicáveis ao projeto (Next.js App Router com RSC por padrão).
- Objetivo: mapear riscos imediatos para o motor de apostas e alinhar backlog com o plano da Fase 5.

## Achados Principais

1. **Estratégias ainda não implementadas** — somente o serviço de pricing está disponível; precisamos priorizar `uniformStrategy`/`balancedStrategy` (Stage 2) antes de expor APIs.
2. **Ausência de `.env.sample`** — Stage 0 pede limites versionados; incluir `MEGASENA_BASE_PRICE_CENTS`, `MEGASENA_PRICE_FALLBACK_UPDATED_AT` e `SYNC_TOKEN` documentados.
3. **Fixtures dependem de motor real** — `docs/fixtures/sample-bets.json` é placeholder; Stage 5 exige regenerar com saídas reais do workflow.
4. **Schema `strategy_payload` indefinido** — migration e schema JSON permanecem pendentes; bloqueia Stage 3/4.
5. **Logs e auditoria** — ainda não existe canal dedicado para métricas do motor. Precisamos definir formato (Pino) antes do Stage 3.

## Tarefas Prioritárias

### Stage 0-1

- [ ] Adicionar `import "server-only";` em serviços server-only restantes (`stats`, `sync`, etc.) para reforçar boundary.
- [ ] Criar `.env.sample` alinhado aos limites definidos em `strategy-limits.ts`.

### Stage 2

- [ ] Implementar PRNG determinístico (`src/lib/random.ts`) com testes.
- [ ] Entregar `uniformStrategy` com validação de duplicatas e metadados básicos.
- [ ] Publicar rascunho da estratégia balanceada em `docs/strategies/balanced.md` com critérios aprovados (Section 12).

### Stage 3

- [ ] Desenvolver `generateBatch` + timeout e métricas (diversidade, soma média, pares).
- [ ] Definir schema `strategy_payload` (`docs/data-contracts/`) e aplicar migration Prisma correspondente.
- [ ] Criar testes cobrindo erros de orçamento (`BUDGET_BELOW_MIN`, `MAX_TICKETS_ENFORCED`).

### Stage 4-5

- [ ] Implementar Server Action + APIs `/api/bets` com autenticação opcional.
- [ ] Configurar logging estruturado (Pino) registrando seed, duração, heurísticas.
- [ ] Atualizar fixtures com dados reais do motor via script dedicado.
- [ ] Documentar endpoints e payloads no README + `docs/IMPLEMENTATION_PLAN.md`.

## Riscos e Mitigações

- **Carga de combinatória para k>6** — MVP limita em 6 dezenas, mas precisamos planejar caching e heurísticas para expansão (Stage 6).
- **Backtesting** — sem dados de resultados antigos (hits) vinculados aos tickets; incluir no roadmap pós-MVP.
- **Orçamento alto** — `maxBudgetCents` atual (R$ 500) pode ser insuficiente para usuários avançados; planejar flag de configuração administrável.

## Próximos Passos Imediatos

1. Revisar arquivos `src/services/*.ts` para adicionar `import "server-only";` onde necessário.
2. Montar `docs/strategies/balanced.md` com dados da Fase 4 antes de iniciar Stage 2.
3. Atualizar `docs/IMPLEMENTATION_PLAN.md` com backlog recém mapeado (Stages 2-4).
4. Criar script CLI de geração de apostas para suportar testes de Stage 5.

> Revisão concluída e alinhada com guidelines RSC. Atualize este documento ao concluir cada bloco de tarefas.
