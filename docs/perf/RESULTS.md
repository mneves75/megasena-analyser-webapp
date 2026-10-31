# Resultados — 1.19.3

Candidato: versão Worker 1.19.3, implantada a 0% ao lado da 1.19.2 (100%) e atingida
com `Cloudflare-Workers-Version-Overrides`. Mesmo harness do `BASELINE.md`, mesmo ponto de
medição (Mac no Brasil, colo GIG), UA `megasena-perf-harness/1`, beacon RUM bloqueado no
lab. Cada medição roda três braços intercalados: `current`, `current` (A/A, o piso de
ruído) e o candidato. Só o W1 (preload apenas do subset latin da Archivo) mudou.

Host sob carga alta durante as medições (load 200–700 em 18 CPUs, de outros agentes).
Métricas de lab que dependem de CPU têm, por isso, mais ruído do que no baseline; bytes,
requisições e pixels não dependem disso.

## 1. Lab (L3, Lighthouse 13.5.0 móvel, throttling simulado, 3 execuções por braço)

Medianas por braço. "A/A" é a diferença entre os dois braços `current`; "Δ" é o
candidato menos a média dos dois. Bruto: `raw/candidate-2026-10-31/l3.json`.

| Página | Fontes baixadas (B) A / cand. | Transferência (B) A / cand. | Req. A / cand. | LCP sim. (ms) A, A, cand. | A/A | Δ |
|---|---|---|---|---|---:|---:|
| `/` | 176.783 / **90.508** | 429.286 / **343.136** | 25 / 24 | 3.452, 3.964, 3.405 | 511 | −303 (dentro do ruído) |
| `/dashboard/statistics` | 176.776 / **90.537** | 467.689 / **381.529** | 30 / 29 | 3.665, 3.573, 3.008 | 92 | −611 |
| `/dashboard/generator` | 176.755 / **90.527** | 429.491 / **343.170** | 27 / 26 | 3.227, 3.215, 2.909 | 12 | −312 |
| `/resultados/2026` | 176.859 / **90.503** | 424.416 / **338.000** | 22 / 21 | 3.366, 3.364, 2.919 | 2 | −446 |
| `/concurso/3079` | 176.806 / **90.504** | 418.647 / **332.395** | 22 / 21 | 3.356, 3.361, 2.780 | 5 | −578 |
| `/about` | 176.785 / **90.505** | 419.152 / **332.821** | 24 / 23 | 3.219, 3.211, 2.906 | 8 | −309 |

- **Fontes:** o candidato baixa só `archivo-b42cd543.woff2` (latin) em todas as páginas; o
  baseline baixa também `archivo-8312402b.woff2` (latin-ext), que nenhuma página usa
  (BASELINE §4). Economia de ~86 KB por página nova, cerca de 20% da transferência.
- **LCP simulado:** 300–600 ms menor, acima do ruído A/A em cinco das seis páginas; em `/`
  o ruído (511 ms) é maior que o efeito, então não há conclusão ali. Com n = 3 por braço,
  são indícios de direção, não estimativas precisas.
- **FCP e CLS:** sem efeito além do ruído. Em `/about` o FCP do candidato (2.018–2.115 ms)
  fica dentro da faixa dos dois braços A (2.008–2.107 ms). O CLS de lab de 0,187 aparece
  igual nos três braços (achado pré-existente F6, fora deste release).

## 2. Pixels (375 px DPR 2 e 1440 px DPR 1, tema claro, movimento reduzido)

Captura de página inteira por braço, cada braço em sessão de navegador própria. O
candidato é comparado ao primeiro braço `current` com `--max-pixels` igual ao piso A/A.

| Captura | Piso A/A (px) | Candidato (px) | Onde |
|---|---:|---:|---|
| 1440: `/`, `/about`, `/dashboard/generator`, `/dashboard/statistics`, `/resultados/2026` | 0 | 53 | último dígito da versão no rodapé (caixa 8 × 12 px) |
| 1440: `/concurso/3079` | 9.324 (conteúdo dinâmico no topo) | 53 | último dígito da versão no rodapé |
| 375: `/`, `/about`, `/concurso/3079`, `/dashboard/generator` | 0 | 134 | último dígito da versão no rodapé (caixa 13 × 19 px) |
| 375: `/dashboard/statistics`, `/resultados/2026` | 0 | 0 | — |

A caixa que envolve **todas** as diferenças do candidato é o dígito `2 → 3` de `v1.19.x`
no rodapé, mudança de conteúdo inerente a qualquer release. Fora dele o candidato é
idêntico pixel a pixel, e o piso A/A 0 mostra que a renderização é determinística: a
troca do preload de fonte não altera nenhum pixel. Limite: nas duas capturas móveis muito
altas (> 22.000 px) nem o dígito da versão difere, sinal de que a parte inferior dessas
capturas não é renderizada; o rodapé dessas páginas está coberto pelas capturas de 1440 px.
As imagens ficam fora do Git (`.scratch/perf/`).

## 3. TTFB (L2)

curl, 15 amostras por braço e modo, braços intercalados por requisição, 40 req/min, todas
as respostas com o status da classe de rota; colo GIG em todas. p50 em ms. Bruto:
`raw/candidate-2026-10-31/l2.json`.

| Rota | Classe | nova A, A, cand. | warm A, A, cand. |
|---|---|---|---|
| `/` | dinâmica | 168,7, 178,4, 160,1 | 67,0, 52,9, 84,4 |
| `/dashboard` | dinâmica | 153,4, 167,1, 141,5 | 55,6, 54,9, 76,7 |
| `/about` | estática | 191,8, 151,3, 165,2 | 70,3, 65,8, 78,1 |
| `/concurso/3079` | HTML em cache (HIT) | 270,6, 278,5, 267,4 | 203,9, 172,2, 177,4 |
| `/manifest.json` | asset estático (HIT) | 132,8, 128,2, 146,2 | 44,3, 48,9, 62,6 |

Em conexão nova o candidato fica dentro do ruído ou abaixo dele. Em conexão reaproveitada
ele aparece 10–21 ms acima nas rotas renderizadas **e também em `/manifest.json`**, um
asset estático que o W1 não toca. Uma mudança só de preload de fonte não altera o TTFB de
um JSON estático; a hipótese é efeito da versão a 0% (sem tráfego próprio, atende em
isolates frios).

**Teste simétrico** (16:00Z, com a 1.19.3 a 100% e a 1.19.2 a 0% via override, mesmo
protocolo, bruto em `raw/symmetric-2026-10-31/l2.json`):

| Rota | nova A, A, 1.19.2 | warm A, A, 1.19.2 |
|---|---|---|
| `/` | 170,9, 166,7, 163,6 | 68,4, 81,1, 64,4 |
| `/dashboard` | 150,8, 151,2, 171,7 | 70,4, 65,8, 72,9 |
| `/about` | 155,6, 157,6, 152,6 | 57,3, 59,1, 67,3 |
| `/concurso/3079` | 268,4, 268,1, 282,4 | 182,5, 213,7, 196,2 |
| `/manifest.json` | 146,7, 138,8, 130,2 | 54,3, 48,0, 45,2 |

Agora o braço a 0% é a versão antiga, e ela fica mais lenta em umas células
(`/dashboard`, `/about` em conexão reaproveitada) e mais rápida em outras (`/`,
`/manifest.json`). A penalidade da primeira rodada não se repete como efeito de versão; o
que sobra é variação entre rodadas de 10–30 ms, que aparece até no A/A (`/` warm 12,7 ms,
`/concurso/3079` warm 31 ms). Conclusão: nenhum efeito do W1 no TTFB é detectável com este
ponto de medição. O budget `B-ttfb`, porém, fixa o ruído em 10 ms (nova) e 4 ms (warm)
e não foi afrouxado: candidato menos 1.19.2 excede esse limite em `/` warm (+10,3 ms),
`/manifest.json` nova (+12,5 ms) e warm (+5,9 ms), por isso o status é `fail`.

## 4. Rollout

Implantação gradual pela API de deployments (estratégia `percentage`), sempre com a 1.19.2
mantida no deployment para rollback instantâneo:

| Etapa (UTC, 2026-10-31) | 1.19.2 | 1.19.3 |
|---|---:|---:|
| 13:54 | 100% | 0% (medições com override) |
| 15:28 | 90% | 10% |
| 15:39 | 50% | 50% |
| 15:51 | 0% | 100% |

Critério de avanço em cada etapa: nenhum log de nível `error` e nenhum resultado
`exception` ou `exceededCpu`/`exceededMemory` por versão (Workers Observability,
agrupado por `$workers.scriptVersion.id`). Nas três etapas os únicos resultados não `ok`
foram `canceled` (cliente desconectou), presentes também na 1.19.2. CPU e wall time por
versão foram registrados, mas a amostra de cada janela é pequena demais para comparar
médias; a comparação de CPU fica no budget `B-cpu` (7 dias a 100%). O Durable Object
passou a reportar 1.19.3 em `/api/health` com o alarme diário agendado e os dados
intactos (mesmo total de concursos e último concurso de antes do release).

## 5. Budgets

Status em `budgets.json`. Peso das páginas medido com `page-bytes.ts` a 100% (16:05Z),
mesmo harness e mesma matriz de 20 URLs do baseline; bruto em
`raw/candidate-2026-10-31/page-bytes.json`.

| Budget | Status | Evidência |
|---|---|---|
| `B-font-preload` | pass | 175.952 → 90.096 B de fonte por página HTML (só `archivo-b42cd543.woff2`), igual ao limite |
| `B-page-bytes` | pass | −85,8 KB por página HTML (16 páginas); HTML ±83 B, JS +12 B, CSS +5 B (versão); demais URLs idênticas |
| `B-requests` | pass | uma requisição a menos nas 16 páginas HTML; iguais nas outras 4 URLs |
| `B-pixels` | fail | 53 px (1440) e 134 px (375) acima do piso A/A 0, todos no dígito da versão do rodapé (§2) |
| `B-ttfb` | fail | §3: sem efeito de versão detectável, mas três células passam do ruído fixo do budget |
| `B-lab-lcp` | pass | §1: LCP simulado do candidato abaixo da mediana do baseline em todas as páginas do lab |
| `B-edge-hit` | fail | sem mudança neste release; HIT ainda espera o RPC `drawsVersion()` ao DO (W2 rejeitado) |
| `B-field` | deferred | RUM de 28 dias após o deploy |
| `B-cpu` | deferred | CPU por versão em 7 dias a 100% |

`B-pixels` fica `fail` pela letra do limite (piso A/A), que o dígito da versão ultrapassa em
qualquer release. A caixa da diferença foi conferida em todas as capturas e nenhum outro
pixel mudou; aceitar o dígito como conteúdo, ou mascarar a região da versão na próxima
medição, é decisão do dono, não um ajuste de tolerância.
