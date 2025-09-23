# Plano Iterativo Mega-Sena Analyzer

## Diretrizes Norteadoras

- Seguir o escopo de `docs/PROMPT MEGASENA APP.md`, priorizando cobertura estatística e alocação ótima de orçamento sem prometer previsões.
- Stack obrigatória: Next.js (App Router + TypeScript) + Tailwind + shadcn/ui + SQLite/Prisma; libs adicionais só com justificativa documentada no README (follow `docs/Agent Configuration React Server Comp.md`).
- Toda comunicação técnica (UI, README, comentários, logs) permanece em português brasileiro; preços e regras devem citar fontes oficiais CAIXA.
- Manter experiência premium: mobile-first, tipografia Inter, microinterações suaves, contraste adequado e acessibilidade AA como mínimo.
- Seguir o guia "Agent Configuration · React Server Components" para separar responsabilidades entre componentes server/client e server actions desde Fase 2 em diante.

## Visão Geral das Fases

1. **Fundamentos do Projeto** – Ambiente, tooling, tokens de design, layout base.
2. **Persistência & Schema** – Prisma + SQLite, migrations, seeds.
3. **Ingestão CAIXA** – Cliente resiliente, rota `/api/sync`, logs, idempotência.
4. **Estatísticas & Backtests** – Serviços métricos, cache, validação.
5. **Motor de Apostas** – Estratégias, otimização, persistência de apostas.
6. **Dashboard & UX** – Páginas, gráficos, microinterações, avisos.
7. **Automação & Qualidade** – Cron, autenticação, testes, CI, observabilidade.
8. **Entrega & Documentação** – README final, exportação, compliance.

## Sequenciamento por Sprint (2 semanas cada)

- **Sprint 0 (Planejamento)**: Refinar requisitos, validar contrato CAIXA, wireframes mobile/desktop, definir tokens iniciais.
- **Sprint 1 (Fase 1)**: Tooling completo, componentes base, layout shell, lint/build estáveis.
- **Sprint 2 (Fase 2)**: Prisma + migrations + seeds; fixtures sintéticas.
- **Sprint 3 (Fase 3)**: Ingestão CAIXA, sync incremental, cobertura de testes parsing.
- **Sprint 4 (Fase 4)**: Serviços de estatísticas + backtesting inicial + docs métricas.
- **Sprint 5 (Fase 5)**: Motor de apostas + testes de estratégia + persistência.
- **Sprint 6 (Fase 6)**: Integração UI/UX com dados, gráficos, microinterações.
- **Sprint 7 (Fase 7)**: Automação, cron, CI/CD, testes completos, monitoramento.
- **Sprint 8 (Fase 8)**: Documentação final, exportações, revisão legal, checklist release.

## Resumo de Progresso Atual

- **Fase 1**: quase concluída — tooling, tokens e layout base entregues; falta auditoria de acessibilidade e baseline visual.
- **Fase 2**: concluída — Prisma/SQLite, seeds oficiais, fixtures e documentação `docs/data-contracts` prontas.
- **Fase 3**: em andamento — cliente CAIXA, rota `/api/sync`, CLI e logging entregues; testes automatizados ainda pendentes.
- **Fases 4-8**: planejadas e dependem da finalização da Fase 3 e posterior priorização.

## Detalhamento por Fase com Backlog e Critérios

### Fase 1 — Fundamentos do Projeto _(Status: quase concluída)_

- **Objetivo**: Base consistente para colaboração e design premium.
- **Backlog atualizado**:
  - [x] Scaffold Next.js App Router + TypeScript + Tailwind 4 (`npm create next-app`).
  - [x] Instalar shadcn/ui, importar componentes essenciais.
  - [x] Ajustar ESLint (flat config), Prettier, scripts `dev`, `build`, `lint`, `typecheck`, `format`, `prepare`, Husky + lint-staged.
  - [x] Definir tokens em `tailwind.config.ts` e documentar em `docs/design/tokens.md`.
  - [x] Criar componentes base (`Button` com ripple e animation), `Card`, `AppShell`/`Navigation` e páginas placeholder.
  - [ ] Rodar auditoria inicial de acessibilidade (axe DevTools) e anotar gaps prioritários.
  - [ ] Registrar screenshots comparativos (mobile/desktop) para servir como baseline visual.
- **Critérios de Saída**: `npm run lint`/`build` estáveis (✅), layout responsivo funcional (✅), tokens documentados (✅), checklist de acessibilidade inicial e baseline visual capturados (pendente).

### Fase 2 — Persistência & Schema _(Status: próximo sprint)_

- **Objetivo**: Banco modelado, migrations reproduzíveis, seeds mínimas alinhadas ao domínio da Mega-Sena.
- **Backlog**:
  - [x] Configurar Prisma + SQLite com `.env` específicos para `development`, `test`, `preview` e script `npm run db:migrate`.
  - [x] Modelar tabelas `draw`, `draw_dezenas`, `prize_faixas`, `meta`, `prices`, `bets`, garantindo chaves únicas, índices por consulta e documentação (`docs/data-contracts/`).
  - [x] Criar camada `src/data/**` server-only exportando funções usadas pelos Server Components (seguindo guia RSC).
  - [x] Rodar `prisma migrate dev` com migrations nomeadas + revisão SQL gerada.
  - [x] Implementar `prisma db seed` com preços oficiais (fonte + data) e registro de versão em `meta`.
  - [x] Gerar fixtures sintéticas (`docs/fixtures/*.json`) e instruções em `docs/fixtures/README.md`.
  - [x] Atualizar README com instruções de banco, scripts e política de seeds/fixtures.
- **Critérios de Saída**: Migrations executam sem falhas (✅); seeds idempotentes (✅); camada `src/data` disponível (✅); documentação e fixtures prontos (✅).

### Fase 3 — Ingestão CAIXA _(Status: em andamento)_

- **Objetivo**: Sincronizar histórico oficial com resiliência e aderência ao guia RSC.
- **Backlog**:
  - [x] Formalizar contrato JSON (zod) com campos nulos/opcionais documentados em `docs/data-contracts/`.
  - [x] Desenvolver cliente HTTP com retry exponencial, timeout configurável e módulo server-only (`@/data/caixa-client`).
  - [x] Implementar rota `POST /api/sync` protegida por token + logs estruturados.
  - [x] Criar comando CLI `npm run sync` compartilhando a mesma lógica.
  - [x] Lógica incremental via UPSERT transacional e atualização da tabela `meta`.
  - [x] Logging estruturado (pino) com métricas básicas.
  - [x] Testes unitários (Vitest) cobrindo parsing/retries e geração de payload usando fixtures sintéticas.
- **Critérios de Saída**: Histórico completo persistido (parcial: depende de execução real); reexecução incremental sem duplicatas; logs auditáveis; contratos documentados; testes de integração completos ainda planejados.

### Fase 4 — Estatísticas & Backtests _(Status: planejado)_

- **Objetivo**: Expor métricas determinísticas e histórico de cobertura.
- **Backlog**:
  - [x] Implementar serviços internos para frequências, pares/trincas, sequências, soma/paridade, quadrantes, recência (módulos server-only).
  - [x] Expor rotas `/api/stats/*` consumindo esses serviços.
  - [x] Criar cache memoizado invalidado após sync CAIXA.
  - [ ] Construir módulo de backtesting determinístico (entrada: estratégia + janela; saída: métricas).
  - [x] Testes unitários com fixtures cobrindo estatísticas principais.
  - [ ] Documentar fórmulas e exemplos numéricos em `docs/stats.md`.
- **Critérios de Saída**: APIs respondem <500ms dataset médio; testes verdes; documentação revisada; cache invalidado no sync; backtesting completo pendente.

### Fase 5 — Motor de Apostas _(Status: em andamento — Stages 0-2 concluídos)_

- **Objetivo**: Gerar apostas otimizadas dentro do orçamento e regras oficiais.
- **Backlog**:
- [x] Serviço de precificação: buscar dados oficiais; fallback `.env` com aviso legal/documentação.
- [x] Implementar combinatória `C(k,6)` com validação de limites (ver `strategy-limits.ts`).
- [x] Desenvolver estratégias iniciais:
  - [x] Uniforme não enviesada.
  - [x] Distribuição balanceada por faixas/paridade.
  - [ ] Cobertura de pares/trincas mais frequentes com penalização de repetição (post-MVP Stage 6).
  - [ ] Diversificação por recência/soma (roadmap pós-MVP).
- [ ] Criar solver híbrido (greedy inicial + busca local) com limites de tempo e abort controller; aceitar seed determinístico.
- [ ] Implementar workflow `generateBatch` com timeout, métricas e deduplicação (núcleo concluído; logging estrutural e schema AJV pendentes).
- [x] Persistir apostas (`bets`) com metadata (`strategy_payload`), expor Server Action/rotas para consulta e geração (Stage 4 em progresso).
- [ ] Testes de integração: verificar custo total <= orçamento, ausência de duplicatas, consistência com seed.
- **Critérios de Saída**: Motor gera apostas válidas em cenários simples/múltiplos; testes validam custos e cobertura; logs explicam decisões; revalidações do dashboard configuradas.

### Fase 6 — Dashboard & UX _(Status: planejado)_

- **Objetivo**: UI premium conectada aos dados com microinterações fluidas.
- **Backlog**:
  - [ ] Integrar páginas às Server Actions/serviços via SWR ou React Query com estados de carregamento/skeleton.
  - [ ] Renderizar gráficos (Chart.js ou alternativa justificada) com theming custom, animações suaves e acessíveis.
  - [ ] Implementar microinterações (Framer Motion/Tailwind transitions), ripple personalizado, drag-and-drop opcional (ex.: reordenar estratégias).
  - [ ] Adicionar aviso legal destacado, tooltips educativos, configurações persistidas (`localStorage` + fallback server).
  - [ ] Garantir suporte mobile/desktop, dark/light mode, testes manuais de acessibilidade (teclado, leitor de tela).
- **Critérios de Saída**: Lighthouse >90 (performance/acessibilidade); QA UX aprovado; strings PT-BR revisadas; microinterações documentadas.

### Fase 7 — Automação & Qualidade _(Status: planejado)_

- **Objetivo**: Operação confiável end-to-end.
- **Backlog**:
  - [ ] Configurar node-cron para sync local e documentação para Vercel Cron (crontab, variáveis, observabilidade).
  - [ ] Implementar `/api/health`, `/api/ping`, monitoramento básico, alertas em caso de falha (ex.: webhook Slack futuramente).
  - [ ] Montar suíte Vitest + Testing Library (unidade/componente) + Playwright (fluxos críticos) com coverage inicial ≥70% nos módulos críticos.
  - [ ] GitHub Actions: pipelines `lint`, `typecheck`, `build`, `test`, `e2e` (condicional em PR). Adicionar badge no README.
  - [ ] Logs estruturados (pino) com exportação de métricas (tempo, status) e definição de retentiva mínima.
  - [ ] Documentar runbooks, rotações de segredo e processo de incidentes em `docs/operations.md`.
- **Critérios de Saída**: CI verde; cron validado; logs detalhados; cobertura inicial atingida; playbooks publicados.

### Fase 8 — Entrega & Documentação _(Status: planejado)_

- **Objetivo**: Preparação final para release público.
- **Backlog**:
  - [ ] Atualizar README com instruções completas, fontes oficiais (URL + data), exemplos, aviso legal e seção de limitações.
  - [ ] Criar guias `OPERATIONS.md`, `LEGAL.md`, `API_USAGE.md`, `EXPORT_GUIDE.md`.
  - [ ] Implementar exportação CSV/PDF das apostas e registrar auditoria (registro em `meta` ou logs dedicados).
  - [ ] Executar checklist final (acessibilidade, segurança, performance) e anexar relatório em `docs/release-notes/v1.md`.
  - [ ] Planejar roadmap pós-lançamento (ex.: integrações extras, simulações) e backlog futuro.
- **Critérios de Saída**: Documentação abrangente; build de produção validado; checklist assinado por responsáveis; roadmap pós-lançamento registrado.

## Capacidades Transversais

- **Observabilidade**: Logs JSON com `requestId`, métricas agregadas, tracing leve opcional (ex.: OpenTelemetry no futuro).
- **Segurança**: Validação de input, proteção contra rate limiting, gestão de segredos `.env.local`, guidelines para Vercel.
- **Escalabilidade**: Abstração de repositório para trocar SQLite → Postgres; monitorar tamanho, usar `VACUUM`, planejar partição.
- **Acessibilidade**: Revisões contínuas com axe, checklist WCAG AA, componentes shadcn acessíveis.

## Riscos & Mitigações

- **Instabilidade API CAIXA** → Cache local + retries, monitoramento de schema, fallback manual documentado.
- **Complexidade combinatória** → Limitar busca, heurísticas incrementais, métricas de tempo, abort controller.
- **Crescimento dataset** → Partição anual, `VACUUM`, monitorar limites de arquivo, preparar migração Postgres.
- **Preços desatualizados** → Tela de alerta, rotina de verificação periódica, registro de data da última atualização.
- **Dependência de UI premium** → Revisões frequentes com designer/referências, testes de usabilidade, guidelines documentadas.

## Cadência e Governança

- Daily stand-up focado em blockers.
- Weekly review + planejamento; atualizar checkboxes e riscos.
- Demo ao final de cada sprint com validação dos critérios de saída.
- Retro quinzenal para ajustar processos (design, engenharia, dados).
- Atualizar este documento a cada marco; arquivar versões anteriores em `docs/history/`.

## Indicadores & SLAs Internos

- Sync completo ≤ 10 minutos (em histórico atual).
- Geração de apostas ≤ 3 segundos para orçamento padrão (≤ R$ 500).
- Disponibilidade das APIs internas ≥ 99% durante horário comercial.
- Tempo de resposta stats APIs ≤ 500ms dataset médio.

## Todo Tracker Global

- [x] Confirmar contrato da API CAIXA (campos nulos, ranges, paginação) e documentar em `docs/data-contracts/`.
- [ ] Definir níveis de log e correlação (`requestId`, `spanId`) para sync, stats, motor; registrar em `docs/operations.md`.
- [ ] Criar wireframes mobile/desktop e salvar em `docs/design/wireframes/` com comentários de UX.
- [x] Elaborar seed inicial de preços com data + URL oficial e rotina de atualização manual.
- [x] Especificar cenários de teste para cada estratégia em `docs/testing/strategies.md` (baseline, limites, edge cases).
- [ ] Configurar pipeline CI mínima (lint + build) enquanto suíte completa não estiver pronta.
- [ ] Planejar dataset sintético determinístico para e2e, armazenando seed em `docs/fixtures/README.md`.
- [ ] Mapear requisitos legais (avisos, termos, LGPD) em `docs/legal/analysis.md`.
- [ ] Definir SLAs e indicadores detalhados em `docs/operations.md` com plano de monitoração.
- [ ] Avaliar bibliotecas Chart.js vs alternativas (recharts, nivo) e justificar escolha final no README.
- [x] Implementar testes automáticos (Vitest) para `@/data/caixa-client` e `@/services/sync` usando fixtures sintéticas.
