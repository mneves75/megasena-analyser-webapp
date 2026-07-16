# 005 — Substituir N+1 de COUNT(*) por agregações GROUP BY (decade, pair, prime)

Escrito contra commit: 9d5417f. Findings: PERF-03 (HIGH), SECURITY-01 parcial.

## Por que

- `lib/analytics/decade-analysis.ts:36-64`: por década (6): 6 COUNTs de range + 10 números × 6 colunas ≈ **396 queries** `prepare().get()` por chamada.
- `lib/analytics/pair-analysis.ts:193-204`: `getNumberFrequency()` = 6 COUNTs por número; chamado em `.map` de `getNumberPairs` (`:176-180`, até 50 pares × 2 × 6 = **600 queries**) e por par no rebuild (`:109-110`).
- `lib/analytics/prime-analysis.ts:89-98`: loop 60×6 = **360 queries** por chamada.
- O padrão correto já existe no repo: agregação única via UNION ALL (veja `streak-analysis`/`prize-correlation`) e a tabela cache `number_frequency` (populada na ingestão) já tem frequência por número.

## Mudanças

1. `decade-analysis`: uma query de ocorrências por número (UNION ALL das 6 colunas + GROUP BY num), bucketizar por década em JS. Elimina os loops de COUNT.
2. `pair-analysis`: substituir `getNumberFrequency()` por lookup em Map pré-carregado de `number_frequency` (via `StatisticsEngine.getNumberFrequencies()` ou query direta única). Rebuild dos pares continua como está (plano 002 já o move para a ingestão).
3. `prime-analysis`: mesma agregação única GROUP BY; derivar contagens de primos em JS.
4. Statements preparados uma vez por chamada (não dentro de loops).

## Testes

Regressão de igualdade: para um seed fixo de draws, resultados ANTES vs DEPOIS idênticos. Como decade/pair/prime não têm testes hoje, criar testes com dataset pequeno e valores esperados calculados manualmente (companion `.file.test.ts` com DB real se o InMemoryDatabase não suportar as novas queries — provável, pois o mock casa por prefixo; nesse caso ADICIONE os novos prefixos ao mock OU use file DB; prefira file DB para não inflar o mock).

## Verificação

```
bun run lint && bun run typecheck && bun run test -- --run
```

## Fora de escopo

Consolidação de classe base dos engines (DEBT-01) fica para outro plano — aqui só as queries.
