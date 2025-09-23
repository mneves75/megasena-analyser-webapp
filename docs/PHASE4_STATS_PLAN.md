# Plano de Implementação — Fase 4 (Estatísticas & Backtests)

## Objetivo

Entregar as rotas de estatísticas históricas da Mega-Sena com cálculos determinísticos e performance aceitável, alinhados ao escopo RF-4/RF-5.

## Escopo do Sprint

1. **Serviços de estatísticas (`src/services/stats.ts`)**
   - Frequências (globais e por janela `N` concursos).
   - Pares e trincas mais frequentes (parâmetros: `limit`, `window`).
   - Sequências consecutivas (runs) por concurso.
   - Soma total e paridade de cada concurso; histograma + média.
   - Quadrantes: contagem por faixas (1-10, 11-20, etc.).
   - Recência: concursos desde a última ocorrência de cada dezena.
   - Expor API interna para backtests (placeholder para fase 5).
2. **Cache controlado**
   - Utilizar `cache()` do Next ou camada in-memory simples invalidada via `revalidatePath('/api/stats')` após sync.
   - Aceitar query string `window`, `limit` e `top` conforme estatística.
3. **Rotas HTTP**
   - Estrutura `src/app/api/stats/[stat]/route.ts` com validação Zod dos parâmetros.
   - Respostas em JSON normalizado (valores monetários, médias, arrays ordenados).
4. **Testes**
   - Vitest para cada função de serviço usando fixtures (`docs/fixtures/sample-draw.json` + novos arrays). Cobrir múltiplas janelas.
   - Testar transformações (quadrantes, runs, recência) com dados sintéticos.
5. **Documentação**
   - Atualizar README (seção API) com exemplos de chamada.
   - Atualizar `docs/IMPLEMENTATION_PLAN.md` (Fase 4 progress/critério) e, se necessário, adicionar notas a `docs/data-contracts`.

## Riscos

- **Performance**: cálculos de pares/trincas via JS podem ser caros; usar queries SQL agregadas e limitar `limit`/`window`.
- **Cache**: evitar dados defasados; invalidar após sync e expor `X-Cache` header opcional.
- **Precisão**: floats ao dividir; usar números inteiros quando possível.

## Entregáveis

- Novo serviço `stats` com testes ✓
- Rotas `/api/stats/*` ✓
- README + Plano atualizados ✓
- Smoke test manual (`curl`) documentado ✓

## TODO Tracker

- [x] Implementar utilidades SQL para frequências, soma, quadrantes.
- [x] Implementar extração de pares/trincas usando `GROUP BY` e janelas.
- [x] Criar `src/app/api/stats/[stat]/route.ts` com Zod + cache.
- [x] Adicionar testes Vitest cobrindo estatísticas principais.
- [x] Atualizar README e `docs/IMPLEMENTATION_PLAN.md`.
- [x] Executar `npm test`, `npm run lint`, `npm run build`, `npm run sync -- --limit=1`.

> Backtesting completo permanece aberto para Fase 5 (ver `docs/IMPLEMENTATION_PLAN.md`).
