# Plano Detalhado — Fase 5 (Motor de Apostas)

John Carmack review mode engaged — plano precisa ser coerente, incremental e sustentado por métricas.

## 1. Contexto & Escopo

- Fases 2-4 entregaram dados, ingestão e estatísticas; ainda não há geração de apostas.
- Regras oficiais da Mega-Sena exigem apostas de 6 a 15 dezenas com custos variáveis e sem repetição de bilhetes.
- Demandas RF-6 a RF-8 (PROMPT) pedem motor configurável, otimização de orçamento e persistência.
- Objetivo deste sprint: entregar um **MVP controlado** capaz de gerar apostas simples (6 dezenas) com duas estratégias, armazenar resultados e expor APIs seguras. Evoluções (apostas múltiplas, heurísticas avançadas, solver complexo) ficam como roadmap pós-MVP, mas devem ser delineadas.
- Limitações assumidas para o MVP: apenas apostas simples (`k = 6`), orçamento máximo de referência `R$ 500`, no máximo `100` bilhetes por requisição.

## 2. Princípios de Projeto

1. **Determinismo por Seed** — mesma entrada gera mesmo conjunto; facilita auditoria e backtesting.
2. **Segurança de Domínio** — validar orçamento, limites k (6..15), proibir duplicatas.
3. **Camada de Estratégia Pluggable** — interface comum para uniform, balanceada, futuras heurísticas (pares/trincas, recência, soma alvo).
4. **Otimização Incremental** — primeiro resolver apostas simples (C(6,6)=1) e orçamentos pequenos; documentar limites e caminhos para múltiplas dezenas.
5. **Traços de Auditoria** — logs estruturados (tempo, métricas), registro completo em `bets.strategy_payload`.
6. **Agente Único** — manter motor no servidor (Server Action) para preservar segredos (preço em `.env`, seeds internas) e garantir ponte RSC.

## 3. Fases Internas

### Stage 0 — Pré-requisitos

- [ ] Garantir `Price` seed com custos atualizados (tabela oficial + data de consulta).
- [ ] Definir limites operacionais iniciais (ex.: máximo 100 bilhetes por geração, orçamento máximo aceitável).
- [ ] Elaborar cenários de teste em `docs/testing/strategies.md` (baseline, extremos, entradas inválidas).

### Stage 1 — Infra & Pricing

- [ ] Criar `src/services/pricing.ts`:
  - Funções `getPriceForK(k)` (carrega Prisma/seed) e `calculateTicketCost(k)`.
  - Função `calculateBudgetAllocation(budgetCents)` retornando quantidade máxima de apostas simples.
- [ ] Tests (Vitest) cobrindo preços oficiais, fallback `.env` e erros (`k` fora do intervalo).
- [ ] Atualizar seeds/fixtures (`docs/fixtures/sample-bets.json`) para refletir custo real.
- [ ] Registrar data de atualização do preço na seed (`Meta` ou `Price.fonte`) e expor via API para UI exibir aviso.

### Stage 2 — Estratégias MVP

- [ ] Implementar PRNG determinístico (ex.: mulberry32) em `src/lib/random.ts`.
- [ ] `uniformStrategy`: gera apostas de 6 dezenas sem repetição, garantindo ordering e sem colisões.
- [ ] `balancedStrategy`: consulta `getFrequencies`/`getQuadrants` (Fase 4) para balancear seleção (ex.: draft por percentil, garantir paridade razoável).
- [ ] Cada estratégia retorna metadados (score, distribuição, quadrantes).
- [ ] Tests unitários (seed fixo, resultados conhecidos, sem duplicatas).

### Stage 3 — Workflow de Geração

- [ ] Funções core:
  - `generateTicket(strategyCtx)` -> { dezenas, metadata }.
  - `generateBatch({ budget, strategies, seed })` -> { tickets[], custoTotal, métricas }
  - `chooseStrategies` (aplicar pesos, fallback uniforme se outra falhar).
- [ ] Garantir validações: orçamento mínimo, limite de bilhetes, sem reuso de combinações.
- [ ] Adicionar abort controller com timeout (ex.: 3s) para evitar loops.
- [ ] Expor métricas: diversidade quadrantes, hits pares/trincas, soma média.

### Stage 4 — Persistência & APIs

- [ ] Server Action `generateBetsAction` chamada por `POST /api/bets/generate` (com token opcional, similar a sync).
- [ ] Persistir em `bets`/`bet_dezenas` com payload JSON (custo, heurísticas, seed, estratégias).
- [ ] `GET /api/bets` com filtros (data inicial/final, estratégia, orçamento mínimo).
- [ ] Atualizar logs (Pino) com tempo total e contagem de bilhetes e integrar com `clearStatsCache` **somente se** estatísticas dependentes forem recalculadas (provavelmente não; documentar justificativa).
- [ ] Documentar contratos HTTP/JSON (ver seção "5. Contratos de API").

### Stage 5 — Testes, Fixtures & Docs

- [ ] Vitest integração: rodar CLI/Server Action com DB SQLite novo (similar aos testes de stats) e validar persistência.
- [ ] Atualizar fixtures (`docs/fixtures/sample-bets.json`) com apostas geradas via script.
- [ ] README: documentar endpoints `/api/bets`, parâmetros, exemplos de resposta, instruções CLI.
- [ ] Plano principal (`docs/IMPLEMENTATION_PLAN.md`) — atualizar backlog, critérios e riscos.

### Stage 6 — Roadmap Pós-MVP (documentar, não implementar agora)

- [ ] Estratégias avançadas: cobertura de pares/trincas, recência, diversificação por soma/recência.
- [ ] Apostas múltiplas (k>6) com custo combinatório: requer heurística de cobertura e limite de orçamento.
- [ ] Backtesting determinístico comparando estratégias (integração com RF-5).
- [ ] Exportação CSV/PDF a partir das apostas geradas (Fase 8).

## 4. Checklist Consolidada

- [ ] Stage 0 pré-requisitos
- [ ] Stage 1 pricing utilities + testes
- [ ] Stage 2 estratégias uniform/balanceada + testes
- [ ] Stage 3 workflow de geração (batch, validações, timeout)
- [ ] Stage 4 APIs + persistência + logs
- [ ] Stage 5 testes integração + docs/fixtures/planos
- [ ] Atualizar README e `docs/IMPLEMENTATION_PLAN.md` (status Fase 5)
- [ ] Criar roadmap (Stage 6) para features posteriores (documentação/milestones)
- [ ] Rodar experimento manual: gerar R$ 30 e R$ 120 com seeds diferentes e validar determinismo via GET.

## 5. Riscos & Mitigações (John Carmack style)

| Risco                                                          | Impacto                            | Mitigação                                                                                            |
| -------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Complexidade**: heurísticas podem explodir combinatoriamente | Tempo de execução alto, travas     | Limitar MVP a k=6, impor `maxTickets`, abort controller e métricas de performance (log tempo total)  |
| **Dados oficiais desatualizados**                              | Custos incorretos                  | Seeds com data de referência, README instruindo atualização manual, flag em UI quando preço > X dias |
| **Determinismo quebrado**                                      | Auditoria comprometida             | PRNG determinístico + tests com snapshot de resultados                                               |
| **Persistência duplicada**                                     | Auditoria, custo                   | Unique index em (`bets.id`) e controle em memória de combinações geradas                             |
| **Orçamento insuficiente**                                     | Erro silencioso                    | Validar e retornar mensagem clara + dicas no payload                                                 |
| **Heurísticas enviesadas**                                     | Cobertura fraca                    | Expor métricas por estratégia, permitir pesos ajustáveis na UI                                       |
| **Carga estatística**                                          | Dependência de stats desatualizada | Invalidar caches relevantes ou embutir estatísticas no payload gerado                                |

## 6. Métricas de Aceitação

- Geração ≤ 3s para orçamento padrão (≤ R$ 500 / ~100 apostas simples) em dev local.
- Nenhum bilhete duplicado dentro do mesmo request.
- Testes unitários e integração 100% verdes (`npm test`).
- Smoke test manual: POST `/api/bets/generate` (curl + seed) retorna apostas persistidas e visíveis via GET.
- Logs incluem `strategy`, `tickets`, `duration_ms`, `cost_total`.
- API responde com HTTP 4xx quando orçamento/entrada inválida; JSON contém código e mensagem.

## 7. Contratos de API (MVP)

### POST `/api/bets/generate`

```jsonc
{
  "budget": 150.0, // obrigatório, em reais
  "strategies": ["uniform", "balanced"],
  "seed": "demo-seed-001", // opcional
  "maxTickets": 80, // opcional (default 100)
}
```

Resposta (200):

```jsonc
{
  "summary": {
    "budget": 15000, // centavos
    "totalCost": 15000,
    "tickets": 30,
    "strategiesUsed": {
      "uniform": 20,
      "balanced": 10,
    },
    "durationMs": 425,
  },
  "tickets": [
    {
      "id": "bet_01",
      "numbers": [3, 11, 17, 28, 39, 55],
      "strategy": "uniform",
      "score": {
        "quadrantBalance": 0.8,
        "pairCoverage": 6,
      },
    },
  ],
}
```

Erros (400/422):

```jsonc
{
  "error": "budget_insufficient",
  "message": "Orçamento mínimo é R$ 5,00",
  "details": { "required": 500 },
}
```

### GET `/api/bets`

Parâmetros: `from`, `to`, `strategy`, `minBudget`, `limit` (default 50).

Resposta: lista paginada com `id`, `created_at`, `budget_cents`, `strategy_name`, `numbers`, `metrics`.

## 8. Estrutura de Código Prevista

```
src/
  lib/random.ts            # PRNG determinístico
  services/
    pricing.ts             # custos e validações de orçamento
    strategies/
      index.ts             # interface Strategy & factory
      uniform.ts           # implementação
      balanced.ts          # implementação
    bets.ts                # generateTicket, generateBatch
  app/api/bets/
    route.ts               # GET (list)
    generate/route.ts      # POST (generate)
```

## 9. Cronograma sugerido (5 dias úteis)

| Dia | Atividades                                                    |
| --- | ------------------------------------------------------------- |
| D1  | Stage 0 (pré-reqs) + Stage 1 (pricing) + testes               |
| D2  | Stage 2 (estratégias) + testes unitários                      |
| D3  | Stage 3 (workflow, validações, timeout)                       |
| D4  | Stage 4 (APIs, persistência) + logging                        |
| D5  | Stage 5 (testes integração, docs, fixtures) + revisão/ajustes |

Buffer para Stage 6 (roadmap) caso o sprint permita.

## 10. Questões em Aberto

- Conferir tabela oficial da CAIXA para múltiplas dezenas (última consulta? 2024-09-01). Atualizar seed se houver mudança.
- Definir heurística exata da estratégia balanceada (ex.: distribuir 2 dezenas por quadrante? usar percentil?). Documentar antes de codar.
- Determinar formato final de `strategy_payload` (JSON schema?). Sugestão: `{ version, seed, metrics, config }`.
- Decidir se UI permitirá escolher estratégias/pesos no MVP ou se o motor terá defaults (provavelmente defaults com enum).
- Backtesting (parte da Fase 4/Fase 5 Stage 6) — precisar alinhar se será iniciado neste sprint ou adiado.

## 7. Saídas Obrigatórias

1. Código-fonte das estratégias e APIs.
2. Testes Vitest (unidade e integração) automatizados em CI (ou pelo menos em `npm test`).
3. Documentação: README (API), `docs/testing/strategies.md`, plano principal atualizado.
4. Roadmap Stage 6 listando evoluções e trade-offs.

> Se o tempo de sprint não permitir concluir todas as etapas, priorizar Stages 0-4 (motor + APIs) e deixar Stage 5 (docs/testes integração) como critério de término obrigatório antes de liberar para revisão.
