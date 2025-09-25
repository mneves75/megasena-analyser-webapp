# Guia Operacional – Mega-Sena Analyzer

> Documento vivo para garantir observabilidade, confiabilidade e resposta a incidentes. Atualize a cada alteração estrutural no pipeline.

## Visão Geral

- **Stack de logs**: `pino` com transporte pretty opcional em desenvolvimento (`LOG_PRETTY=1`).
- **Formato padrão**: JSON por linha, codificação UTF-8.
- **Retenção recomendada**: 30 dias em produção, 7 dias em ambientes de preview.
- **Horário de referência**: UTC para timestamps; apresente TZ local apenas no console/UI.

## Níveis de Log e Uso Obrigatório

| Nível   | Quando usar                                                             | Campos mín. obrigatórios                                                  |
| ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `fatal` | Falha irrecuperável que exige intervenção manual imediata.              | `requestId`, `spanId`, `error.stack`, `service`, `stage`.                 |
| `error` | Exceções controladas ou operações abortadas.                            | `requestId`, `spanId`, `error.name`, `error.message`, `service`, `stage`. |
| `warn`  | Comportamentos inesperados com fallback aplicado.                       | `requestId`, `spanId`, `service`, `context`.                              |
| `info`  | Eventos de negócio principais (início/fim de sync, geração de apostas). | `requestId`, `spanId`, `service`, `durationMs?`, `payload.hash?`.         |
| `debug` | Diagnóstico detalhado para desenvolvimento ou investigação.             | `requestId`, `spanId`, `service`, `context`.                              |
| `trace` | Rastreamento fino (loops internos, heurísticas). Usar com parcimônia.   | `requestId`, `spanId`, `service`, `context`.                              |

> **Nota**: o nível padrão (`LOG_LEVEL`) permanece `info`. Em produção, elevar para `warn` só com aprovação de engenharia + produto.

## Correlação (`requestId` e `spanId`)

- **Gerador padrão**: `crypto.randomUUID()` para `requestId` de borda (APIs, ações). `spanId` deriva de `randomUUID().slice(0, 12)` em cada etapa interna.
- **Propagação**:
  1. API Routes: criar middleware para atribuir `requestId` se ausente no header `x-request-id`; devolver header na resposta.
  2. Server Actions: gerar `requestId` no início e anexar em contexto via `AsyncLocalStorage`.
  3. Serviços internos: usar `childLogger` passando `{ requestId, spanId, service }`.
- **Boas práticas**:
  - Sempre logar `requestId` na primeira e na última mensagem do fluxo.
  - Encadear `spanId` para etapas (ex.: `sync.fetch`, `sync.persist`).
  - Incluir `parentSpanId` quando uma operação dispara subtarefas, permitindo reconstrução.

## SLAs e Indicadores

| Serviço         | SLA alvo                              | Indicadores chave                          | Fonte                                 |
| --------------- | ------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `/api/sync`     | 99% sucesso por semana                | `successRate`, `durationP95`, `retryCount` | Logs estruturados + futuro dashboard. |
| `/api/stats/*`  | 99% disponibilidade horário comercial | `latencyP95`, `cacheHitRate`               | Logs + métricas cache.                |
| `generateBatch` | ≤ 3s para orçamento padrão (≤ R$ 500) | `durationMs`, `ticketsCount`, `dedupeHits` | Logs do serviço de apostas.           |
| Cron `sync`     | Concluir em ≤ 10 minutos              | `durationMs`, `processed`, `failures`      | Logs + `meta.last_sync`.              |

Registrar incidentes em `docs/operations/runbook-logs.md` (criar se não existir) com: data/hora, impacto, causa raiz, ação corretiva.

## Runbook de Logs

1. **Identificar**: filtrar por `requestId` no provedor de logs ou via `npm run sync -- --request-id=<id>` para reprocesso controlado.
2. **Extrair contexto**: verificar `spanId` relacionados e eventos `error`/`warn` próximos.
3. **Ação imediata**: se `fatal`/`error` recorrentes, acionar responsável via canal #mega-ops.
4. **Documentar**: atualizar runbook e, se necessário, abrir issue com checklist de mitigação.

## Retenção e Armazenamento

- **Desenvolvimento**: logs apenas locais; rotacionar semanalmente (limpar `logs/*.log`).
- **Preview**: enviar para stack compartilhada (BetterStack/Logtail) com retenção 7 dias; redigir alerta se atingir 80% da cota.
- **Produção**: 30 dias obrigatório + export mensal para cold storage (S3 ou alternativa) por 1 ano.

## CLI Operacional (`npm run cli`)

> Transcrições completas: `docs/CLI_TRANSCRIPTS.md` (requer banco seedado/sincronizado).

- **Pré-requisitos**: `DATABASE_URL` apontando para o banco desejado e, em pipelines, `--silent` ou `--json` para evitar barra de progresso (a CLI já força modo silencioso quando `--json` está ativo ou `CI=1`).
- **Comandos principais**:
  - `npm run cli -- summary --json` – snapshot para monitoração rápida (ingestível via `jq`).
  - `npm run cli -- stats frequencies --window 200 --limit 20` – equivalente ao painel de estatísticas.
  - `npm run cli -- sync --full --limit 100 --silent` – recomendado em cron jobs/backfills; produz output enxuto.
  - `npm run cli -- bets generate --budget 150 --strategy balanced` – dry-run por padrão; adicione `--persist` para gravar o lote.
  - `npm run cli -- bets list --strategy hot-streak --json` – exporta histórico em JSON para auditoria.
- **Log level**: herda `LOG_LEVEL`; para diagnósticos amplos use `--log-level=debug` via variável de ambiente antes do comando.
- **Falhas comuns**:
  - `DATABASE_URL` ausente/sem protocolo `file:` → CLI aborta antes de abrir conexões (veja `src/cli/context.ts`).
  - Saída com caracteres de controle em CI → habilite `--silent` (ou exporte `CI=1`) para obrigar o `SilentSyncUI`.
- **Auditoria**: sempre redirecionar `--json` para arquivo quando o resultado alimentar pipelines (ex.: `npm run cli -- sync --json > logs/sync-$(date +%F).json`).

## Métricas Futuras (roadmap)

- Integrar OpenTelemetry para spans distribuídos (HTTP + Prisma).
- Expor contador Prometheus (via `metrics.ts`) para `sync_processed_total`, `bets_generated_total`.
- Avaliar exporter para DataDog caso orçamento aprove.

## Anexos

- Variáveis relevantes: `LOG_LEVEL`, `LOG_PRETTY`, `REQUEST_ID_HEADER` (a definir), `LOG_RETENTION_DAYS` (infra).
- CLI útil:
  - `npm run cli summary -- --window 200 --json` &rarr; gera snapshot consumível por scripts externos.
  - `npm run cli stats frequencies -- --window 50 --limit 10` &rarr; monitora tendências recorrentes.
  - `npm run cli sync -- --limit 30 --silent` &rarr; sincronização headless (o modo silencioso é ativado automaticamente quando `CI` está definido).
  - `npm run cli bets generate -- --budget 120 --seed auditoria` &rarr; pré-visualiza lotes sem persistir (adicione `--persist` para gravar).
  - `npm run cli bets list -- --limit 5 --json` &rarr; exporta histórico para pipelines de auditoria.
  - `npm run cli limits -- --set maxTicketsPerBatch=140 --json` &rarr; aplica override documentado e recupera histórico recente.
- Scripts úteis: `npm run sync -- --log-level=debug`, `npm run dev -- --turbo-log`, `npm run db:fix-bet-totals`, `npm run cli:smoke [--prepare]` (executa fluxo end-to-end do CLI; `--prepare` aplica migrations/seed automaticamente). Atualizar este guia se scripts mudarem.
