# Plano de Revisão — Stage 5 (Atualização 23/09/2025)

## Contexto

- Data da revisão: 23/09/2025.
- Persona ativa: **React Server Components Expert** — diretrizes confirmadas como aplicáveis ao projeto (Next.js App Router com RSC por padrão).
- Objetivo: mapear riscos imediatos para o motor de apostas e alinhar backlog com o plano da Fase 5.

## Achados Principais (revisão pós-Stage 2)

1. **Estratégias MVP entregues** — `uniformStrategy` e `balancedStrategy` implementadas com PRNG determinístico e metadados completos (`src/services/strategies/**`).
2. **Infra Stage 0-1 concluída** — `.env.sample` versionado, seeds com fonte/consulta atualizadas, módulos server-only protegidos com `import "server-only";`.
3. **Validações pendentes** — falta camada `generateBatch` com deduplicação global, métricas agregadas e timeouts (Stage 3).
4. **Schema `strategy_payload` ainda indefinido** — precisamos formalizar contratos (JSON Schema + migration) antes de persistir apostas.
5. **Observabilidade** — ainda não há logger específico para o motor (precisamos definir estrutura Pino + `strategy_payload` para Stage 4).
6. **Fixtures e docs** — `docs/fixtures/sample-bets.json` continua como placeholder; README não expõe fluxo do motor nem endpoints /api/bets.

## Tarefas Prioritárias

### Stage 0-2 (concluídos)

- [x] Adicionar `import "server-only";` aos serviços `pricing`, `stats`, `sync`.
- [x] Versionar `.env.sample` com limites (`MEGASENA_BASE_PRICE_CENTS`, `SYNC_TOKEN`, etc.).
- [x] Implementar PRNG determinístico (`src/lib/random.ts`) e estratégias `uniformStrategy`/`balancedStrategy` com testes determinísticos.
- [x] Documentar heurística balanceada (`docs/strategies/balanced.md`).

### Stage 3

- [x] Implementar `services/bets.ts` com `generateTicket`, `generateBatch`, `chooseStrategies` e validações globais (orçamento, duplicidade cross-strategy).
- [x] Incluir timeout configurável (`AbortController`) e métricas agregadas (diversidade de quadrantes, média de frequência, soma).
- [x] Definir schema `strategy_payload` em `docs/data-contracts/strategy_payload.schema.json` e criar validação AJV; avaliar se migration adicional é necessária (coluna existente no schema atual).
- [x] Cobrir com testes Vitest (incluindo cenário de dupla estratégia e erros `BUDGET_BELOW_MIN`, `MAX_TICKETS_ENFORCED`).
- [x] Garantir que targets de quadrante nunca excedam 10 dezenas; adicionar guardas e testes de regressão.

### Stage 4-5

- [ ] Implementar Server Action `generateBetsAction` reutilizando `generateBatch` e expondo `/api/bets/generate` (POST) e `/api/bets` (GET) com token opcional.
- [ ] Registrar logs estruturados (Pino) contendo seed, estratégias usadas, tempo de execução e score médio; definir formato padronizado.
- [ ] Criar script CLI para gerar apostas e alimentar fixtures (atualizar `docs/fixtures/sample-bets.json`).
- [ ] Documentar contratos HTTP no README + `docs/IMPLEMENTATION_PLAN.md` e atualizar checklist de smoke manual.
- [ ] Adicionar testes de integração (Vitest) usando banco efêmero cobrindo persistência e filtros básicos em `/api/bets`.

### Stage 6 (Roadmap pós-MVP)

- [ ] Planejar suporte para `k > 6` (ajustar heurísticas, custo combinatório, otimização de quadrantes).
- [ ] Mapear necessidades de backtesting (comparar apostas geradas vs concursos históricos).
- [ ] Avaliar limites configuráveis (`maxBudgetCents`, `maxTicketsPerBatch`) via meta/config persistida.

## Riscos e Mitigações

- **Carga de combinatória para k>6** — MVP limita em 6 dezenas, mas precisamos planejar caching e heurísticas para expansão (Stage 6).
- **Backtesting** — sem dados de resultados antigos (hits) vinculados aos tickets; incluir no roadmap pós-MVP.
- **Orçamento alto** — `maxBudgetCents` atual (R$ 500) pode ser insuficiente para usuários avançados; planejar flag de configuração administrável.

## Próximos Passos Imediatos (23/09/2025)

1. Avaliar necessidade de migration complementar para `strategy_payload` (default/config extras) e alinhar com Dados.
2. Desenhar integração da persistência/APIs (Stage 4) incluindo logging Pino + storage (bets).
3. Atualizar scripts e smoke tests para cobrir Server Action/rotas assim que o Stage 4 iniciar.

> Revisão concluída e alinhada com guidelines RSC. Atualize este documento ao concluir cada bloco de tarefas.
