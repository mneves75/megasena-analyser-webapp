# Plano de Execução — Stage 3 (Workflow de Geração)

- **Data**: 23/09/2025
- **Responsável**: Backend (coordenação com Dados/Infra para schema e logging)
- **Dependências cumpridas**: Stages 0-2 concluídos (`pricing`, `strategy-limits`, `uniform/balanced`)

## Objetivos do Stage 3

1. Construir o núcleo `generateBatch` com validações determinísticas.
2. Definir o contrato `strategy_payload` e preparar a migration correspondente.
3. Instrumentar métricas básicas (diversidade, soma média, paridade, tempo) para servir o Stage 4/5.

## Entregáveis

- Arquivo `src/services/bets.ts` contendo:
  - `generateTicket(strategyCtx)` — normaliza seed/k, chama estratégia selecionada e retorna payload serializável.
  - `chooseStrategies(request)` — aplica pesos/padrão quando alguma estratégia falha.
  - `generateBatch({ budget, strategies, seed, timeoutMs })` — coordena alocação de orçamento (`calculateBudgetAllocation`), elimina duplicatas entre estratégias, acumula métricas e respeita `AbortController` (default 3000 ms).
- Testes Vitest (`src/services/__tests__/bets.test.ts`) cobrindo:
  - Orçamento insuficiente (`BUDGET_BELOW_MIN`).
  - Limite de tickets (`MAX_TICKETS_ENFORCED`).
  - Deduplicação cross-strategy.
  - Timeout forçado.
- Migration Prisma criando coluna JSON `strategy_payload` com schema validado (ex.: `prisma/migrations/.../add_strategy_payload.json`).
- JSON Schema `docs/data-contracts/strategy_payload.schema.json` com campos obrigatórios (`version`, `seed`, `strategies`, `metrics`, `config`).
- Atualização do README com resumo do motor e status atual (seção "Preços oficiais" + nova subseção "Motor de apostas").

## Backlog Detalhado

- [ ] Definir interface `GenerateBatchRequest` (`budgetCents`, `seed`, `strategies`, `k?`, `window?`, `timeoutMs?`).
- [ ] Implementar pooling de estratégias com fallback `uniform` quando uma retorna erro controlado.
- [ ] Garantir que cada ticket tenha sequência ordenada e sem duplicatas (Set + sort).
- [ ] Coletar métricas agregadas:
  - `totalTickets`, `totalCostCents`, `leftoverCents` (do pricing service).
  - `averageSum`, `averageFrequencyScore`, `quadrantCoverage` (mínimo, máximo, médio).
  - `paritySpread` (diferença média entre pares/ímpares).
- [ ] Em caso de timeout, retornar erro `GENERATION_TIMEOUT` com tickets parciais e logs de auditoria.
- [ ] Registrar logs Pino (`childLogger({ service: "bets" })`) com seed, estratégias, duração, totais.
- [ ] Criar migration para coluna JSON em `bets` (`strategy_payload`) com default `{}` e atualizar seed.
- [ ] Validar payload real contra schema com `ajv` no teste.
- [ ] Atualizar `docs/fixtures/sample-bets.json` com saída real do `generateBatch` (seed fixa `STG3-BASELINE`).
- [ ] Documentar passos manuais de validação em `docs/testing/strategies.md` (nova subseção Stage 3).

## Riscos / Mitigações

- **Carga combinatória**: limitar tentativas de regenerar ticket em caso de colisão (ex.: 100 tentativas, fallback uniforme).
- **Timeout**: expor `timeoutMs` com default conservador; registrar no log se ocorrer.
- **Schema incompatível**: revisar com Product antes da migration; manter `version` para evolução futura.
- **Observabilidade**: definir formato de log compatível com Stage 4 antes de expor API.

## Critérios de Aceite

- Testes unitários verdes (`npm run test -- bets strategies pricing`).
- Migration aplicada (`prisma migrate dev`) e seed atualizada.
- `generateBatch` retorna dados determinísticos com seed fixa (documentado em fixture/manual).
- Documentação atualizada (`README`, `docs/testing/strategies.md`, `docs/data-contracts/`).
- Logs estruturados disponíveis para consulta em desenvolvimento.
