# 05 - Subsistemas Centrais

## O que este capítulo ensina

Cada subsistema do projeto: propósito, responsabilidades, entradas/saídas,
dependências, abstrações-chave e tradeoffs — com referências de código.

## Por que isso importa

Mudanças seguras exigem saber "de quem é essa responsabilidade". Este capítulo é o seu
índice de donos.

## Modelo mental

Sete caixas, cada uma com uma única missão: baixar, guardar, medir, gerar, proteger,
registrar e apresentar. Cada caixa fala com as vizinhas por contratos pequenos.

---

## Explicação detalhada

### 1. Cliente CAIXA — `lib/api/caixa-client.ts`

- **Propósito:** trazer sorteios oficiais com robustez de rede.
- **Entradas/Saídas:** `fetchDraw(contestNumber?)` → `MegaSenaDrawData`;
  `fetchAllDraws(start, end?, {allowPartial})` → `MegaSenaDrawData[]`.
- **Abstrações:** `fetchWithRetry` (backoff exponencial 2^n + jitter, respeita
  `Retry-After`), cache por ETag + tratamento de `304`, `CaixaAPIError` com flag
  `retryable`. Normalização em `normalizeMegaSenaDrawData`.
- **Tradeoffs:** simula headers de navegador (User-Agent/Referer) para a API pública;
  rate limiting progressivo deixa a importação lenta de propósito para não ser
  bloqueado. Status retentáveis: 429/500/502/503/504.

### 2. Camada de banco — `lib/db.ts`

- **Propósito:** abrir o SQLite, aplicar migrações e oferecer um substituto em memória
  para testes.
- **I/O:** `getDatabase()`/`getDatabaseAsync()`, `runMigrations()`, `closeDatabase()`.
- **Abstrações:** PRAGMAs de performance/segurança (WAL, `foreign_keys=ON`,
  `trusted_schema=OFF`, etc.); `InMemoryDatabase` que **normaliza SQL** e responde a um
  conjunto fixo de queries (ativada quando `process.env.VITEST` está setado).
- **Tradeoffs:** o banco em memória acelera testes, mas só conhece os SQLs que o app
  usa — SQL novo pode não ser interpretado (ver `09-open-questions-and-risks.md`).
  Migração tolerante a legado (adiciona colunas `status`/`error_message` via `ALTER`).

### 3. Motor estatístico — `lib/analytics/statistics.ts`

- **Propósito:** resumo do dashboard e detecção de padrões simples.
- **I/O:** `getDrawStatistics()` (`DrawStatistics`), `getNumberFrequencies()`,
  `detectPatterns()`, `getDrawHistory(limit)`, `updateNumberFrequencies()`.
- **Abstrações:** queries pré-geradas e seguras por coluna
  (`NUMBER_COLUMN_COUNT_QUERIES`) — evita interpolação de string em SQL. O recálculo de
  frequências roda em transação `BEGIN IMMEDIATE` com rollback em erro.
- **Tradeoffs:** `number_frequency` é cache; precisa ser recalculado após ingestão.

### 4. Engines de análise avançada — `lib/analytics/*`

Todos recebem o banco no construtor e leem `draws`. Wiring em `/api/statistics` por
flags de query (`server.ts`). Resumo:

| Engine | Flag | Conceito | Observação de custo |
| --- | --- | --- | --- |
| `DelayAnalysisEngine` | `delays` | atraso desde a última saída (categorias) | 1 CTE com `ROW_NUMBER` |
| `DecadeAnalysisEngine` | `decades` | distribuição por décadas 1–10..51–60 | muitas queries pequenas |
| `PairAnalysisEngine` | `pairs` | co-ocorrência e correlação de pares (cache) | escreve `number_pair_frequency` |
| `ParityAnalysisEngine` | `parity` | distribuição par/ímpar | full scan + JS |
| `PrimeAnalysisEngine` | `primes` | primos por sorteio | full scan + por-primo |
| `SumAnalysisEngine` | `sum` | soma das 6 dezenas (média, mediana, percentis) | full scan + JS |
| `StreakAnalysisEngine` | `streaks` | quentes/frios via janela recente vs total | janela + CTE |
| `PrizeCorrelationEngine` | `prize` | prêmio médio quando o número está presente | 1 CTE UNION ALL |
| `TimeSeriesEngine` | (via `/api/trends`) | frequência ao longo de períodos | muito "chatty" |
| `ComplexityScoreEngine` | (não usada) | pontua "complexidade" de uma aposta | em memória, sem SQL; definida mas sem chamador |

- **Tradeoffs:** vários engines fazem N consultas pequenas (decade, prime, time-series).
  Para o volume atual de sorteios funciona, mas é a primeira coisa a otimizar se a base
  crescer muito (ver riscos).

### 5. Gerador de apostas — `lib/analytics/bet-generator.ts`

- **Propósito:** maximizar cobertura de números dentro de um orçamento.
- **I/O:** `generateOptimizedBets(budget, mode, strategy)` → `BetGenerationResult`.
- **Abstrações-chave:**
  - **Programação dinâmica** em `buildOptimizedBetSizes(budget)`: discretiza o
    orçamento em "unidades" (GCD dos preços em centavos = R$ 6,00) e escolhe tamanhos
    de aposta (6–20) priorizando, nesta ordem: **gastar o máximo do orçamento** (o laço
    final prefere o maior número de unidades gastas), depois maximizar a cobertura,
    depois usar menos apostas e, por fim, cobrir mais números (`isBetterPlan` desempata
    dentro do mesmo gasto).
  - **Deduplicação** por assinatura ordenada (`getBetSignature`), com fallback para
    aleatório após `FALLBACK_THRESHOLD` tentativas.
  - **Estratégias:** `hot_numbers`, `cold_numbers`, `balanced` (50/50), `fibonacci`,
    `random` — operando sobre pools pré-buscados uma vez por geração (`fetchCandidatePools`).
- **Tradeoffs:** preços (`BET_PRICES`) são constantes de julho/2025; se a CAIXA
  reajustar, a otimização fica incorreta. `MAX_BETS_PER_GENERATION = 200` limita
  explosão.

### 6. Segurança — `lib/security/*` + `proxy.ts`

- **CSP:** `csp.ts` (`buildCsp` com nonce por requisição, `strict-dynamic`, sem
  `unsafe-inline` em produção; `buildApiSecurityHeaders` separa a API). `proxy.ts`
  injeta nonce e headers em cada página.
- **Pseudonimização:** `pseudonymize.ts` (HMAC-SHA256, salt de 30 dias, fail-closed em
  produção). Detalhes e LGPD em `10-lgpd-compliance-plan.md`.
- **HTTP:** `http.ts` (`resolveClientIp` com confiança de proxy explícita,
  `readJsonBodyWithLimit`, `isJsonContentType`, `isSecureRequest`).
- **API interna:** `internal-api.ts` (loopback + segredo `timingSafeEqual`).
- **Entrada de tendências:** `trends-input.ts` (`parseTrendNumbers`, limites).
- **Sanitização de metadados:** `sanitize-metadata.ts` (redige `authorization|token|
  secret|password|cookie`, limita profundidade/array/string, detecta ciclos).

### 7. Observabilidade — `lib/logger.ts`, `log-store.ts`, `audit.ts`, retenção

- **Logger:** console + sinks; níveis `debug|info|warn|error`; `debug` só com
  `DEBUG=true`; metadata sanitizada; stack só fora de produção.
- **Filas assíncronas:** `log-store.ts` (→ `log_events`) e `audit.ts` (→ `audit_logs`)
  com flush por intervalo (2s) e por limiar, transação em lote e re-enfileiramento em
  erro de DB.
- **Retenção:** `audit-retention.ts` (default 365 no código; 400 via env) e
  `log-retention.ts` (30 dias); schedulers de 24h iniciados no boot.
- **Tradeoff:** `log-store` chama `.unref()` no timer; `audit.ts` não — pequena
  assimetria (ver riscos).

### 8. Apresentação — `app/*` + `components/*`

- **Server Components** por padrão; `'use client'` só onde há interatividade
  (formulário do gerador, gráficos, tema, banner de privacidade).
- **SEO/JSON-LD:** `lib/seo/schemas.ts` gera schemas (`WebSite`, `Organization`,
  `WebApplication`, `BreadcrumbList`, `FAQPage`); o componente `MultiJsonLd`
  (`components/seo/json-ld.tsx`) serializa com nonce e escapa `<`.
- **Requisito de produto atendido:** a página de estatísticas mostra o concurso e a
  data-base da análise num card próprio (`app/dashboard/statistics/page.tsx`, labels
  `pt.statistics.freshness.*`).

## Como verificar isso no código

```bash
grep -n "buildOptimizedBetSizes\|getBetSignature\|FALLBACK_THRESHOLD" lib/analytics/bet-generator.ts
grep -n "includeDelays\|includeDecades\|includePairs" server.ts
grep -n "InMemoryDatabase\|VITEST" lib/db.ts
grep -n "generateWebApplicationSchema\|generateFAQSchema" lib/seo/schemas.ts
```

## Mal-entendidos comuns

- **"O gerador escolhe os melhores números."** Ele escolhe **tamanhos** de aposta por
  DP e preenche por estratégia; não há vantagem preditiva.
- **"Todo engine usa `number_frequency`."** Só `StatisticsEngine`/`BetGenerator`; os
  demais leem `draws` (e `PairAnalysisEngine` usa seu próprio cache).
- **"CSP e headers são iguais para página e API."** São contratos diferentes
  (`buildSecurityHeaders` vs `buildApiSecurityHeaders`).

## Exercícios

1. **(Fácil)** Liste as 5 estratégias aceitas pelo gerador. **Gabarito:** `random`,
   `hot_numbers`, `cold_numbers`, `balanced`, `fibonacci`.
2. **(Médio)** Em `buildOptimizedBetSizes`, explique o papel de `resolveCostUnitCents`.
   **Gabarito:** acha o GCD dos preços em centavos para discretizar o orçamento e
   tornar a DP exata sem ponto flutuante.
3. **(Médio)** Aponte um engine que escreve no banco e um que não toca o banco.
   **Gabarito:** escreve: `PairAnalysisEngine`; não toca: `ComplexityScoreEngine`.
4. **(Difícil / mudança)** Adicione uma flag `?complexity=true` em `/api/statistics`
   que retorne o score de um array fixo. Quais arquivos mudam? **Gabarito:** `server.ts`
   (handler), `ComplexityScoreEngine` (a classe já existe mas hoje **não tem chamador** —
   bom candidato a finalmente aproveitar), e o tipo de resposta consumido pela página.

---

### Procedência das afirmações

- **Verificado no código:** assinaturas e abstrações de cada subsistema nos arquivos
  citados; wiring de flags em `server.ts`; uso de cache de pares; PRAGMAs em `db.ts`.
- **Inferido do código:** a classificação de custo "chatty" dos engines (deduzida do
  número de queries por chamada).
- **Conhecimento externo:** conceitos gerais de programação dinâmica, CSP e schema.org.
