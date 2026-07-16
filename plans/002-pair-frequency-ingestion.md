# 002 — Atualizar `number_pair_frequency` na ingestão (dados de pares estão 111 concursos atrasados)

Escrito contra commit: 9d5417f. Findings: PERF-04 (HIGH, também correctness).

## Por que

- `scripts/pull-draws.ts:192` chama `stats.updateNumberFrequencies()` mas nunca atualiza pares.
- `lib/analytics/pair-analysis.ts:124-148` só reconstrói a tabela quando `cacheCount === 0`, dentro de `BEGIN IMMEDIATE TRANSACTION` no caminho de LEITURA (segura write-lock durante GET).
- Estado real verificado: `SELECT MAX(last_occurred_contest) FROM number_pair_frequency` = **2920**; draws vão até **3031**. A seção "Pares Mais Frequentes" serve dados congelados.

## Mudanças

1. `scripts/pull-draws.ts`: após `updateNumberFrequencies()`, reconstruir pares: instanciar `PairAnalysisEngine` e chamar `updatePairFrequencies()` (sempre que houve draws novos; incondicional é aceitável — é ingestão offline).
2. `lib/analytics/pair-analysis.ts`: remover o rebuild lazy do caminho de leitura (`getNumberPairs`): se `cacheCount === 0`, retornar lista vazia com log de aviso estruturado (tabela é populada pela ingestão/migração), OU detectar staleness por `MAX(last_occurred_contest) < MAX(contest_number)` e reconstruir — escolha a primeira opção (mais simples e sem lock em GET).
3. Garantir que o fluxo documentado de atualização de banco (docs e memória do projeto usam `pull-draws --start N --incremental`) deixa os pares corretos.
4. Rodar a atualização no banco local desta máquina como parte da verificação (comando abaixo) — o banco local deve terminar com pares em 3031.

## Testes

- Teste unitário do novo comportamento de `getNumberPairs` com cache vazio (retorna vazio + não escreve).
- Se exequível com InMemoryDatabase, teste de que `updatePairFrequencies` é chamado no fluxo do pull (extraia a orquestração para função testável se necessário; senão, documente no plano de testes por que não).

## Verificação

```
bun run lint && bun run typecheck && bun run test -- --run
bun -e "const {PairAnalysisEngine}=require('./lib/analytics/pair-analysis.ts'); new PairAnalysisEngine().updatePairFrequencies(); console.log('pairs rebuilt')"  # ou script equivalente
sqlite3 db/mega-sena.db "SELECT MAX(last_occurred_contest) FROM number_pair_frequency;"  # → 3031
```

## Fora de escopo

NÃO otimizar o algoritmo de contagem de pares aqui (plano 005 cuida do N+1).
