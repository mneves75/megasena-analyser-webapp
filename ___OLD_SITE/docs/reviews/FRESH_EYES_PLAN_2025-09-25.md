# Fresh Eyes Plan — 25/09/2025 22:58 (UTC-3)

## Snapshot de Estado — 25/09/2025 14:25 (UTC-3)

- ✅ `megasena bets generate` está em modo dry-run por padrão e só persiste com `--persist`; docs de referência já refletem o novo fluxo.
- ✅ Cobertura de contrato JSON para `bets generate/list` foi adicionada e roda no alvo de testes CLI.
- ✅ Compatibilidade com payloads sem `emitted` está coberta via teste dedicado e schema atualizado.
- ⛔ Mensagens do CLI, `scripts/cli-smoke.ts` e `docs/CLI_TRANSCRIPTS.md` ainda referenciam `--dry-run`.
- ⛔ Falta entrada formal em changelog/notas internas descrevendo a mudança da flag.
- ⛔ Comunicação no canal #mega-ops e agendamento da revisão John Carmack permanecem pendentes.
- ⚠️ Precisamos cristalizar critérios de saída e registrar evidências (comandos + screenshots) antes de encerrar a rodada.

## Iteração 2 · Plano Reforçado (2025-09-25)

### Objetivos Reconfirmados

- Solidificar o novo fluxo `--persist` ponta a ponta, sem resíduos do nome antigo.
- Garantir contratos/documentação consistentes para quem consome CLI e JSON.
- Completar governança (changelog, broadcast, revisão) com artefatos verificáveis.

### Sequência Prioritária

1. Sanear todas as referências legadas ao flag `--dry-run`.
2. Atualizar materiais de suporte e scripts automáticos alinhando mensagens e exemplos.
3. Formalizar comunicação e revisão executiva.
4. Rodar validações finais (`npm run lint`, `npm run build`, testes CLI) e arquivar evidências.

### Tarefas Detalhadas

#### A. Propagação da flag `--persist`

- [ ] Atualizar mensagens do CLI (`src/cli/commands/bets.ts:145`) para instruir "use --persist"; rodar smoke command para validar saída.
- [ ] Revisar `scripts/cli-smoke.ts` removendo `--dry-run`; garantir que execuções que escrevem usem `--persist`.
- [ ] Revisar `docs/CLI_TRANSCRIPTS.md`, snippets de README e quaisquer outros exemplos (`rg "--dry-run"`) para substituir por orientações atuais.
- [ ] Adicionar teste rápido no CLI smoke para falhar caso `--dry-run` reapareça (ex.: assert de string).

#### B. Documentação & Comunicação

- [ ] Criar entrada no changelog/notas do time (`docs/operations.md` ou `docs/changelog.md`) com impacto, passos e mitigação.
- [ ] Redigir mensagem para `#mega-ops` destacando nova flag, passos de atualização e link para changelog; salvar rascunho em `docs/comms/2025-09-25-cli-flag.md`.
- [ ] Agendar revisão com John Carmack (inserir nota em `docs/reviews/log.md`) e anexar checklist de testes executados.

#### C. Garantias de Qualidade

- [ ] Documentar a matriz de comandos manuais executados (input/output) neste arquivo em seção “Evidências”.
- [ ] Rodar `npm run lint`, `npm run typecheck`, `npm run test -- cli`, `npm run build`; anotar resultados e timestamps.
- [ ] Capturar screenshot/output relevante após ajuste do CLI para anexar no PR.

### Métricas & Gates de Saída

- Todos os `rg "--dry-run" src scripts docs` retornam zero resultados relevantes.
- Changelog + comunicação publicados e referenciados no PR.
- Evidências anexadas e checklist QA marcada como concluída.

### Agenda & Donos

| Item                             | Dono    | Deadline (UTC-3) | Evidência                        |
| -------------------------------- | ------- | ---------------- | -------------------------------- |
| Referências `--dry-run` saneadas | mvneves | 25/09/2025 18:00 | CLI output + grep                |
| Artefatos de comunicação         | mvneves | 25/09/2025 19:00 | Changelog + rascunho mensagem    |
| Revisão John Carmack agendada    | mvneves | 25/09/2025 20:00 | Entrada em `docs/reviews/log.md` |
| QA finalizado                    | mvneves | 25/09/2025 20:30 | Logs dos comandos                |

### Próxima Revisão

- Reavaliar status em 25/09/2025 20:30 (UTC-3) com checklist completo; se algo derrapar, abrir Iteração 3 com escopo reduzido.

## Histórico da Iteração 1

### Situação Atual

- `megasena bets generate` grava lotes imediatamente; qualquer analista que rodar o comando sem querer altera o banco.
- As saídas JSON dos comandos `bets generate/list` ainda não têm testes de contrato → risco de quebrar automações.
- O histórico já contém payloads sem `emitted`; hoje tratamos isso no CLI, mas falta uma validação explícita para evitar regressões futuras.

### Objetivos

1. **Segurança operacional:** impedir gravações involuntárias via CLI em ambientes de análise/QA.
2. **Estabilidade de contrato:** garantir que respostas `--json` permaneçam compatíveis com pipelines existentes.
3. **Compatibilidade retroativa:** proteger o consumo de payloads (UI, CLI, APIs) quando campos novos não estiverem presentes.

### Plano Detalhado

#### 1. Persistência opt-in

- [x] Alterar `src/cli/commands/bets.ts` para: _dry-run_ por padrão e somente persistir quando `--persist` estiver presente.
- [x] Ao persistir, registrar mensagem “✅ lote persistido” e, no modo dry-run, deixar claro que nada foi salvo.
- [x] Atualizar documentação (`README.md`, `docs/operations.md`) destacando a mudança e exemplos de uso.
- [ ] Adicionar entrada no changelog / seção de notas do time.

#### 2. Testes de contrato JSON

- [x] Estender `src/cli/__tests__/commands.test.ts` com cenários:
  - `bets generate --json` → validar shape `{ persisted, tickets, payload, warnings }` e conteúdo crítico.
  - `bets list --json` → garantir que campos `seed`, `payload.ticketCostBreakdown`, `leftoverCents` apareçam.
- [x] Considerar snapshot minimalista (via `expect(object).toMatchObject`) para facilitar manutenção.
- [x] Integrar os testes ao target existente (`npm run test -- cli`) para rodarem no CI.

#### 3. Compatibilidade legado

- [x] Criar teste unitário dedicado (ex.: `summarizeTicketBreakdown.legacy.test.ts`) cobrindo payloads sem `emitted`.
- [x] Ajustar `docs/data-contracts/strategy_payload.schema.json` para marcar `emitted` como opcional e registrar exemplo sem o campo.
- [x] Rodar `npm run typecheck` + suites relevantes após mudanças.

#### 4. Comunicação & rollout

- [ ] Avisar o time (canal #mega-ops) sobre a mudança de comportamento do CLI.
- [ ] Agendar revisão de John Carmack para confirmar que a solução passa no crivo.

### Atualização · 25/09/2025 14:25 (UTC-3)

#### Pontos novos

1. **Mensagens e scripts ainda referenciam `--dry-run`** — O texto impresso pelo CLI (`src/cli/commands/bets.ts:145`), o script `scripts/cli-smoke.ts:27` e os transcripts (`docs/CLI_TRANSCRIPTS.md`) continuam usando a flag antiga. Isso gera erro de opção desconhecida e confusão operacional.
2. **Plano deve abranger atualização de exemplos** — README/ops já foram ajustados, mas precisamos garantir que todo material de referência (transcripts, smoke script) esteja sincronizado com `--persist`.

#### TODO complementares

- [ ] Atualizar mensagem do CLI para "use --persist" e revisar outros logs relacionados.
- [ ] Ajustar `scripts/cli-smoke.ts` removendo `--dry-run` e adicionando `--persist` somente onde for necessário.
- [ ] Revisar `docs/CLI_TRANSCRIPTS.md` e demais exemplos para refletir o novo fluxo.

## Riscos & Mitigações

- **Mudança de hábito do CLI:** usuários podem estranhar; mitigação via documentação e mensagem de console clara.
- **Tempo extra de testes:** novos cenários aumentam duração do job CLI; otimizar mocks (sem I/O real) e reutilizar fixtures.
- **Payloads externos:** se parceiros dependem da persistência instantânea, avaliar impacto antes de merge.

## Sequenciamento Sugerido

1. Implementar flag `--persist` opt-in + mensagens.
2. Escrever/rodar testes JSON; garantir green build.
3. Adicionar suíte legado (`summarizeTicketBreakdown`).
4. Atualizar docs/changelog e comunicar o time.

> Auditor responsável: John Carmack (como sempre 🤖).
