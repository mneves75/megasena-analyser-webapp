# Fresh Eyes Review – 24/09/2025

## Atualização · 24/09/2025 22:55 (UTC-3)

### Principais apontamentos

1. **Typecheck quebrado por dependência ausente** — `npm run typecheck` aborta com `TS2307` apontando para `src/components/ui/__tests__/chart.test.tsx:1`, porque `@testing-library/react` (e types) não constam em `devDependencies`. Sem isso, ninguém consegue cumprir o checklist (`lint` + `typecheck`) antes de abrir PR.
2. **Surface CLI sem testes nem guia operacional** — A CLI (`scripts/megasena-cli.ts`, `src/cli/**`) está exposta em `package.json` (`npm run cli`), mas não há nenhuma suíte cobrindo parsers, formatação JSON, nem orchestrations básicas (`summary`, `stats`, `sync`). Também faltam instruções no README/`docs/operations.md`, o que inviabiliza adoção por ops e oculta requisitos de ambiente (`DATABASE_URL`, flags padrão).
3. **Semântica de `ticketCostBreakdown[].planned` ficou ambígua** — Depois do ajuste em `src/services/bets.ts` (`buildTicketCostBreakdown` usa tickets emitidos, não slots planejados), o campo `planned` passou a refletir quantidade real de bilhetes gerados por `k`. O nome/cópia na UI ainda fala "planejados" (`src/components/forms/bet-generator-form.tsx:449`), e consumidores externos podem assumir que o valor representa planejamento. Precisamos renomear o atributo ou expor `planned` + `emitted` para evitar leituras incorretas.
4. **CLI bets: persistência automática pode surpreender** — (Mitigado em 25/09) o comando agora é _dry-run_ por padrão e exige `--persist` para gravar, reduzindo o risco de escrita involuntária (`src/cli/commands/bets.ts`).
5. **Cobertura JSON para CLI bets/list** — Testes adicionados para garantir shape estável das respostas, protegendo integrações headless (`src/cli/__tests__/commands.test.ts`).

### Plano & TODO

- [x] Incluir `@testing-library/react` nas dependências para restaurar `npm run typecheck`.
- [x] Criar suíte Vitest para o CLI (`summary`/`stats`/`sync`) cobrindo modo JSON e documentar o uso no README + `docs/operations.md`.
- [x] Expor tanto valores planejados quanto emitidos em `ticketCostBreakdown`, atualizar schema/UI/cópia para refletir a distinção.
- [x] Reavaliar padrão de persistência do comando `bets generate` (exigir `--persist`?) e, caso mantenha o comportamento atual, adicionar confirmação explícita na saída.
- [x] Cobrir `bets generate --json` e `bets list --json` em Vitest para garantir formato estável.

## Atualização · 24/09/2025 18:05 (UTC-3)

### Principais apontamentos

1. **Orçamento ignora `kOverride` nas execuções reais** – `generateBatch` envia `desiredK` para a estratégia (`src/services/bets.ts:272`), mas preserva `slot.costCents` calculado para o `k` planejado (`src/services/bets.ts:293` e `src/services/bets.ts:321-327`). Ao invocar `generateBatch({ budgetCents: 3600, seed: "CHECK-K7", strategies: [{ name: "uniform", kOverride: 7 }] })`, os tickets retornam `metadata.k = 7`, porém `costCents` e `totalCostCents` continuam em 600/3600. O payload persistido subestima gasto real, distorce leftover e propaga custo errado para `bet-store`/API.
2. **`generateTicket` devolve custo zerado** – A função exportada para gerar um único bilhete (`src/services/bets.ts:603-634`) seta `costCents: 0`. Qualquer fluxo (CLI, API, pré-visualização) que consuma essa função grava custo inválido, quebrando métricas e o contrato JSON que exige inteiros ≥ 0 com semântica real.
3. **Falta de cobertura para `kOverride`/payload misto** – Nenhum teste valida cenários com `kOverride` ou garante que `averageTicketCostCents`/`ticketCostBreakdown` refletem custos reais quando o `k` muda dinamicamente. O caso acima passaria despercebido; precisamos de suíte que confronte alocação, leftover e persistência com overrides e fallback.

### Plano & TODO

- [x] Atualizar `planTicketSlots`/`buildResult` para recalcular custo por ticket usando o `k` efetivo (inclusive overrides) e garantir que `totalCostCents`, `leftoverCents` e o payload persistido reflitam o gasto real; adicionar teste cobrindo `kOverride` sem `spreadBudget`.
- [x] Corrigir `generateTicket` para consultar `calculateTicketCost`/`calculateBudgetAllocation` e retornar `costCents` consistente com o `k` efetivo; adicionar teste unitário.
- [x] Escrever teste de integração em `src/services/__tests__/bets.test.ts` exercitando `kOverride` + modo distribuído para validar média, breakdown e warnings.
- [x] Revisar docs (`README`, `docs/data-contracts/strategy_payload.schema.json`) após o ajuste para sinalizar claramente a semântica de custo em lotes com overrides.

## Atualização · 24/09/2025 15:40 (UTC-3)

### Principais apontamentos

1. **Semântica do payload em lotes mistos** – `planning` agora admite múltiplos valores de `k`, porém `payload.ticketCostCents` continua refletindo apenas o custo-base da alocação inicial. Isso pode induzir dashboards/consumidores externos a interpretar o custo errado quando o modo distribuído estiver ativo. A solução sugerida é expor `averageTicketCostCents` ou derivar esse campo a partir do breakdown para manter compatibilidade.
2. **Nome do arquivo exportado** – `downloadPayload` (gerador de JSON na página `/generate`) ainda usa `payload.config.k`, redundante quando o orçamento é distribuído. O download deveria sinalizar "mixed" ou concatenar os valores presentes em `ticketCostBreakdown` para evitar confusão operacional.
3. **Acessibilidade visual dos botões** – alteramos o `primary` para laranja (`text-orange-500`), mas o estilo base conserva `focus-visible:outline-brand-500`/`ring-brand-500`. A inconsistência cromática reduz a previsibilidade da UI e pode comprometer contraste em alguns navegadores. Recomendado alinhar `baseStyles` para usar tokens laranja equivalentes ou reintroduzir tokens de `brand` via Tailwind extend.
4. **Documentação desatualizada** – README e notas técnicas ainda descrevem somente `balanced` e `uniform`. Precisamos registrar `hot-streak`, `cold-surge` e o novo checkbox de distribuição para manter onboarding atualizado.
5. **Cobertura de testes** – Não há testes que exercitem `spreadBudget`/`planTicketSlots` ou os algoritmos recém-adicionados. Pelo menos um teste determinístico por estratégia (mockando `getFrequencies`/`getRecency`) e cenários de alocação distribuída deveriam ser priorizados para evitar regressões silenciosas.

### Plano & TODO

- [x] Ajustar `StrategyPayload`/`buildResult` para reportar custo médio (ou revisar consumidores que dependem de `ticketCostCents`).
- [x] Atualizar `downloadPayload` para nomear arquivos com base no breakdown e exibir o modo (concentrado x distribuído).
- [x] Harmonizar tokens de foco/anneis do botão primário com a nova paleta laranja.
- [x] Revisar README + docs operacionais, descrevendo as novas estratégias e o toggle "Distribuir orçamento".
- [x] Adicionar suíte de testes cobrindo `hot-streak`, `cold-surge` e `spreadBudget` (idealmente em `src/services/__tests__/` e smoke e2e para `/generate`).

> Assinatura: Revisão "olhar fresco" pós-mudanças de estratégia/orçamento. Validar pendências antes do próximo PR.

> Auditor: React Server Components Expert · Pós-Fase E (layout refinado, fallback garantido).

## 1. Destaques

- **Sync consolidado:** `--full` recompõe todo o histórico por padrão (com `--limit` opcional) e o modo silencioso evita sequências ANSI quando não há TTY; README/planos refletem o novo comportamento.
- **Motor em produção:** `generateBetsAction` injeta fallback uniforme, `buildResult` reporta leftovers reais e registra métricas de tickets planejados vs. emitidos.
- **Experiência web coerente:** Home exibe banner orientando sincronização quando o banco está vazio, cards possuem variantes (`compact`, `comfortable`), botões não têm mais ripple e `Stack` padroniza espaçamentos. Histórico traz filtros com contexto, seeds mascaradas/copiar e metadados detalhados.
- **Home com respiro atualizado (24/09 13h10):** cards de destaque usam grid adaptável, fontes legíveis e fontes oficiais legíveis (CAIXA Notícias), enquanto o ranking de dezenas reutiliza `StatList` para exibir frequência/recência sem clipping.
- **Cobertura mínima de Server Action:** smoke test de `generateBetsAction` garante que o fallback está ativo e que persistência/revalidação são disparadas.

## 2. Checagens concluídas

| Item                                       | Status | Referência                                                                            |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------- |
| Restore roadmap + onboarding exposto       | ✅     | README, `/docs`, `docs/TEAM_ONBOARDING_GUIDE.md`                                      |
| Validar `/generate` (fallback + acorddeon) | ✅     | `docs/GENERATE_PAGE_DIAGNOSIS_PLAN.md`, `src/components/forms/bet-generator-form.tsx` |
| Sincronização full + CLI help              | ✅     | `src/services/sync.ts`, `scripts/sync.ts`, `docs/SYNC_REMEDIATION_PLAN.md`            |
| Logger pós-fix verificado                  | ✅     | `docs/DEV_SERVER_RECOVERY_PLAN.md`                                                    |
| Variantes de card/botão/Stack              | ✅     | `src/components/ui/*`, `tailwind.config.ts`                                           |
| Banner na Home quando DB vazio             | ✅     | `src/app/page.tsx`                                                                    |
| Filtros do histórico (24h) + contexto      | ✅     | `src/app/bets/page.tsx`                                                               |
| Seed copiável + quadrantes no acordeão     | ✅     | `src/app/bets/page.tsx`, `src/components/bets/copy-seed-button.tsx`                   |
| Métricas de geração parcial (logs)         | ✅     | `src/services/bets.ts`                                                                |
| Smoke test para Server Action              | ✅     | `src/app/generate/__tests__/generate-action.smoke.test.ts`                            |
| Home highlights e ranking com `StatList`   | ✅     | `src/app/page.tsx`, `docs/UI_REDESIGN_ACTION_PLAN.md`                                 |
| Lint / typecheck / build (24/09 13h14)     | ✅     | `npm run lint`, `npm run typecheck`, `npm run build`                                  |

## 3. Backlog supervisionado

1. **Observabilidade extra** – sumarizar warnings de geração parcial em dashboard (Stage 6 métricas).
2. **Banner "sem concursos" + call to action** – monitorar engajamento; avaliar CTA adicional (vídeo/guia) em próxima fase.
3. **Smoke tests adicionais** – cobrir `/api/bets` e `/api/stats` (to be scheduled com time de QA).

## 4. Próxima rodada sugerida

- Acompanhar logs dos lotes para identificar frequência de leftovers parciais.
- Planejar automação complementar (Vitest ou e2e) para `/api/bets`.
- Registrar prints atualizados (Light/Dark) no README após concluir UI backlog.

> Revisão encerrada 24/09/2025 às 00h55. Atualize esta página novamente após a próxima rodada de verificações.

---

## 24/09/2025 19:40 – Nova varredura "fresh eyes"

### Achados imediatos

1. **Ícone do alternador de tema não reage ao hover** – `ThemeToggle` usa `group-hover` na `<span>` interna, mas o botão não tem a classe `group`, então o efeito nunca ativa (`src/components/layout/theme-toggle.tsx:18-43`).
2. **Botão de copiar seed sem fallback para Clipboard API** – `CopySeedButton` assume `navigator.clipboard` disponível; quando indisponível apenas loga no console, sem feedback ao usuário nem fallback manual (`src/components/bets/copy-seed-button.tsx:10-22`).
3. **Estratégias "hot-streak" e "cold-surge" não expostas na UI** – `generateBetsAction` aceita essas estratégias e o service as executa, porém o formulário só lista "balanced" e "uniform". Falta decisão/documentação sobre disponibilizar as novas estratégias ou ocultá-las do schema (`src/app/generate/actions.ts:12-63`, `src/components/forms/bet-generator-form.tsx:65-111`). _Atualizado 20:05 – opções traduzidas e mantidas visíveis no seletor._
4. **Checklist de largura/ordenção requer QA manual** – Planos anteriores marcaram expansão de layout e sticky header, mas ainda não há registro de testes visuais (light/dark, breakpoints) nem de regressões no plan (`docs/bets-grid-polish-plan.md:28-57`).

### Plano de ação proposto

- [x] Corrigir alternador de tema adicionando `group` ao botão ou removendo a dependência de `group-hover`.
- [x] Reforçar `CopySeedButton` com guarda de disponibilidade (similar ao grid) e feedback de erro visível ao usuário.
- [x] Decidir sobre as novas estratégias: expor no formulário com descrição/localização ou restringir o schema para evitar parâmetros inválidos. Atualizar documentação conforme escolha.
- [ ] Rodar QA visual completo (light/dark, breakpoints md/lg/xl) e registrar resultados na checklist do plano (`docs/bets-grid-polish-plan.md`).
- [ ] Registrar essas descobertas no changelog/planos antes da próxima rodada de implementação.

---

## 24/09/2025 21:10 – Nova rodada (post Stage 6 hotfix)

### Achados atuais

| Área                           | Severidade | Evidência                                               | Descrição                                                                                                                                           | Próxima ação                                                                                                    |
| ------------------------------ | ---------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Persistência de apostas        | Alta       | `src/services/bet-store.ts:25`                          | `total_cost_cents` salva o custo unitário do bilhete, não o valor total do lote, distorcendo relatórios e payloads históricos.                      | Persistir o total real (`batch.totalCostCents`), migrar registros legados e atualizar fixtures/tests.           |
| Histórico / filtros            | Média      | `src/app/bets/page.tsx:20`                              | Dropdown de estratégias não inclui `hot-streak` nem `cold-surge`; usuários não conseguem filtrar lotes dessas estratégias recém expostas.           | Atualizar `STRATEGY_OPTIONS` e labels, validar integração com `listBets`, ajustar documentação.                 |
| UI Charts                      | Média      | `src/components/ui/chart.tsx:35-122`                    | Quando `max` ou `total` = 0, os cálculos geram `NaN`, quebrando altura das barras/pizza e provocando layout jump.                                   | Normalizar divisores (fallback), ocultar valores quando não houver dados e cobrir via testes visuais.           |
| Gerador – presets de orçamento | Média      | `src/components/forms/bet-generator-form.tsx:74`        | Preset "R$ 1.000,00" viola `maxBudgetCents` (R$ 500); ação padrão gera erro de orçamento sem guidance prévio.                                       | Alinhar presets aos limites vigentes ou aumentar `maxBudgetCents` com auditoria/documentação.                   |
| Links `REPO_BASE`              | Baixa      | `src/app/stats/page.tsx:23`, `src/app/docs/page.tsx:13` | Base de links continua apontando para `megasena-analyser-webapp`; confirmar se este segue sendo o remoto oficial após rename local para `*-nextjs`. | Verificar origem oficial; atualizar base e corrigir referências em `docs/INSTALLATION_MANUAL.md` se necessário. |

### TODO incrementais

- [x] Corrigir cálculo/persistência de custos e rodar script de migração para bets já armazenadas.
- [x] Expor estratégias `hot-streak`/`cold-surge` no histórico de bets (seletores e exibição amigável).
- [x] Tornar `Chart` resiliente a datasets vazios/zero, com testes cobrindo barras/pizza/donut.
- [x] Revisar presets de orçamento no gerador versus `strategy-limits`; atualizar feedback do formulário.
- [x] Auditar referências de repositório nos componentes e docs para evitar links quebrados.

> Próximos passos: após as correções acima, reexecutar `npm run lint && npm run build`, validar `/bets` com lotes mixados e registrar evidências visuais para atualização futura do README.

Script utilitário adicionado: `npm run db:fix-bet-totals` normaliza os registros existentes em `Bet.total_cost_cents` utilizando o valor agregado presente no payload de geração.

## 24/09/2025 20:05 – Ações executadas

- Theme toggle recebeu classe `group` para liberar animação `group-hover` (src/components/layout/theme-toggle.tsx:20-28).
- Botão `CopySeedButton` agora usa fallback com textarea oculto, feedback de erro e limpeza de temporizadores (src/components/bets/copy-seed-button.tsx:1-82).
- Labels das estratégias secundárias foram traduzidas para pt-BR para alinhar UI com schema (`Sequência aquecida`, `Onda fria`) (src/components/forms/bet-generator-form.tsx:79-95).
- Plano de polimento atualizado com observações e marcação dos testes a serem capturados em QA visual (docs/bets-grid-polish-plan.md:24-66).

## Atualização · 25/09/2025 22:30 (UTC-3)

### Principais apontamentos

1. **Dialog de metadados exibe JSON cru sem sanitização** – o novo `TicketMetadataDialog` (`src/components/bets/ticket-metadata-dialog.tsx`) imprime `JSON.stringify` diretamente dentro de `<pre>`. Estruturas profundas em `metadata` (ex.: arrays grandes, objetos aninhados) podem gerar saída ilegível e estourar o layout do modal. Precisamos limitar profundidade ou aplicar formatação colapsável.
2. **Mapper de estratégia replicado** – há duas implementações concorrentes (`src/services/strategies/labels.ts` e objetos inline antigos). Garantir que grids, API payloads e documentação usem um único módulo para evitar divergência futura.
3. **Smoke script assume DB local** – `scripts/cli-smoke.ts` falha silenciosamente se `npm run db:migrate` não foi executado; ideal validar upfront ou oferecer seed automática.
4. **Planos de QA ainda pendentes** – `docs/bets-grid-polish-plan.md` e `docs/generate-page-polish-plan.md` marcam QA/documentação como pendentes; precisamos fechar antes do PR (capturas, testes manuais, atualização de changelog).

### Plano & TODO

- [x] Atualizar `TicketMetadataDialog` para formatar `metadata` com sanitização (por exemplo, truncar chaves profundas ou usar viewer colapsável) e limitar altura do `<pre>` com scroll.
- [x] Consolidar mapeamento de estratégias expondo helper único (`getStrategyLabel`) e remover qualquer resquício duplicado; acrescentar teste cobrindo importadores.
- [x] Melhorar `cli-smoke`: abortar com mensagem clara quando o banco estiver vazio ou oferecer opção de rodar `db:migrate`/`db:seed` automaticamente.
- [ ] Finalizar QA/documentação pendentes (screenshots light/dark, lista de testes manuais) e atualizar o changelog conforme entregas visuais.
