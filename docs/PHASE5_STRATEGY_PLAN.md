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

## 11. Backlog de Issues e Estimativas

Todas as datas consideram início do sprint em 23/09/2025 (terça-feira) e mantêm dias úteis; quando cair em fim de semana, mover para a próxima segunda-feira.

| Stage | Issue (STG-#)                                 | Data limite | Estimativa | Owner            | Dependências        |
| ----- | --------------------------------------------- | ----------- | ---------- | ---------------- | ------------------- |
| 0     | STG-0 — Preparar pricing seed e limites MVP   | 23/09/2025  | 4h         | Estratégia/Dados | -                   |
| 1     | STG-1 — Service de pricing e testes           | 23/09/2025  | 6h         | Backend          | STG-0               |
| 2     | STG-2 — Estratégias uniform/balanced com PRNG | 24/09/2025  | 8h         | Backend + Dados  | STG-1, dados Fase 4 |
| 3     | STG-3 — Workflow generateBatch e validações   | 25/09/2025  | 7h         | Backend          | STG-2               |
| 4     | STG-4 — APIs e persistência de apostas        | 26/09/2025  | 8h         | Backend + Infra  | STG-3               |
| 5     | STG-5 — Testes integração, fixtures e docs    | 29/09/2025  | 6h         | QA + Docs        | STG-4               |
| 6     | STG-6 — Roadmap pós-MVP documentado           | 30/09/2025  | 4h         | Estratégia       | STG-5               |

### STG-0 — Preparar pricing seed e limites MVP

- Atualizar seed/planilha de preços com tabela oficial da CAIXA, registrando `fonte` e `data_consulta`.
- Definir e versionar limites (`MAX_TICKETS=100`, `MAX_BUDGET_CENTS=50000`) em `docs/PHASE5_STRATEGY_PLAN.md` + `.env.sample`.
- Criar `docs/testing/strategies.md` (se inexistente) com cenários mínimos: orçamento errado, budget alto, seed fixo.
- Critérios de aceite: seed carregada no banco local, documentação de limites publicada, cenários revisados por QA.

### STG-1 — Service de pricing e testes

- Implementar `src/services/pricing.ts` com APIs descritas no Stage 1; expor tipos necessários.
- Adicionar testes Vitest cobrindo custos oficiais e erros.
- Atualizar fixture `docs/fixtures/sample-bets.json` com custos apropriados.
- Critérios de aceite: `npm run test -- pricing` verde, função retornando preço correto para `k = 6`.

### STG-2 — Estratégias uniform/balanced com PRNG

- Criar `src/lib/random.ts` com PRNG determinístico (mulberry32 ou equivalente) validado via snapshot.
- Implementar `uniformStrategy` e `balancedStrategy` conforme Stage 2, retornando metadados.
- Documentar heurística detalhada em `docs/strategies/balanced.md` (novo) com exemplos.
- Critérios de aceite: testes unitários com seed fixa produzindo conjuntos determinísticos, sem bilhetes duplicados.

### STG-3 — Workflow generateBatch e validações

- Construir `services/bets.ts` com `generateTicket`, `generateBatch`, `chooseStrategies` e validações de orçamento/limites.
- Implementar timeout com `AbortController` (3s) e métricas de diversidade.
- Atualizar logs estruturados com métricas principais.
- Critérios de aceite: testes unitários cobrindo orçamento insuficiente, colisão de bilhetes e timeout.

### STG-4 — APIs e persistência de apostas

- Implementar Server Action `generateBetsAction` e rotas `/api/bets/generate` (POST) e `/api/bets` (GET).
- Persistir `bets`/`bet_dezenas` com `strategy_payload` e metadados.
- Configurar autenticação/token opcional seguindo padrão de sync.
- Critérios de aceite: chamadas via `curl` armazenam bilhetes, `GET /api/bets` retorna filtros básicos, logs registram duração.

### STG-5 — Testes integração, fixtures e docs

- Escrever teste integração Vitest ou script E2E que roda action com banco efêmero.
- Regenerar fixtures em `docs/fixtures/sample-bets.json` com resultados reais do motor.
- Atualizar README + `docs/IMPLEMENTATION_PLAN.md` com APIs, parâmetros e novos riscos.
- Critérios de aceite: documentação revisada, teste integração executado localmente e registrado manualmente.

### STG-6 — Roadmap pós-MVP documentado

- Elaborar resumo das evoluções (estratégias avançadas, k>6, backtesting) com complexidade e riscos.
- Atualizar `docs/PHASE5_STRATEGY_PLAN.md` Stage 6 com milestones, dependências e métricas futuras.
- Registrar decisões de adiamento e critérios para retomada no backlog principal.
- Critérios de aceite: roadmap validado com Product/Stakeholders e anexado ao próximo sprint planning.

## 12. Validação das Decisões Pendentes

### Heurística da Estratégia Balanceada

1. Extrair métricas atuais de frequência/quadrantes (Stage 4 anterior) e publicar resumo em `docs/strategies/balanced.md` (seção "Dados de referência").
2. Prototipar distribuição (ex.: 2 dezenas por quadrante + rank por percentil) em notebook/`scripts/` com seed fixa e comparar contra uniform.
3. Validar critérios com Product/Data: metas mínimas para `quadrantBalance` (>=0.7) e cobertura de pares (>=5) por ticket.
4. Aprovar a heurística em review assíncrono (checklist: algoritmo descrito, pseudo-código, exemplos) **antes** de iniciar STG-2.

### Schema de `strategy_payload`

1. Descrever JSON Schema (`docs/data-contracts/strategy_payload.schema.json`) com campos `version`, `seed`, `strategy`, `metrics`, `config`.
2. Atualizar migrations/Prisma para garantir colunas compatíveis (`JSONB`/`JsonValue`) e versionamento.
3. Validar payload real gerado pela PoC (script Stage 3) contra schema via `ajv` em teste automatizado.
4. Revisar impacto em APIs (`POST /api/bets/generate`, `GET /api/bets`) e atualizar contratos na seção 5.
5. Só iniciar STG-3/4 após schema aprovado e registrado em `docs/data-contracts/`.

> Resultado esperado: decisões formalizadas até 24/09/2025, com aprovação registrada no PR ou em comentário de issue correspondente.

## 13. Governança de Execução

### Definition of Ready (DoR) por Stage

- **STG-0**: tabela CAIXA referenciada ≤ 30 dias, acesso a seed/prisma funcional, `.env.sample` atualizado.
- **STG-1**: DoR de STG-0 cumprido, decisões de preço validadas, suíte Vitest configurada e rodando localmente.
- **STG-2**: DoR de STG-1, heurística balanceada aprovada (seção 12), dataset de frequências congelado com timestamp.
- **STG-3**: DoR de STG-2, schema `strategy_payload` aprovado e migrado, mocks de estratégias revisados.
- **STG-4**: DoR de STG-3, endpoints autenticados definidos, migrations aplicadas em ambiente local.
- **STG-5**: DoR de STG-4, pipeline de testes integração desenhado, fixtures disponíveis.
- **STG-6**: DoR de STG-5, feedback de Product sobre MVP coletado.

### Definition of Done (DoD) por Stage

- **STG-0**: limites versionados, seed atualizada em banco local, checklist de testes manuais arquivada.
- **STG-1**: testes Vitest verdes (`npm run test -- pricing`), documentação de preços em README, logs de validação anexados.
- **STG-2**: estratégias com cobertura de testes ≥ 90%, doc `docs/strategies/balanced.md` revisada.
- **STG-3**: `generateBatch` com métricas completas, timeout verificado em teste, logs JSON validados.
- **STG-4**: rotas acessíveis via `curl`, registros no banco revisados, contrato API assinado por Product/Frontend.
- **STG-5**: teste integração executado, README/docs atualizados, smoke manual registrado (seed + outputs).
- **STG-6**: roadmap publicado em `docs/PHASE5_STRATEGY_PLAN.md`, backlog principal atualizado com follow-ups.

### Template sugerido para Issues STG-#

```
## Contexto
- Stage: STG-X (link para plano)
- Objetivo sprint: [resuma]

## Escopo
- [ ] Tarefa 1
- [ ] Tarefa 2

## Definition of Ready
- [ ] [copiar itens relevantes da seção 13]

## Definition of Done
- [ ] [copiar itens relevantes da seção 13]

## Validação/QA
- Testes automatizados: ...
- Smoke manual: ...

## Aprovações
- Product: @
- Dados/Infra (quando aplicável): @
```

### Cadência de Revisão

- **Stand-up diário (15 min)**: atualizar status dos STG-# e bloqueios.
- **Review técnica**: STG-2/3 exigem review cruzado (Backend + Dados) antes de merge.
- **Checkpoint de decisões (24/09/2025)**: validação formal de heurística e schema.
- **Demo de Sprint (30/09/2025)**: apresentar POST/GET operacionais, métricas e roadmap.

### Rastreabilidade

- Registrar no `CHANGELOG.md` entradas por Stage com referência ao STG-#.
- Anexar evidências (logs, capturas, scripts) às issues para auditoria determinística.
- Atualizar `docs/IMPLEMENTATION_PLAN.md` ao fechar cada Stage com status, riscos emergentes e follow-ups.
