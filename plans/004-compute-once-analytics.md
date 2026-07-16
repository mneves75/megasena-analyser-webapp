# 004 — Compute-once nos engines (mesma agregação rodada 2× por request)

Escrito contra commit: 9d5417f. Finding: PERF-02 (HIGH).

## Por que

- `lib/analytics/prize-correlation.ts:104-115`: `getLuckyNumbers()` e `getUnluckyNumbers()` chamam CADA UM `getPrizeCorrelation()` (scan UNION ALL 6×draws). `server.ts:575-576` chama os dois → 2 scans idênticos.
- `lib/analytics/streak-analysis.ts:145-153`: `getHotNumbers()`+`getColdNumbers()` → 2× `getHotStreaks()`. `server.ts:568-570`.
- `lib/analytics/delay-analysis.ts:129-131`: `getDelayDistribution()` re-chama `getNumberDelays()`. `server.ts:537-538`.

## Mudanças

Em cada engine, computar a lista completa uma vez e derivar os subconjuntos:
- `prize-correlation`: método público `getCorrelationSets()` (ou cache de instância) que roda o scan uma vez; lucky/unlucky filtram do resultado. Manter os métodos públicos existentes funcionando (chamam o compute-once internamente).
- `streak-analysis`: idem para hot/cold.
- `delay-analysis`: `getDelayDistribution()` aceita opcionalmente o array de delays já computado, ou cache de instância; `server.ts:537-538` passa a computar uma vez.
- Cache de instância é aceitável porque os engines são instanciados por request em `server.ts` (verifique; se forem singletons, use parâmetro explícito em vez de cache de instância).

## Testes

Os módulos prize-correlation/streak-analysis não têm testes (exclusões de coverage). Adicionar testes mínimos de igualdade semântica: lucky ∪ unlucky consistente com o scan único; hot/cold idem; distribution consistente com delays. Usar InMemoryDatabase se as queries já são suportadas pelo mock; senão, companion `.file.test.ts` no padrão de `tests/lib/analytics/delay-analysis.file.test.ts`.

## Verificação

```
bun run lint && bun run typecheck && bun run test -- --run
```

## Fora de escopo

Shape das respostas da API não muda. Sem otimização de SQL aqui (plano 005).
