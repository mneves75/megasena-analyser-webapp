# Fresh Eyes Actions – 25/09/2025

## Context

- Revisão mais recente apontou problemas no `TicketMetadataDialog`, duplicação de mapeamento de estratégias, fragilidade do `cli-smoke` e pendências de QA/documentação.
- Objetivo: endereçar cada achado, garantindo comportamento robusto e documentação atualizada para PR imediato.

## Iterative Plan

### Iteração 1 – Higienização do diálogo de metadados

- [x] Implementar utilitário para truncar/colapsar objetos profundos ao renderizar JSON.
- [x] Limitar altura do `<pre>` com `max-h` + scroll e ajustar semântica (adicionar título/subtítulo).
- [x] Cobrir com teste que valida truncamento e ausência de `dangerouslySetInnerHTML`.

### Iteração 2 – Mapeamento de estratégias consolidado

- [x] Mover `getStrategyLabel` para módulo único (`src/services/strategies/labels.ts`).
- [x] Atualizar grids, API e UI para consumir o helper centralizado.
- [x] Adicionar testes (unit e CLI) garantindo consistência.

### Iteração 3 – Robustez do CLI smoke

- [x] Verificar presença de `DATABASE_URL` e se o banco possui dados antes de executar comandos.
- [x] Oferecer flag `--prepare` para rodar `db:migrate`/`db:seed` ou abortar com instrução clara.
- [x] Documentar comportamento no README/operations.

### Iteração 4 – QA & Documentação

- [x] Atualizar planos (`docs/bets-grid-polish-plan.md`, `docs/generate-page-polish-plan.md`) com checkboxes concluídos.
- [x] Registrar testes manuais (ordenar grid, copiar, modal) e referenciar `npm run cli:smoke`.
- [ ] Adicionar screenshots light/dark e concluir anotação final no changelog.

## TODO Consolidado

- [x] Dialog sanitizado e responsivo.
- [x] Strategy labels centralizados e testados.
- [x] CLI smoke robusto com validações.
- [ ] QA/documentação atualizados (capturas pendentes).

> Após cada iteração, rodar `npm run lint`, `npm run typecheck` e testes relevantes.
