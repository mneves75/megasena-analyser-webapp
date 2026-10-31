# Tarefas

Estados: pending · in_progress · done · blocked · rejected.

| ID | Tarefa | Estado | Evidência |
|---|---|---|---|
| P0 | Preflight: Git, deploy paths, inventário | done | `PLAN.md` §0, `BASELINE.md` §1 |
| P1 | Harness L2 (`scripts/perf/l2-ttfb.ts`) | done | `tests/scripts/perf-harness.test.ts` |
| P2 | Harness de bytes (`scripts/perf/page-bytes.ts`) | done | idem |
| P3 | Harness L3 (`scripts/perf/l3-lab.ts`) | in_progress | `raw/baseline-2026-10-31/l3.json` |
| P4 | Relatório de fontes (`scripts/fonts/report.py`) | done | `BASELINE.md` §5 |
| P5 | Auditoria de consultas (`scripts/perf/query-audit.ts`) | done | `raw/baseline-2026-10-31/query-audit.json` |
| B1 | Baseline L2 + A/A | in_progress | `raw/baseline-2026-10-31/l2.json`, `raw/aa-2026-10-31/l2.json` |
| B2 | Baseline de bytes | pending | `raw/baseline-2026-10-31/page-bytes.json` |
| B3 | Baseline L3 + A/A | pending | `raw/baseline-2026-10-31/l3.json` |
| B4 | Snapshot de campo (RUM 28 d) | done | `BASELINE.md` §6 |
| B5 | Custo: Billable Usage | blocked | `cf billing` → 403; o dono roda as consultas de `BASELINE.md` §7 |
| B6 | Pixel diff com piso de ruído | pending | só é necessário antes de W1/W9 |
| R1 | Revisão cruzada do PLAN (Sol) | pending | `REVIEW.md` |
| A1 | Aprovação: montagem A/B (versão 0% em produção) | blocked | decisão do dono |
| W1 | Preload só do subset latin | pending | — |
| W2 | Revisão de draws na Cache API do colo (TTL 60 s) | blocked | aprovação de contrato de frescor |
| W3 | Cache de HTML para páginas puras do build | blocked | aprovação por rota |
| W4 | `limits.cpu_ms = 10000` | blocked | aprovação de guardrail |
| W5 | 404 barato para caminhos sem rota | blocked | aprovação de mudança de comportamento |
| W6 | Perfil de CPU de `/` e `/dashboard/statistics` | pending | — |
| W7 | Linhas escritas por requisição no DO | pending | — |
| W8 | CLS de desktop | pending | — |
| W9 | Subset/eixos de fonte (fase 2) | blocked | decisão de base (PLAN §5) |
