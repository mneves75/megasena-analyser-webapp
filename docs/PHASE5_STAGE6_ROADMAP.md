# Roadmap Pós-MVP — Stage 6

> Atualizado em 23/09/2025. Consolidado após entrega das Stages 0-5 do motor de apostas.

## Visão Geral

Objetivo do Stage 6 é planejar evoluções avançadas do motor de apostas, definindo requisitos, riscos e métricas de sucesso antes de abertura de novas frentes.

## Iniciativas Prioritárias

| Iniciativa                       | Descrição                                                                                            | Dependências                                                   | Métricas / Aceite                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Suporte a k > 6                  | Calcular custos combinatórios para apostas múltiplas (7..15 dezenas), revisar limites e UX           | Validação com Product/Finance, benchmarks de tempo             | `generateBatch` entrega <= 5s com orçamento R$ 500; payload inclui distribuição combinatória |
| Estratégias avançadas            | Cobertura de pares/trincas, soma alvo, recência/quentes/frias, heurística híbrida                    | Dataset de frequências atualizado, critérios aprovados         | Cobertura mínima: média quadrantes ≥ 5, paridade spread ≤ 2, score ≥ baseline                |
| Backtesting & análise de hits    | Associar apostas geradas a resultados históricos, dashboard de performance                           | Persistência de draws completa, tabelas auxiliares `bets_hits` | Pipeline de backtesting reproduz hits em < 2 min; relatório com acurácia                     |
| Configuração dinâmica de limites | Permitir ajustar `maxBudgetCents`, `maxTicketsPerBatch` sem redeploy (metas: `Meta` ou painel admin) | Autorização para mutation, UI administrativa futura            | Alterações refletidas em < 1 min, audit logging                                              |
| Observabilidade avançada         | Exportar logs Pino para datadog/logflare, métricas (generateBatch duration p95)                      | Stage 4 logging básico                                         | Dashboard com alertas (> 5% falhas) e tempo médio monitorado                                 |

## Riscos e Mitigações

- **Complexidade combinatória**: apostas múltiplas podem explodir combinações. Mitigar com caching, heurísticas lazy e limites por orçamento.
- **Dados históricos incompletos**: backtesting requer draws confiáveis. Rastrear lacunas no sync e criar scripts de verificação.
- **Experiência do usuário**: aumento de opções (k>6, múltiplas estratégias) demanda UX clara; envolver design antes de liberar.
- **Performance**: logs e métricas devem manter overhead baixo; usar batch logging e sampling quando necessário.

## Cronograma Sugerido

1. **Semana 1**: pesquisa e benchmarks (k>6, estratégias avançadas), definir requisitos com Product/Data.
2. **Semana 2**: spike técnico (solver híbrido, caching) + design de backtesting schema.
3. **Semana 3**: implementação incremental das novas estratégias com testes unitários e documentação.
4. **Semana 4**: backtesting + observabilidade, revisão final e retro.

## Artefatos a Produzir

- Documento técnico detalhado para cada nova estratégia (semelhante a `docs/strategies/balanced.md`).
- Plano de migração para ajustes no banco (`strategy_payload` v2, tabelas de hits, limites configuráveis).
- Checklist de validação manual (UI + API) para k>6.
- Plano de rollout/feature flags.

## Próximos Passos

1. Apresentar roadmap em reunião de planning (30/09/2025).
2. Criar issues STG-6.# referenciando esta página.
3. Definir ownership cruzado (Backend, Dados, Produto) e métricas de sucesso.
