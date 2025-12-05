# CAIXA API Alternative Data Source

## Problem

The official CAIXA Loterias API (`servicebus2.caixa.gov.br/portaldeloterias/api/megasena`) is blocked by Azion CDN. Requests from non-Brazilian IPs or without proper browser session receive HTTP 403 Forbidden.

**Error observed:**
```
Azion - Default error page (403 Forbidden)
```

## Solution

Use the Heroku-hosted mirror API that provides the same data without geo-restrictions.

## Alternative API

**Base URL:** `https://loteriascaixa-api.herokuapp.com/api/megasena`

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/megasena` | Latest draw |
| `/api/megasena/{contest}` | Specific contest number |

### Response Format

```json
{
  "loteria": "megasena",
  "concurso": 2947,
  "data": "04/12/2025",
  "local": "ESPACO DA SORTE em SAO PAULO, SP",
  "dezenasOrdemSorteio": ["44", "10", "39", "15", "04", "37"],
  "dezenas": ["04", "10", "15", "37", "39", "44"],
  "premiacoes": [
    {"descricao": "6 acertos", "faixa": 1, "ganhadores": 0, "valorPremio": 0.0},
    {"descricao": "5 acertos", "faixa": 2, "ganhadores": 86, "valorPremio": 14699.14},
    {"descricao": "4 acertos", "faixa": 3, "ganhadores": 2287, "valorPremio": 911.11}
  ],
  "acumulou": true,
  "proximoConcurso": 2948,
  "dataProximoConcurso": "06/12/2025",
  "valorArrecadado": 31722972,
  "valorAcumuladoProximoConcurso": 7210491.94,
  "valorEstimadoProximoConcurso": 12000000
}
```

### Field Mapping (API -> Database)

| API Field | DB Column | Notes |
|-----------|-----------|-------|
| `concurso` | `contest_number` | |
| `data` | `draw_date` | DD/MM/YYYY format |
| `dezenas` | `number_1..6` | Sorted ascending |
| `premiacoes[faixa=1].valorPremio` | `prize_sena` | |
| `premiacoes[faixa=1].ganhadores` | `winners_sena` | |
| `premiacoes[faixa=2].valorPremio` | `prize_quina` | |
| `premiacoes[faixa=2].ganhadores` | `winners_quina` | |
| `premiacoes[faixa=3].valorPremio` | `prize_quadra` | |
| `premiacoes[faixa=3].ganhadores` | `winners_quadra` | |
| `valorArrecadado` | `total_collection` | |
| `acumulou` | `accumulated` | 1 if true |
| `valorAcumuladoProximoConcurso` | `accumulated_value` | |
| `valorEstimadoProximoConcurso` | `next_estimated_prize` | |

## Usage Example

### Fetch Latest Draw

```bash
curl -s "https://loteriascaixa-api.herokuapp.com/api/megasena" | jq
```

### Fetch Specific Contest

```bash
curl -s "https://loteriascaixa-api.herokuapp.com/api/megasena/2947" | jq
```

### Bun Script (Inline)

```typescript
const API = 'https://loteriascaixa-api.herokuapp.com/api/megasena';

async function fetchDraw(contest?: number) {
  const url = contest ? `${API}/${contest}` : API;
  const response = await fetch(url);
  return response.json();
}

// Latest
const latest = await fetchDraw();
console.log(`Contest #${latest.concurso}: ${latest.dezenas.join('-')}`);

// Specific
const draw2940 = await fetchDraw(2940);
```

## Rate Limiting

- Add 300ms delay between requests to avoid overloading
- API is free tier Heroku, may have cold starts (~5s first request)

## Fallback Strategy

1. Try official CAIXA API first (may work from Brazilian IPs)
2. If 403/timeout, fallback to Heroku mirror
3. Cache results locally to minimize API calls

## Last Verified

- **Date:** 2025-12-05
- **Latest contest available:** #2947
- **Status:** Working
