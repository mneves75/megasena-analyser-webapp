# Plans — audit improve (deep), 2026-07-15

Escritos contra commit `9d5417f` (working tree contém redesign 2026 não commitado — os planos NÃO tocam nos arquivos do redesign: `components/site-header.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/dashboard/**/page.tsx`, `components/statistics/section-nav.tsx`, `components/generator/*`).

## Ordem de execução e dependências

| # | Plano | Findings | Depende de | Status |
|---|-------|----------|------------|--------|
| 001 | [iso-draw-dates](001-iso-draw-dates.md) | CORRECTNESS-01/02/03 (HIGH) | — | DONE |
| 002 | [pair-frequency-ingestion](002-pair-frequency-ingestion.md) | PERF-04 / correctness (HIGH) | — | DONE |
| 003 | [statistics-cache-by-contest](003-statistics-cache-by-contest.md) | PERF-01 (HIGH) + SECURITY-01 (MED) | 004, 005 (cachear DEPOIS de otimizar evita cachear resultados de código que vai mudar; ordem inversa funciona mas re-testa) | DONE |
| 004 | [compute-once-analytics](004-compute-once-analytics.md) | PERF-02 (HIGH) | — | DONE |
| 005 | [group-by-aggregations](005-group-by-aggregations.md) | PERF-03 (HIGH) | 002 (o rebuild de pares muda de lugar antes de otimizar getNumberFrequency) | DONE |

Ordem recomendada: **001 → 002 → 004 → 005 → 003**.

Executor: um único agente em sequência (os planos compartilham arquivos: `server.ts`, `lib/analytics/*`, `scripts/pull-draws.ts` — não paralelizar).

## Gates globais (após cada plano)

```
bun run lint && bun run typecheck && bun run test -- --run
```

Após o conjunto: `bun run build` e `bun run db:migrate` + verificações SQL de cada plano.

## Considerados e rejeitados / deferidos (não re-auditar)

- **SECURITY-02** (health expõe versão/último concurso): aceitável manter — dados públicos por design, deploy:verify depende disso.
- **DEBT-01** (classe base para engines), **DEBT-02** (server.ts monolítico), **DEBT-03** (duplicação de formatação), **DEBT-05** (InMemoryDatabase cresce por prefixo): custo/benefício ruim agora; re-avaliar após 003-005.
- **DEPS-02/03** (major bumps não críticos): sem vulnerabilidade; adiar.
- **TESTS-02/04** (coverage de app/ e charts): coberto por E2E por decisão documentada em vitest.config.ts.
- **TESTS-05/06/07** (quick-wins: isActivePath, asserts do DP, fake timers) e **DX-02** (hook pre-commit gitleaks versionado): executados por subagent separado nesta sessão (não são planos — mudanças pequenas e independentes de testes/tooling).
- **DIRECTION-01..04**: roadmap de produto, não defeitos — registrados no relatório da auditoria, decisão do mantenedor.
