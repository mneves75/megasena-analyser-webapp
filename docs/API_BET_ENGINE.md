# API do Motor de Apostas

> Atualizado em 23/09/2025 – reflete o MVP entregue nas fases 3/4 do motor.

## Autenticação

- Endpoints mutadores (`POST /api/bets/generate`) exigem header `Authorization: Bearer <SYNC_TOKEN>`.
- GET `/api/bets` é aberto, mas recomenda-se proteger via middleware quando exposto externamente.

## Geração de apostas

### `POST /api/bets/generate`

Gera apostas utilizando o motor no servidor, persiste registros em `bets`/`bet_dezenas` e retorna tickets + payload serializado.

#### Request

```
POST /api/bets/generate
Authorization: Bearer <SYNC_TOKEN>
Content-Type: application/json

{
  "budgetCents": 3000,
  "seed": "FIXTURE-SEED",
  "strategies": [
    { "name": "balanced", "weight": 2, "window": 50 },
    { "name": "uniform", "weight": 1 }
  ],
  "k": 6,
  "window": 50,
  "timeoutMs": 3000
}
```

#### Response (`200 OK`)

```
{
  "tickets": [
    {
      "strategy": "balanced",
      "dezenas": [6, 17, 21, 36, 44, 55],
      "metadata": { ... },
      "costCents": 600,
      "seed": "FIXTURE-SEED:0:balanced:0"
    },
    ...
  ],
  "payload": {
    "version": "1.0",
    "seed": "FIXTURE-SEED",
    "requestedBudgetCents": 3000,
    "ticketCostCents": 600,
    "totalCostCents": 3000,
    "leftoverCents": 0,
    "ticketsGenerated": 5,
    "strategies": [
      { "name": "balanced", "weight": 2, "generated": 5, "attempts": 5, "failures": 0 },
      { "name": "uniform", "weight": 1, "generated": 0, "attempts": 0, "failures": 0 }
    ],
    "metrics": {
      "averageSum": 180,
      "averageScore": 0.25,
      "paritySpread": 0,
      "quadrantCoverage": { "min": 6, "max": 6, "average": 6 }
    },
    "config": {
      "strategies": [...],
      "k": 6,
      "window": 50,
      "timeoutMs": 3000
    },
    "warnings": [],
    "ticket": {
      "strategy": "balanced",
      "metadata": { ... },
      "seed": "FIXTURE-SEED:0:balanced:0",
      "costCents": 600
    }
  },
  "warnings": []
}
```

#### Erros comuns

| Status | Motivo                                       | Observações                                                                            |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| 400    | Payload inválido                             | Falha nas validações Zod (`budgetCents` ≤ 0, seed vazia, etc.).                        |
| 401    | Token ausente/errado                         | Verifique `SYNC_TOKEN`.                                                                |
| 408    | Tempo limite atingido (`GENERATION_TIMEOUT`) | Motor retorna parcial (tickets gerados até o momento) e registra log com `durationMs`. |
| 422    | `BUDGET_BELOW_MIN`                           | Orçamento não cobre uma aposta de `k` dezenas.                                         |

## Consulta de apostas

### `GET /api/bets`

Retorna apostas mais recentes, ordenadas por `created_at` desc.

#### Parâmetros de query

| Parâmetro                 | Tipo       | Descrição                                        |
| ------------------------- | ---------- | ------------------------------------------------ |
| `strategy`                | `string`   | Filtra por nome da estratégia (ex.: `balanced`). |
| `budgetMin` / `budgetMax` | `number`   | Faixa de orçamento original em centavos.         |
| `from` / `to`             | `ISO date` | Intervalo de criação (UTC).                      |
| `limit`                   | `number`   | Máximo de registros (1..200, default 50).        |

#### Exemplo

```
GET /api/bets?strategy=balanced&limit=5
```

Resposta reduzida:

```
{
  "bets": [
    {
      "id": "clxabc...",
      "createdAt": "2025-09-23T20:10:00.000Z",
      "strategyName": "balanced",
      "budgetCents": 3000,
      "totalCostCents": 600,
      "dezenas": [6, 17, 21, 36, 44, 55],
      "payload": { ... }
    },
    ...
  ]
}
```

## Integração com Server Actions

- `src/app/generate/actions.ts` disponibiliza `generateBetsAction`, usada em formulários do App Router.
- Após persistir, a ação chama `revalidatePath("/bets")` para atualizar o dashboard histórico.

## Scripts auxiliares

- `NODE_OPTIONS="-r ./scripts/dev/register-server-only-stub.js" npx tsx scripts/dev/generate-batch.ts` – gera amostras determinísticas sem dependência do bundler RSC.

## Testes automatizados

| Arquivo                                    | Cobertura                                 |
| ------------------------------------------ | ----------------------------------------- |
| `src/services/__tests__/bets.test.ts`      | Geração, estratégias, limites e timeout   |
| `src/services/__tests__/bet-store.test.ts` | Persistência + consulta em SQLite efêmero |

## Próximos passos

- Expansão de filtros (`config.strategies`, `warnings`) e paginação.
- Exposição de metadados agregados (soma média, score mínimo/máximo) direto na API.
- Adição de testes E2E (Playwright) para fluxo completo `/generate` → `/bets`.
