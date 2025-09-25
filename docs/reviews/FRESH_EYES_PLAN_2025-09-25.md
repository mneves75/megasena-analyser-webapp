# Fresh Eyes Plan — 25/09/2025 22:58 (UTC-3)

## Situação Atual

- `megasena bets generate` grava lotes imediatamente; qualquer analista que rodar o comando sem querer altera o banco.
- As saídas JSON dos comandos `bets generate/list` ainda não têm testes de contrato → risco de quebrar automações.
- O histórico já contém payloads sem `emitted`; hoje tratamos isso no CLI, mas falta uma validação explícita para evitar regressões futuras.

## Objetivos

1. **Segurança operacional:** impedir gravações involuntárias via CLI em ambientes de análise/QA.
2. **Estabilidade de contrato:** garantir que respostas `--json` permaneçam compatíveis com pipelines existentes.
3. **Compatibilidade retroativa:** proteger o consumo de payloads (UI, CLI, APIs) quando campos novos não estiverem presentes.

## Plano Detalhado

### 1. Persistência opt-in

- [x] Alterar `src/cli/commands/bets.ts` para: _dry-run_ por padrão e somente persistir quando `--persist` estiver presente.
- [x] Ao persistir, registrar mensagem “✅ lote persistido” e, no modo dry-run, deixar claro que nada foi salvo.
- [x] Atualizar documentação (`README.md`, `docs/operations.md`) destacando a mudança e exemplos de uso.
- [ ] Adicionar entrada no changelog / seção de notas do time.

### 2. Testes de contrato JSON

- [x] Estender `src/cli/__tests__/commands.test.ts` com cenários:
  - `bets generate --json` → validar shape `{ persisted, tickets, payload, warnings }` e conteúdo crítico.
  - `bets list --json` → garantir que campos `seed`, `payload.ticketCostBreakdown`, `leftoverCents` apareçam.
- [x] Considerar snapshot minimalista (via `expect(object).toMatchObject`) para facilitar manutenção.
- [x] Integrar os testes ao target existente (`npm run test -- cli`) para rodarem no CI.

### 3. Compatibilidade legado

- [x] Criar teste unitário dedicado (ex.: `summarizeTicketBreakdown.legacy.test.ts`) cobrindo payloads sem `emitted`.
- [x] Ajustar `docs/data-contracts/strategy_payload.schema.json` para marcar `emitted` como opcional e registrar exemplo sem o campo.
- [x] Rodar `npm run typecheck` + suites relevantes após mudanças.

### 4. Comunicação & rollout

- [ ] Avisar o time (canal #mega-ops) sobre a mudança de comportamento do CLI.
- [ ] Agendar revisão de John Carmack para confirmar que a solução passa no crivo.

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
