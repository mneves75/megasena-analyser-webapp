# Mega-Sena CLI Functional Parity Plan (v2)

_Last update: 24 September 2025_

## Context & Success Criteria

- Deliver a deterministic CLI interface that mirrors every critical flow exposed by the Next.js UI (home dashboard, stats explorer, bet generation, bet history, operational sync, limits) to unlock headless automation and ops scripting.
- Reuse existing service-layer modules so the CLI becomes a thin orchestration layer: **0 duplicated business logic** and a single source of truth for pricing, strategy limits, and persistence.
- Provide dual-mode output (human friendly + machine-readable JSON) with reproducible formatting to support audits and CI integrations.
- Ensure commands respect the same validation rules, error semantics, and database safety guarantees enforced in the web app.
- Success is measured by: (1) feature parity checklist complete, (2) CLI commands pass smoke tests against seeded DB, (3) README/Docs updated with usage, (4) regression guardrails (lint, typecheck, tests) clean.

## Current Status Snapshot

- ✅ UI flows mapeados para serviços reutilizáveis.
- ✅ CLI com subcomandos `summary`, `stats`, `sync`, `bets generate/list` e `limits`, todos reutilizando serviços do app.
- ✅ Suite inicial de testes (Vitest) cobrindo parsers, geração/listagem de apostas e modo silencioso.
- 🔄 Próximo foco: smoke script/CI, cobertura avançada (`bets` com overrides complexos) e exportações adicionais (CSV).

## Feature Inventory & CLI Mapping

| Web Surface                       | Key Capabilities                                                                        | Primary Services                                                                                              | Planned CLI Command                       |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Home dashboard (`/`)              | Highlights (processed contests, last sync, pricing, average sum), hot numbers list      | `getFrequencies`, `getSums`, `getPricingMetadata`, `getPriceForK`, `getRecency`, `prisma.meta`, `prisma.draw` | `megasena summary`                        |
| Stats page (`/stats`)             | Windowed stats (frequencies, pairs, triplets, runs, sums, quadrants, recency)           | `src/services/stats` exports                                                                                  | `megasena stats <metric>`                 |
| Generator (`/generate`)           | Generate + persist batches, strategy selection, budget spread toggle, timeout, warnings | `generateBatch`, `persistBatch`, pricing helpers, strategy limits                                             | `megasena bets generate`                  |
| Bets history (`/bets`)            | Filterable list of persisted tickets w/ payload & metadata                              | `listBets`                                                                                                    | `megasena bets list`                      |
| Operational sync (`/api/sync`)    | Incremental/full backfill, limit, verbose progress                                      | `syncMegaSena`, `createSyncUI`, `SilentSyncUI`                                                                | `megasena sync`                           |
| Limits tooling (`npm run limits`) | Inspect/update/reset operational limits                                                 | `getBettingLimits`, `upsertBettingLimits`, `resetBettingLimits`                                               | `megasena limits` (wrapper or delegation) |

## Command Surface Specification

| Command                   | Description                                                                                       | Key Flags                                                                                             | Output Modes                                    | Exit Codes                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `megasena summary`        | Render the home dashboard summary                                                                 | `--window`, `--json`, `--pretty-json`, `--locale`                                                     | Table + highlight cards; JSON DTO               | `0` success, `65` validation, `1` unexpected                                          |
| `megasena stats <metric>` | Inspect stats metric (`frequencies`, `pairs`, `triplets`, `runs`, `sums`, `quadrants`, `recency`) | `--window`, `--limit`, `--json`, `--header`                                                           | Metric-specific tables/plots; JSON arrays       | same as above                                                                         |
| `megasena sync`           | Run incremental or full sync                                                                      | `--full`, `--limit`, `--verbose`, `--silent`, `--json`, `--pretty-json`                               | CLI progress bar (default) or silent summary    | `0` success, `2` auth failure, `1` unexpected                                         |
| `megasena bets generate`  | Generate (and optionally persist) a bet batch                                                     | `--budget`, `--strategy`, `--seed`, `--window`, `--spread-budget`, `--timeout`, `--persist`, `--json` | Summary cards + warnings; optional full payload | `0` success, `65` validation (`PricingError`, `BatchGenerationError`), `1` unexpected |
| `megasena bets list`      | List stored bets with filters                                                                     | `--strategy`, `--from`, `--to`, `--min-budget`, `--max-budget`, `--limit`, `--json`                   | Table format + pagination note; JSON array      | `0` success, `65` validation, `1` unexpected                                          |
| `megasena limits`         | Inspect / mutate betting limits                                                                   | `--show`, `--reset`, `--set=key=value`, `--history`, `--actor`, `--note`, `--json`                    | Delegates to limits service; prints audit trail | `0` success, `65` validation, `1` unexpected                                          |

### Shared Behaviours

- `--json` returns compact JSON; `--pretty-json` (alias) prettifies output for debugging.
- All commands accept `--log-level` (default `info`) to align with pino configuration.
- Command runner performs `DATABASE_URL` validation upfront; missing/invalid configuration stops execution before touching services.
- Prisma connections closed via finally hooks to prevent hanging handles; tests enforce this via `--detectOpenHandles`.

## Architecture Decisions

- **CLI Framework**: `commander` selected over `yargs` for typed nested commands and built-in help generation. Will augment with custom option parsers to enforce domain-specific validation.
- **Shared Modules**: Extract dashboard loaders into `src/services/dashboard/*.ts` (server-only) so both UI (Server Components) and CLI reuse identical logic. Provide `transformForCli` helper when CLI needs slight formatting differences (e.g., converting currency to locale strings).
- **Output Layer**: Centralize formatting in `src/cli/output.ts` with utilities for tables (`cli-table3` optional future) and emoji headings. For now rely on simple string formatting + chalk to keep dependency surface minimal.
- **Configuration**: Introduce `src/cli/options.ts` to parse/validate CLI flags, returning typed objects consumed by service calls. Ensures consistent validation across commands and simplifies testing.
- **Error Semantics**: Map domain errors to exit codes using discriminated union (`CliFailure`). Unexpected errors bubble with full stack trace when `LOG_LEVEL=debug`.

## Iteration Roadmap (v2)

1. **Iteration 0 – Foundations & Refactors**
   - Add dependencies: `commander`, optionally `cli-table3` (evaluate footprint), ensure types installed.
   - Define `npm run cli` script alias and update `README` “Scripts principais”.
   - Create `scripts/megasena-cli.ts` bootstrap: register server-only stub, set up commander program, version banner, global options, Prisma context helper, unified error handler.
   - Extract: `src/services/dashboard/home-summary.ts` and `src/services/dashboard/stats-summary.ts` (include TypeScript interfaces, cache usage parity). Update Server Components to import from new modules.
   - Introduce `src/cli/context.ts`, `src/cli/output.ts`, `src/cli/options.ts` scaffolding with TODO markers.

2. **Iteration 1 – Read-Only Insights**
   - Implement `summary` command using extracted home summary helper; support `--window`, `--json`, gracefully handle empty DB (no contests).
   - Implement individual `stats` subcommands; share option parsing; handle metric-specific column names; include sample row truncation when not using `--limit`.
   - Implement `sync` command reusing `syncMegaSena` and `createSyncUI`/`SilentSyncUI`; surface progress events; ensure `--json` returns summary payload identical to API response.
   - Add Vitest coverage for option parsing + summary loader to ensure deterministic DTOs.

3. **Iteration 2 – Bet Engine Operations**
   - Implement `bets generate` com fallback opcional de prompts (se necessário). Default deve ser _dry-run_; apenas gravar quando `--persist` for fornecido.
   - Mirror form validations: guard budget min/max, window > 0, seed length, strategy enumeration. Map `PricingError`/`BatchGenerationError` to exit 65, print actionable message + optional warnings.
   - Implement `bets list` with filter flags; paginate results when limit reached; highlight seeds, budgets, createdAt (ISO or localized). `--json` returns array of `StoredBet` DTOs.
   - Add tests covering `buildStrategies` parity and CLI transformation of stored bets.

4. **Iteration 3 – Limits & Polish**
   - Wrap `limits` script via commander subcommand or shell delegation; ensure help text mirrors existing script `--help` output. Support JSON printing of current limits + audit history.
   - Final doc updates: README, `docs/IMPLEMENTATION_PLAN.md`, new quickstart snippet in `docs/PHASE5_STAGE6_ROADMAP.md`.
   - Add type-level assertions ensuring CLI DTOs remain stable (snapshot or zod schema in tests).
   - End-to-end smoke script `npm run cli:smoke` (shell script) executing sample commands; integrate into CI (future backlog).

## Workstreams & Ownership Notes

- **CLI Scaffolding** – primary dev: current assignee; review by John Carmack (per repo policy).
- **Shared Loader Extraction** – ensure no client bundles import server-only modules; run `npm run lint` after refactor to catch App Router regressions.
- **Docs & Developer Enablement** – include transcript snippets, update `.vscode/launch.json` (if exists) with CLI task (optional backlog).

## Backlog Breakdown

### Completed recentemente

- [x] Adicionar `commander` e `npm run cli` alias.
- [x] Criar bootstrap `scripts/megasena-cli.ts` e utilitários (`context`, `output`, `options`).
- [x] Extrair loaders compartilhados para home/stats e reutilizar nos Server Components.
- [x] Implementar comandos `summary`, `stats` (frequencies/pairs/triplets/runs/sums/quadrants/recency) e `sync` com suporte a JSON/silent.
- [x] Implementar `megasena bets generate` com persistência opcional, warnings e JSON.
- [x] Implementar `megasena bets list` com filtros, limites e saída JSON.
- [x] Integrar `megasena limits` com overrides/auditoria reaproveitando `strategy-limits`.
- [x] Atualizar README/operations e adicionar cobertura Vitest para parsers/comandos.

### Now

- [x] Adicionar smoke script (`npm run cli:smoke`) validando fluxo completo (summary → sync → bets generate/list).
- [x] Documentar exemplos reais em `docs/CLI_TRANSCRIPTS.md` (copy/paste de execuções válidas).
- [x] Expandir testes para cenários de `spreadBudget`/`kOverride` via CLI (integração rápida com fixtures).

### Next

- [ ] Investigar exportação CSV (`--format=csv`) para integrações de marketing.
- [ ] Automatizar entrada de auditoria (registrar `actor`/`note` padrões) via env/config.
- [ ] Revisar ergonomia de múltiplas estratégias/pesos (permitir `--strategy balanced:2,uniform:1`).

### Later

- [ ] Adicionar job CI dedicado para rodar smoke script em PR (GitHub Actions).
- [ ] Avaliar prompts interativos (Inquirer) para workshops / onboarding.

## Validation & QA Strategy (Expanded)

- Run `npm run db:seed` before manual CLI testing; document dataset used and CLI commands executed in PR description.
- Automated tests: Vitest suites for loaders, option parsing, and error mapping; consider snapshot tests for JSON payloads.
- Linting/Typechecking: `npm run lint`, `npm run typecheck` mandatory prior to PR.
- Manual verification matrix:
  - `npm run cli summary --window 50`
  - `npm run cli stats frequencies --window 200 --limit 5`
  - `npm run cli sync --limit 10 --silent --json`
  - `npm run cli bets generate --budget 10000 --strategy balanced --seed e2e-seed`
  - `npm run cli bets list --strategy balanced --limit 5`
  - `npm run cli limits --show --history=3`
- Capture screenshots/log excerpts and add to `docs/CLI_TRANSCRIPTS.md` (new) for reproducibility.

## Observability & Telemetry

- Surface Pino logs to STDOUT when `LOG_LEVEL` >= `debug`; otherwise, rely on concise summaries.
- Consider optional `--metrics` flag to dump batch metrics (parity, quadrant coverage) to JSON for external dashboards.
- Ensure `SilentSyncUI` defaults for CI usage; document environment variable toggles in README.

## Risks & Mitigations (Updated)

- **Module Boundary Regression**: Extracted dashboard helpers might accidentally import client-only modules. Mitigation: add lint rule/test ensuring new modules remain `server-only`.
- **CLI UX Complexity**: Too many flags can overwhelm. Provide sensible defaults, align naming with UI labels, add `--help` examples, and optionally interactive prompts (backlog).
- **DB Lock Contention**: Long-running sync + bet generation concurrently could lock SQLite. Document in README; optionally add retry/backoff in future iteration.
- **Testing Gaps**: Without snapshots, formatting regressions could slip. Add targeted snapshot tests for CLI output (at least JSON mode) once commands are shipped.

## Decision Log

| Date       | Decision                                     | Rationale                                       | Status    |
| ---------- | -------------------------------------------- | ----------------------------------------------- | --------- |
| 2025-09-24 | Use `commander` for CLI scaffolding          | Nested subcommands, typed options, minimal deps | Accepted  |
| 2025-09-25 | CLI bets grava só com `--persist`            | Evita escrita acidental; dry-run vira padrão    | Completed |
| 2025-09-24 | Extract dashboard loaders to shared services | Prevent logic drift between UI & CLI            | Completed |

## Open Questions & Follow-Ups

- Should CLI offer CSV export (`--format=csv`) alongside JSON to mirror marketing workflows? _Owner: TBD, decide after Iteration 2._
- Do we need interactive prompts (`inquirer`) for workshop demos, or keep CLI strictly flag-driven? _Owner: product–gather feedback post Iteration 1._
- How do we integrate CLI smoke tests into CI without extending pipeline time excessively? _Owner: dev infra–evaluate during Iteration 3._
