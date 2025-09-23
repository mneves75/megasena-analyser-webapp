# Estratégia Balanceada — Mega-Sena

## Contexto

- **Data da revisão:** 23/09/2025
- **Seed padrão para auditoria:** `BALANCED-SEED`
- **Janela estatística:** últimos 50 concursos (configurável via `window`)
- **Fonte de dados:** `getFrequencies` e `getQuadrants` em `src/services/stats.ts`

## Objetivo

Construir apostas com seis dezenas que:

1. Cubram os seis quadrantes (01-10, 11-20, ..., 51-60) sempre que `k ≥ 6`.
2. Respeitem paridade "razoável" — diferença máxima de 2 entre quantidades pares e ímpares.
3. Ponderem a escolha das dezenas por frequência histórica (janela configurável), mantendo determinismo por `seed`.

## Algoritmo

1. **Seed & PRNG** — inicializamos `mulberry32(seed)` (ver `src/lib/random.ts`) para garantir reprodutibilidade.
2. **Targets por quadrante** —
   - Base = `floor(k / 6)`.
   - Distribuímos o restante (`k % 6`) para os quadrantes com maior total histórico.
   - Quando `k ≥ 6`, garantimos pelo menos uma dezena por quadrante e ajustamos até somar `k`.
3. **Mapa de frequências** —
   - `getFrequencies` retorna frequência relativa de cada dezena.
   - Dezenas não sorteadas recebem peso zero.
4. **Seleção iterativa** — para cada quadrante:
   - Filtramos dezenas ainda não usadas.
   - Escolhemos a paridade preferencial respeitando metas (≈ metade par, metade ímpar).
   - Aplicamos `weightedPick` com peso `frequency + 1` para evitar zeros absolutos.
5. **Metadados & score** —
   - Calculamos soma total, paridade, distribuição por quadrante e pontuação média (`avg frequency`).

## Exemplo gerado

```
seed: BALANCED-SEED
window: 50
dezenas: [3, 14, 28, 35, 46, 51]
paridade: { even: 4, odd: 2 }
quadrantes: 1 dezena em cada intervalo de 10
score (freq média): 0.0833
```

## Considerações

- Caso o banco não possua concursos suficientes, a estratégia ainda distribui valores por quadrante e alterna paridade; o peso zero resulta em escolha aproximadamente uniforme.
- Para `k > 6`, os quadrantes com maior frequência acumulada recebem as dezenas extras.
- A paridade-alvo (metade par, metade ímpar) pode ser refinada após monitorar resultados reais.

## Próximos passos

- Avaliar métricas adicionais (soma-alvo, pares mais comuns) para versão 2.
- Integrar `strategy_payload` com score detalhado (histograma de frequências, distância da média global).
- Expandir cobertura para `k = 7..15` após validar heurística de distribuição extra.
