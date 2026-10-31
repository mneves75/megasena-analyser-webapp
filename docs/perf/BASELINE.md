# Baseline — 2026-10-31

Produção `https://megasena-analyzer.com.br`, versão pública 1.19.2 (`/api/health`),
3.079 concursos. Medido a partir da branch `perf/cost-load-pass`; o harness é o de
`scripts/perf/` (ver "Como repetir"). Dados brutos sanitizados em `raw/`.

## 1. Condições

| Item | Valor |
|---|---|
| Ponto de medição | Mac (darwin arm64) no Brasil; `cdn-cgi/trace` → `loc=BR`, colos GIG e BEL |
| Rede | Conexão residencial do operador, sem throttling no L2 |
| Ferramentas | curl 8.7.1 (SecureTransport, nghttp2 1.69), Bun 1.4.4, Lighthouse 13.5.0 + Google Chrome (versão no `l3.json`), fontTools 4.68.0, brotli 1.2.1 |
| Tráfego do harness | UA `megasena-perf-harness/1`, ≤ 3.000 req/execução, 40 req/min; sem `/api/*`; beacon RUM bloqueado no lab |
| Execução inválida descartada | A primeira execução L2, a 80 req/min, recebeu 429 da regra de rate limit da zona após 366 requisições e foi descartada inteira. Nenhum número dela aparece aqui. |

Caminhos de deploy (preflight): nenhum workflow do GitHub faz deploy de Worker; o
`cloudflare.yml` só compila sem credenciais, e o `ci-cd.yml` (Docker legado) é manual.
Deploys de produção são manuais via `cf`. Workers Builds no painel: não verificável com
o token delegado; perguntar ao dono.

<!-- L2-L3-BYTES -->

## 5. Fontes

Família única Archivo 2.001 (OFL 1.1, **sem Reserved Font Name**; cabeçalho do
`OFL.txt` em `google/fonts/ofl/archivo`). `next/font/google` via vinext 1.3.0, que
baixa no build os arquivos do Google Fonts e os serve como assets imutáveis
(`Cache-Control: public, max-age=31536000, immutable`).

| Arquivo servido | Subset | Bytes | Glifos | Code points | Eixos | GSUB | Hinting | Preload |
|---|---|---:|---:|---:|---|---|---|---|
| `archivo-b42cd543.woff2` | latin | 90.096 | 302 | 230 | wght 100–900, wdth 62–125 | ccmp dnom frac liga locl numr pnum rvrn tnum | só `gasp` | sim |
| `archivo-8312402b.woff2` | latin-ext | 85.856 | 305 | 262 | idem | ccmp locl rvrn | só `gasp` | **sim** |
| `archivo-880aee5b.woff2` | vietnamese | 34.364 | 136 | 115 | idem | ccmp locl | só `gasp` | não |
| `Archivo[wdth,wght].ttf` (original, não servido) | — | 658.596 | 834 | 653 | idem | + aalt case lnum onum ordn sinf subs sups zero | `prep`, `gasp` | — |

GPOS em todos: `kern mark mkmk`. O arquivo latin cobre as marcas combinantes
U+0300–0301, U+0303–0304 e U+0308, então sequências NFD de português renderizam na
mesma face.

**Uso medido no CSS de produção** (`/_next/static/css/BSieqmPt.css`): pesos
400/500/600/700 e `bolder` (o UA o aplica a `<b>`/`<strong>`; dentro de 600 resolve
para 900); `font-stretch` 100% (padrão), 88% e 75% (`.font-condensed`);
`font-variant-numeric: tabular-nums` (`tnum`); nenhum `font-style: italic` com face
própria (itálico seria sintetizado); nenhum `font-variation-settings` além de
`normal`/`inherit`.

**Code points:** código-fonte (`app`, `components`, `lib`; 114 arquivos, todos NFC) e
`db/seed/draws.json` (ASCII puro). Fora do subset latin aparecem só `U+2192 →`,
`U+2264 ≤` e `U+2265 ≥`, que não existem em nenhuma face Archivo e já caem no
fallback hoje. **Nenhum code point latin-ext.** O crawl de produção (§4) confirma por
página.

**Experimento de subset (descartável, não commitado):** o TTF original com a mesma
faixa Unicode e as mesmas features do latin do Google, em WOFF2 com fontTools, deu
**208.912 B**; o mesmo, limitado a wght 400–900 e wdth 75–100, deu 142.416 B. O
arquivo servido, descompactado e recompactado com o mesmo fontTools, dá 90.164 B. A
diferença está nos dados de origem (tabelas `gvar`/`glyf` de tamanho parecido, mas que
comprimem bem pior), não no encoder. Ver PLAN W9.

## 6. Campo (RUM Cloudflare, 28 dias até 2026-10-31, `bot = 0`)

A SQL API não tem percentis; o p75 é o **limite superior do bucket** do histograma em
que a fração acumulada passa de 75% (estimativa conservadora). Valores-sentinela (−1 e
≥ 4 × 10⁹) excluídos. Script: `/scratchpad` do operador, consulta reproduzida abaixo.

| Classe | LCP p75 | INP p75 | CLS p75 | TTFB p75 | FCP p75 |
|---|---|---|---|---|---|
| mobile | ≤ 1,7 s (n=80) | ≤ 80 ms (n=31) | ≤ 0,01 (n=68) | ≤ 950 ms (n=49) | ≤ 1,5 s (n=65) |
| desktop | ≤ 1,8 s (n=31) | ≤ 48 ms (n=14) | **≤ 0,17** (n=27) | ≤ 1,15 s (n=24) | ≤ 1,8 s (n=19) |

As amostras são pequenas. O CrUX não foi consultado (exige chave de API; origem
provavelmente abaixo do limiar de elegibilidade). Consulta-base:
`SELECT deviceType, FLOOR(<col>/<bucket>) AS bucket, count(*) FROM events.rumWebvitalsEvents WHERE requestHost='megasena-analyzer.com.br' AND <col> >= 0 AND <col> < 4000000000 AND bot=0 GROUP BY deviceType, bucket`.

## 7. Servidor e custo (analytics de 7 dias até 2026-10-31 ~11:06 UTC)

Fontes: `logs.workersLogs` (amostrado; contagens e somas já ponderadas pela API),
`events.durableObjectsInvocations`, `events.httpRequests` (zona).

| Métrica | Valor |
|---|---|
| Invocações `fetch` do Worker de produção | ~38.950 |
| CPU `fetch` do Worker | 2.389.470 ms (média ~61 ms; wall médio 324 ms) |
| RPCs ao DO (`jsrpc`) | ~38.192, todos em **IAD**; CPU média ~13 ms, `APPROX_MAX` 4,5 s; wall médio 163 ms |
| CPU total do megasena (Worker + DO) | ~2,99 M ms/semana ≈ 12,8 M/mês |
| CPU da conta inteira | ~6,57 M ms/semana ≈ 28,2 M/mês (franquia: 30 M) |
| Eventos de log do megasena | ~81 mil eventos `cf-worker-event`, ~278 MB/semana |
| Requisições na zona (eyeball) | ~56 mil/semana (49 mil sem categoria de bot; 3,8 mil de buscadores; 2,7 mil de IA) |
| Bloqueios 429 da regra da zona | 5.780/semana, `securityAction=block`. Principais UAs: Android 10 K/Chrome 131 (2.311), `curl/8.7.1` (1.065), Android K/Chrome 153 (627), HeadlessChrome 156 (213) |
| Staging | ~2.200 fetches e 10 alarmes/semana (fora do escopo; ver PLAN F7) |

CPU média por URL (Worker, `fetch`, 7 d): `/` 120 ms (1.220 req), `/resultados` 157 ms,
`/dashboard/statistics` 176 ms (wall 894 ms), `/numeros` 198 ms, `/dashboard` 125 ms,
`/opengraph-image` 384 ms, `/concurso/:n/opengraph-image` 270–712 ms,
`/favicon.ico` 81 ms (404), `/.well-known/assetlinks.json` 66 ms (404),
`/robots.txt` 19,5 ms.

**Billable Usage: não obtido.** `cf billing usage get-v1` respondeu 403 (token
delegado sem permissão de billing). Para o dono: Dashboard → Manage Account → Billing →
Billable Usage, últimos dois ciclos, por produto (Workers Paid, Workers requests,
Workers CPU, Durable Objects requests/duration/SQLite rows read/rows written/storage,
Workers Logs); ou a API `GET /accounts/{account_id}/billable-usage?from=<início do ciclo>&to=<fim>`
com um token que tenha `Billing:Read`. Nenhum gasto foi estimado além das franquias
públicas.

## 8. Consultas do DO (local, `bun:sqlite`, seed real de 3.065 concursos)

`scripts/perf/query-audit.ts` sobre um banco descartável em `.scratch/`. O mesmo
handler roda no DO. Bruto: `raw/baseline-2026-10-31/query-audit.json`.

| Rota | Consultas (frio) | Wall frio | Quente |
|---|---:|---:|---|
| `/api/dashboard` | 10 | 21,6 ms | 1 consulta (cache em memória por revisão), 0,5 ms |
| `/api/statistics?…` (página de estatísticas) | 18 | 53,7 ms | 1 consulta, 0,3 ms |
| `/api/draws?year=2026` | 4 | 14,4 ms | 1 consulta |
| `/api/draws?contest=3065` | 7 | 20 ms | **7 consultas, 10,1 ms**: sem cache em memória |
| `/api/numbers?n=10` | 6 | 25,4 ms | 1 consulta |
| `/api/sitemap` | 5 | 35 ms | 1 consulta |
| `/api/health` | 6 | 1 ms | 6 consultas (sem cache) |

Os planos frios fazem `SCAN draws` (3.065 linhas) em várias consultas: rows read
estimado na casa de 10–20 mil por miss. `/api/draws?contest=N` repete isso em toda
requisição (razão linhas devolvidas/lidas < 0,1). **Justificativa para não indexar
agora:** ~10 ms dentro do DO contra ~120 ms de RTT BR↔IAD; volume estimado de rows
read em ordens de grandeza abaixo da franquia de 25 bilhões/mês; e o miss do cache de
HTML de concurso é a única fonte dessas chamadas. Fica como achado documentado, não
como item.

## Como repetir

```bash
bun run scripts/perf/l2-ttfb.ts --label <rótulo> --runs 30 --rate 40 --arms current
bun run scripts/perf/l2-ttfb.ts --label <rótulo-aa> --runs 30 --rate 40 --arms current,current --paths /,/concurso/3079,/about,/manifest.json
bun run scripts/perf/page-bytes.ts --label <rótulo> --rate 40
bun run scripts/perf/l3-lab.ts --label <rótulo> --runs 5 --arms current,current
uv run --no-project scripts/fonts/report.py <arquivos de fonte> --json <saída>
# consultas: ver o cabeçalho de scripts/perf/query-audit.ts
```

Para um candidato em 0%: `--arms <id-baseline>,<id-candidato>` (ver PLAN §7).
