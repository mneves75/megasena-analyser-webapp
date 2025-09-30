# Plano · Estratégias adicionais & controle de orçamento

**Data:** 24 de setembro de 2025  
**Responsável:** Codex (com revisão de John Carmack)

## Contexto & objetivos

A geração de apostas atualmente oferece duas estratégias (`balanced`, `uniform`) e sempre converte o orçamento em apostas de menor custo (k padrão). Para acompanhar práticas recentes de produtos de Loteria Analytics:

- Precisamos diversificar o portfólio de algoritmos com abordagens complementares (quente/frio) para usuários que desejam cenários contrastantes.
- Devemos dar ao usuário controle explícito sobre como o orçamento é aplicado: concentrar no tíquete mais barato ou distribuir entre apostas com diferentes quantidades de dezenas (maior custo, maior cobertura).

## Diagnóstico atual

- `generateBatch` assume um único custo por tíquete e calcula `maxTickets` usando `calculateBudgetAllocation`.
- `StrategyName` engloba apenas `balanced` e `uniform`; o formulário renderiza uma lista fixa sem descrição extensível.
- Não há sinalização de orçamento no payload além de `requestedBudgetCents`/`leftoverCents`.
- Preços por `k` já estão disponíveis via `price` table ou fallback combinatório.

## Estratégias propostas

1. **Hot streak (`hot-streak`)**
   - Ponderar dezenas pela frequência recente (janela configurável).
   - Geração com `weightedPick` + normalização para priorizar números com maior `frequency`.
   - Metadados expõem janela, média de frequência ponderada, top n selecionados.

2. **Cold recovery (`cold-surge`)**
   - Usar `getRecency` para favorecer dezenas que estão há mais concursos sem aparecer.
   - Implementar ranking por `contestsSinceLast` e aplicar amostragem proporcional ao atraso.
   - Metadados relatam percentil de recência e ticket score baseado na média de atraso.

3. **Budget distribution toggle**
   - Novo campo booleano `spreadBudget` (checkbox) no formulário.
   - Se `false`: comportamento atual (somente custo base `k` padrão).
   - Se `true`: alocar orçamento sequencialmente entre faixas de `k` (ex.: [6,7,8]) respeitando limites e estoque (`limits.maxDezenaCount`).
   - Ajustar `generateBatch` para aceitar plano de tíquetes com `k` variável (`ticketsPlan`) e repassar `k` específico a cada execução de estratégia.
   - Payload/reporting deve indicar quantos tíquetes por `k` e custo agregado.

## Plano de execução

1. **Modelagem & contratos**
   - Estender `StrategyName`, schemas e zod validators.
   - Atualizar `StrategyRequest` para aceitar `kOverride` (opcional) + modo de distribuição no request.
   - Adaptar `generateBatch`/`calculateBudgetAllocation` para plano de múltiplos `k` quando `spreadBudget` ativo.
   - Garantir métricas/metadata acomodam `k` variável.

2. **Implementação das novas estratégias**
   - Criar módulos `hot-streak.ts` e `cold-surge.ts` reutilizando helpers (frequências, recência).
   - Incluir comentários/documentação técnicas em cada algoritmo.
   - Registrar na index, tests de unidade focando nos pesos e limites.

3. **Interface & UX**
   - Atualizar `BetGeneratorForm` para exibir as novas opções com descrições.
   - Introduzir checkbox "Distribuir orçamento em múltiplos tipos de aposta" com tooltip explicando impacto.
   - Enviar novo campo ao server action, refletir estado na seção de resumo.

4. **Persistência & relatórios**
   - Expandir payload/batch store para capturar distribuição por `k`.
   - Atualizar `tickets-grid` (se necessário) para exibir `k`/custo por ticket.
   - Documentar no README + `docs/` manual de uso.

5. **Validação**
   - Rodar `npm run lint`, `npm run typecheck`.
   - Escrever testes unitários para algoritmos de estratégia (peculiar).
   - Registrar validação manual (ex.: orçamentos 600, 1800) em `docs/manual-tests.md`.

## TODO (incluir progresso real-time)

- [x] Ajustar tipos e contratos (`StrategyName`, schemas, payload) para suportar novas estratégias e `k` dinâmico.
- [x] Implementar `hot-streak` com pesos por frequência recente e cobertura de paridade/quadrantes.
- [x] Implementar `cold-surge` priorizando dezenas mais atrasadas, com fallback seguro.
- [x] Criar mecanismo de distribuição de orçamento (modo concentrado vs distribuído) e integrar no batch generator.
- [x] Atualizar formulário, server action e resumo para o novo checkbox + exposições de dados.
- [ ] Cobrir com testes direcionados (estratégias, plano de orçamento) e executar lint/typecheck.
- [ ] Atualizar documentação de uso e registrar validação manual.

> _Este plano será iterado conforme descobertas surgirem durante a implementação._
