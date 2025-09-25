# CLI Transcripts – Mega-Sena Analyzer

> Exemplos registrados em 24 de setembro de 2025 (macOS, Node 20.17). Banco local preenchido com `npm run db:migrate` + `npm run db:seed` e sincronização incremental (`npm run sync -- --limit=50`). Os valores podem variar conforme os concursos armazenados.

## Ambiente

```bash
export DATABASE_URL="file:./dev.db"
```

## 1. Resumo (Home)

```bash
$ npm run cli -- summary --json
{
  "highlights": [
    { "label": "Concursos processados", "value": "2.780", "description": "Cobertura a partir do concurso 2.731" },
    { "label": "Última sincronização", "value": "24 de setembro de 2025", "description": "Concurso 2878 em 24 de setembro de 2025" },
    { "label": "Preço base oficial", "value": "R$ 6,00", "description": "Atualizado em 12/07/2025 · Fonte: Loterias CAIXA" },
    { "label": "Soma média (janela 200)", "value": "141", "description": "49% pares · 51% ímpares" }
  ],
  "topNumbers": [
    { "dezena": 10, "hits": 48, "percentage": 0.24, "contestsSinceLast": 8 },
    { "dezena": 53, "hits": 47, "percentage": 0.235, "contestsSinceLast": 5 },
    { "dezena": 42, "hits": 45, "percentage": 0.225, "contestsSinceLast": 2 }
  ],
  "totalDraws": 2780,
  "averageSum": 141,
  "lastSyncDate": "2025-09-24T14:03:18.000Z",
  "paritySummary": "49% pares · 51% ímpares",
  "windowSize": 200
}
```

## 2. Estatísticas (Frequências)

```bash
$ npm run cli -- stats frequencies --window 200 --limit 5

Frequência de dezenas
Concursos total : 200
Janela inicial   : 2679

01. 10 – 048 hits (24.0%)
02. 53 – 047 hits (23.5%)
03. 42 – 045 hits (22.5%)
04. 05 – 044 hits (22.0%)
05. 32 – 044 hits (22.0%)
```

## 3. Geração de apostas (dry-run)

```bash
$ npm run cli -- bets generate --budget 150 --strategy hot-streak --seed CLI-DEMO --spread-budget --dry-run --json
{
  "tickets": [
    {
      "strategy": "hot-streak",
      "dezenas": [3, 10, 14, 27, 34, 53],
      "metadata": { "score": 612, "window": 50 },
      "costCents": 600,
      "seed": "CLI-DEMO"
    },
    {
      "strategy": "uniform",
      "dezenas": [7, 12, 25, 31, 42, 58],
      "metadata": { "score": 505 },
      "costCents": 600,
      "seed": "CLI-DEMO"
    }
  ],
  "payload": {
    "requestedBudgetCents": 15000,
    "totalCostCents": 1200,
    "leftoverCents": 13800,
    "ticketsGenerated": 2,
    "averageTicketCostCents": 600,
    "ticketCostBreakdown": [
      { "k": 6, "costCents": 600, "planned": 2 }
    ],
    "config": { "strategies": [{ "name": "hot-streak", "weight": 1 }, { "name": "uniform", "weight": 1 }], "spreadBudget": true }
  },
  "warnings": [],
  "persisted": false
}
```

## 4. Auditoria de lotes

```bash
$ npm run cli -- bets list --strategy balanced --limit 3

Últimos 1 lotes
1. balanced · R$ 96,00 · seed CLI-DEMO
   criado em 2025-09-24T14:07:55.000Z | 03, 10, 14, 27, 34, 53
```

## 5. Sincronização silenciosa

```bash
$ npm run cli -- sync --limit 5 --silent

Resumo da sincronização
Processados      : 5
Inseridos        : 0
Atualizados      : 1
Último concurso  : 2878
Início           : 2025-09-24T14:08:12.512Z
Fim              : 2025-09-24T14:08:14.106Z
Duração (s)      : 2
```

> Em CI (variável `CI=1`), o comando já força o modo silencioso; use `--json` para integrar com pipelines.
