# Cenários de Teste — Motor de Estratégias

## Baseline

- `seed=2025-09-23T00:00:00Z`, orçamento `R$ 60,00` (`6_000` cents), estratégia `uniform`, `tickets=10` — valida geração determinística sem colisões.
- `seed=ALPHA`, orçamento `R$ 120,00` (`12_000` cents), estratégias `[uniform, balanced]`, `tickets<=20` — compara metadados (quadrantes, soma) com snapshots aprovados.
  - Referência de heurística: `docs/strategies/balanced.md`.

## Extremos Controlados

- Orçamento máximo (`R$ 500,00`), `maxTickets=100`, seed `OMEGA` — garante corte por orçamento e limites de tickets.
- Orçamento `R$ 60,00`, estratégia `balanced`, dataset congelado de frequências de `2024-12-31` — confirma distribuição mínima de quadrantes/paridade.
  - Validar também média de frequência (`details.averageFrequency`) >= 0.
- Orçamento `R$ 12,00`, estratégia `uniform`, seed `0001`, requisição repetida — espera retorno idêntico (propriedade determinística).

## Entradas Inválidas

- Orçamento abaixo do mínimo (`R$ 3,00`), qualquer estratégia — deve lançar erro `BUDGET_BELOW_MIN`.
- `ticketsRequested=150` (> limite), orçamento `R$ 900,00` — deve truncar no limite com aviso `MAX_TICKETS_ENFORCED`.
- `k=5` (abaixo do mínimo permitido) ou `k=16` (acima do MVP) — deve retornar erro `K_OUT_OF_RANGE`.
- Seed vazio ou não string — deve normalizar para seed default e registrar warning.

## Smoke Manual

- `npm run dev` + `POST /api/bets/generate` com payload baseline (seed `FIXTURE-SEED`, orçamento `R$30,00`) — comparar tickets com fixture em `docs/fixtures/sample-bets.json`.
- Rodar ação de servidor via script CLI e verificar persistência no SQLite efêmero (`bets`, `bet_dezenas`).
- Após implementação do Stage 3, validar também:
  - `generateBatch` com múltiplas estratégias retorna tickets únicos e métricas agregadas (`totalTickets`, `averageFrequency`).
  - Timeout configurável (ex.: `timeoutMs=10`) retorna erro `GENERATION_TIMEOUT` sem travar o processo.
- Stage 4:
  - `POST /api/bets/generate` autenticado (Bearer `SYNC_TOKEN`) persiste registros consultáveis via `GET /api/bets`.
  - Consultar `/api/bets?strategy=balanced&limit=5` e conferir retorno ordenado, incluindo payload `ticket` com metadados e dezenas ordenadas.
