# Plano de performance e custo — Cloudflare

Data: 2026-10-31. Branch: `perf/cost-load-pass`, base `36ad8cc` (1.19.2, que
corresponde à versão pública de `/api/health`). Executor: Claude Opus 5.5. Revisor
cruzado: GPT-6.1 Sol via Codex (ver `REVIEW.md`). Números de L2/L3, ruído A/A e
metodologia completa: `BASELINE.md`. Tarefas: `TASKS.md`. Budgets: `budgets.json`.

Este plano descreve mudanças **propostas**. Nada em produção foi alterado, nenhum
`versions upload`/`deploy` foi feito e nenhuma escrita no Durable Object foi feita.

## Estado após a revisão adversarial (2026-10-31)

A rodada 1 (`REVIEW.md`) mudou este plano. O que vale hoje:

- **Entra no release 1.19.3 só o W1**, que mexe só no frontend, sem alteração no DO. W2,
  W3, W4, W5, W7 e W9 ficam fora. O W2 foi **rejeitado neste escopo**: servir a revisão
  de um registro com TTL deixa uma página arquivada na revisão R enquanto a API já serve
  R+1, e uma gravação atrasada de R pode estender o prazo. Isso viola o invariante de
  frescor. O W5 troca a página 404 renderizada por outra resposta e quebra a
  equivalência visual. W4 e W7 dependem de testes de carga de recuperação e de migração
  inversa (abaixo).
- **§3 (custo):** "$0 acima do fixo" é **condicional**. O billing respondeu 403; as
  requisições Workers da conta e a duração e SQLite do DO na conta não foram medidas.
  Os números são estimativas de franquia, não gasto confirmado.
- **§6 (recuperação):** PITR **não** é rollback sem perda. Restaurar um bookmark
  descarta sorteios, auditoria e agenda gravados depois dele. Uma mudança de esquema
  precisa de migração inversa, e PITR fica como recuperação de desastre, restaurado
  primeiro num destino isolado e reconciliado.
- **§7 (harness):** excluir `/api/*` **não** zera escritas no DO. Uma página com dados,
  num miss de cache, chama `DATA.handle()`, e o handler grava auditoria e log. O
  orçamento de requisições do harness inclui essas escritas, e só páginas HIT ou
  estáticas não escrevem.
- **Harness corrigido:** status esperado validado em todas as ferramentas, comparador de
  pixels por canal RGBA com reprovação por código de saída, e uma sessão de navegador
  por braço.

## 0. Adaptações do briefing a este app

O briefing foi escrito para D1. Este app não usa D1: os dados ficam num **único
Durable Object SQLite** (`MegaSenaData`, nome `megasena`) acessado pelo binding
`DATA`. Regras aplicadas:

| Briefing (D1) | Aqui |
|---|---|
| `wrangler d1 insights`, `events.d1Queries` | Não existem para DO. Uso `events.durableObjectsInvocations` (CPU/wall por RPC) e medição local com `EXPLAIN QUERY PLAN` e contadores `rowsRead`/`rowsWritten` do cursor DO em workerd. |
| Regra de parada antes de escrita em D1 | Vale para **qualquer escrita no DO de produção ou staging**, incluindo índices e migrações aplicadas no construtor do objeto. |
| Time Travel bookmark | DO SQLite tem PITR (`getBookmarkForTime`/`onNextSessionRestoreBookmark`). Antes de qualquer migração: registrar o bookmark (ver §6). |
| `wrangler` | O repo usa `cf` (1.0.0-beta.5); versões via `cf workers versions create` e `cf workers deployments create`, a validar com `--dry-run` antes de usar. |
| `PROD_URL: https://___` | Preenchido com `https://megasena-analyzer.com.br` (`lib/site-domains.json`). |

## 1. Depth brief

**O que um engenheiro sênior faria aqui sem ser pedido:** (a) olharia a geografia
antes do código. Todo usuário está no Brasil, e o único DO de dados fica em **IAD**
(Ashburn), segundo `coloCode` de `durableObjectsInvocations`. A doc da Cloudflare
diz que a dica `sam` "spawn[s] in Eastern North America instead" e que objetos não
mudam de lugar. Logo, cada RPC ao DO custa uma viagem BR↔EUA que nenhuma otimização
de código remove. A alavanca é **tirar o DO do caminho crítico**. (b) Mediria quanto
da franquia **compartilhada** da conta o app consome. A soma da conta já fica perto
da CPU incluída, e o megasena é uma parte grande dela (valores na evidência privada).
O custo em dólar é quase zero, mas a folga de CPU já está no limite. (c) Notaria que
uma regra de rate limit da zona bloqueia uma fração relevante das requisições, o que afeta tanto
usuários atrás de CGNAT quanto qualquer benchmark.

**Matéria-prima usada:** Analytics SQL API (`logs.workersLogs` com `cpuTimeMs`/
`wallTimeMs` por URL, `events.durableObjectsInvocations`, `events.httpRequests`,
`events.rumWebvitalsEvents`), 7 e 28 dias até 2026-10-31 11:0x UTC; bytes reais das
fontes servidas e do TTF original (`google/fonts`, OFL, sem Reserved Font Name);
cabeçalhos e HTML de produção; código do vinext 1.3.0 instalado; L2 com curl a partir
do Brasil (colo GIG/BEL, `loc=BR`); Lighthouse 13.5.0.

**Não consegui:** Billable Usage (`cf billing usage get-v1` → 403 com o token
delegado); colunas de TTFB/ASN em `httpRequests` (403 no plano Free da zona);
percentis na SQL API (`quantile`/`approx_*` não suportados; uso histogramas, ver
`BASELINE.md`); conteúdo da regra de rate limit da zona (o `cf` não expõe rulesets de
zona).

**Quem, além de nós, confirma o resultado:** RUM da Cloudflare (p75 de campo por
classe de dispositivo, com defasagem de ~28 dias), `cpuTimeMs` por URL em Workers
Logs, contagem de invocações do DO e Billable Usage no próximo ciclo.

## 2. Premortem de cinco anos

1. Um cache de HTML sem contrato de invalidação mostra resultado velho → todo cache novo tem contrato em `CACHE.md`, versão de build e revisão de dados na chave, e um TTL máximo declarado.
2. Uma fonte com subset quebra quando o conteúdo ganha caracteres novos (`≥`, `→` já aparecem e caem no fallback) → o manifesto do subset lista os code points cobertos, e um teste compara esse manifesto com os code points do crawl.
3. Um benchmark enganoso com cache quente, outra origem ou poucas amostras → A/A obrigatório, intercalação ABAB, ponto de origem e versão gravados, e qualquer 429 invalida a execução.
4. Uma migração no DO sem retorno econômico (índices de auditoria) → nenhuma migração entra nesta rodada; ficam só as propostas, com bookmark de PITR.
5. Um guardrail de CPU baixo demais derruba a ingestão diária, cujo pico observado é 4,5 s → `limits.cpu_ms` fica ≥ 2× o máximo do DO, não do p99.
6. Rollback que reverte só o Worker → nenhuma mudança proposta altera o esquema; as que tocam o DO declaram que o rollback é só de código.

## 3. Modelo de custo

Fonte: analytics de 7 dias × 30/7. A conta tem outros projetos e as franquias são
**por conta**, então a folga considera a soma. Os valores absolutos (volumes, contagens, totais da conta) ficam na evidência privada do operador, fora do Git: o AGENTS.md proíbe contagens de telemetria privada neste repositório público. Preços conferidos em
2026-10-31: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
(atualizado em 2026-10-02) e
[DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
(atualizado em 2026-10-18).

| Produto | Incluído | Overage | Situação (evidência privada) |
|---|---:|---|---|
| Workers requests | 10 M | $0,30/M | dentro |
| Workers CPU (fetch + jsrpc do DO) | 30 M ms | $0,02/M ms | dentro, com pouca folga na conta |
| DO requests (RPC) | 1 M | $0,15/M | dentro |
| DO duração | 400 mil GB-s | $12,50/M GB-s | dentro |
| DO SQLite rows written | 50 M | $1,00/M | não medido (§5 W7) |
| Workers Logs (eventos) | 20 M eventos; a partir de 2026-12-01, 50 GB | — | dentro |
| Fixo Workers Paid | $5 | — | **não confirmado (billing 403)** |

**Custo por 1.000 operações úteis** (renderizações de página bem-sucedidas): o custo
marginal de uso é $0 enquanto a conta ficar dentro das franquias. Na margem de overage,
uma página custa ~76 ms de CPU (média ponderada), o que dá ≈ $0,0015 por 1.000 páginas
de CPU + $0,0003 de request.

**Projeção:** custo de CPU = max(0, CPU da conta − 30 M ms) × $0,02/M ms. Mesmo um
crescimento grande do app custa poucos dólares por mês; a sensibilidade a cache é que
cada HIT do cache de arquivo evita um render de ~100–250 ms de CPU, mas **ainda paga um
RPC ao DO** (`drawsVersion()`).

Conclusão: o gasto de uso está dentro das franquias. Segundo o briefing, o esforço vai
para **latência e guardrails**, não para cortar centavos. A redução de CPU vale como
folga da franquia compartilhada (coluna separada no `RESULTS.md`: "folga liberada",
nunca "economia realizada").

## 4. Achados (impacto × confiança ÷ esforço)

| # | Achado | Evidência | Impacto |
|---|---|---|---|
| F1 | DO único em IAD; todo RPC atravessa BR↔EUA. Um HIT do cache de HTML de arquivo **ainda chama o DO** (`drawsVersion()`) antes de olhar o cache. | `coloCode=IAD` em 100% dos RPCs; L2 warm HIT de `/concurso/3079` p50 ~170–190 ms contra estático ~50–70 ms (smoke; números finais no `BASELINE.md`) | Alto (TTFB) |
| F2 | Duas fontes pré-carregadas em toda página (latin 90.096 B + latin-ext 85.856 B). Nenhum texto do app ou do seed usa caracteres latin-ext. | `Link: rel=preload` em produção; vinext 1.3.0 `find-font-files-in-css.js`: `subsets` controla só o preload; varredura do código-fonte e de `db/seed/draws.json` | Alto (bytes e LCP na primeira visita) |
| F3 | Páginas dinâmicas caras em CPU: `/` 120 ms, `/resultados` 157 ms, `/dashboard/statistics` 176 ms (wall 894 ms), `/numeros` 198 ms, imagens sociais 400–700 ms | `logs.workersLogs` 7 d, média de `cpuTimeMs` por URL | Médio (folga de CPU, TTFB/LCP) |
| F4 | Rotas inexistentes renderizam a página 404 completa no Worker: `/favicon.ico` (81 ms CPU, 56 KB), `/.well-known/assetlinks.json` (66 ms), scanners `/wp-json/*`, `/feed/`, `/login` | Workers Logs; `curl /favicon.ico` → 404 HTML | Baixo–médio (CPU) |
| F5 | Regra de rate limit da zona: bloqueia (429) uma fração relevante das requisições, a maioria de UAs de scanner, mas também ferramentas de linha de comando e navegadores headless (lab). Limiar desconhecido, abaixo de ~80 req/min por IP. | `httpRequests` `securityAction=block` (contagens na evidência privada); o harness bateu 429 a 80/min | Risco de CGNAT (decisão do dono) |
| F6 | CLS de campo no desktop: p75 ≤ 0,17 (amostra pequena); mobile ≤ 0,01. Elementos deslocados (RUM): `#main-content>div…` (conteúdo empurrado) e `footer` (empurrado pelo conteúdo em streaming em `/dashboard*`). Causa provável do primeiro: `StorageDisclosure` usa `getServerSnapshot() = STORAGE_VERSION`, então o servidor não o renderiza e o banner entra **depois da hidratação**, no topo de `<main>`, para todo visitante novo. | RUM 28 d (`cumulativeLayoutShiftElement`), `components/storage-disclosure.tsx:29` | Médio (acima de 0,1) |
| F7 | Staging tinha fetches e alarmes na semana medida; desde 2026-10-27 é a unidade `staging-off` (410), sem namespace DO e sem alarmes | Workers Logs | Fora de escopo (regra do dono "staging off") |
| F8 | Cada leitura de API escreve auditoria (1 linha + 4 índices) e log; o RPC `drawsVersion` não escreve | `lib/audit.ts`, migrações 004/006 | A medir (W7) |

## 5. Itens de trabalho (ordem de execução)

**W1 — Preload só do subset latin (fontes, uma linha).**
`app/_lib/fonts.ts`: `subsets: ['latin', 'latin-ext']` → `subsets: ['latin']`.
Todas as `@font-face` continuam declaradas com o mesmo `unicode-range`, o mesmo
`font-display: swap` e o mesmo fallback `Archivo Fallback` (métricas inalteradas).
Efeito esperado: −85.856 B e −1 requisição de fonte por página na primeira visita.
Possível ganho de LCP sob Slow 4G, porque o preload compete com o CSS crítico. Medição:
`page-bytes` local e de produção, L3 A/B, pixel diff (o render final deve ser idêntico:
nenhum code point latin-ext no crawl). Guard: teste que fixa um único preload de fonte
no HTML. Rollback: reverter o commit. Risco: uma página futura com caractere latin-ext
carrega esse arquivo sob demanda (com `swap`), como já acontece hoje com o arquivo
vietnamita.

**W2 — Revisão de draws fora do caminho crítico nos HITs.** Em `withDrawsEdgeCache`,
ler a revisão de um registro na Cache API do colo (`/__internal/draws-revision`, chave
com `APP_VERSION`) com TTL curto. Proposta: **60 s**. Se o registro faltar, chamar o DO
e gravá-lo com `waitUntil`. Efeito esperado: HIT warm de ~170–190 ms → próximo do piso
estático (~50–70 ms); menos uma invocação de DO por HIT. Contrato (`CACHE.md`): depois
de um novo sorteio ou correção, uma página de arquivo pode servir a revisão anterior
por até 60 s **por colo**. Hoje a staleness é zero, então isso muda um contrato de
frescor e **precisa da sua aprovação**. Alternativas:
(a) manter o RPC (atual; correto, mas paga ~120 ms por HIT);
(b) memo em escopo de módulo por isolate (rejeitada: estado global mutável num isolate
compartilhado e invalidação imprevisível);
(c) Workers Cache tiered (rejeitada: o HIT não invoca o Worker, então o nonce de CSP
armazenado seria reenviado, o que viola o invariante de CSP do AGENTS.md).
**Escolha: Cache API com TTL de 60 s; a alternativa rejeitada mais forte é (a).**
Guard: testes de unidade em `edge-cache.test.ts` (HIT sem chamar `drawsVersion`
dentro do TTL; MISS da revisão chama uma vez; falha do DO continua renderizando).

**W3 — Estender o cache de HTML a páginas que são função pura do build.** `/about`,
`/privacy`, `/privacy/direitos`, `/terms` (texto estático, tráfego relevante no zone
analytics) e, depois de verificar se dependem do relógio, `/`, `/resultados`,
`/numeros`, `/mega-da-virada`. Usa o mesmo mecanismo de reescrita de nonce. Precisa de
prova de que a renderização não depende de hora, cookie ou query. Muda frescor (a
revisão de draws já entra na chave). **Aprovação necessária por rota.** Efeito
esperado: −100 a 200 ms de CPU por hit dessas rotas; TTFB de HIT.

**W4 — Guardrail de CPU.** `limits: { cpu_ms: 10_000 }` em `cloudflare.config.ts`. O
máximo observado do DO é 4.500 ms (ingestão) e o do Worker é 713 ms (`APPROX_MAX`,
logs amostrados). 10 s ≥ 2× o máximo observado; o padrão é 30 s. Requisições dos
últimos 7 dias que seriam afetadas: 0. Antes de aplicar: confirmar na doc que o limite
do script vale também para o DO e que `cf/config` aceita a chave. **Aprovação
necessária** (guardrail que pode rejeitar requisições).

**W5 — 404 barato para caminhos sem rota.** Antes do vinext, responder `404`
texto/HTML mínimo para `/favicon.ico`, `/.well-known/*` não servidos e prefixos de
scanner (`/wp-`, `/feed`, `/xmlrpc.php`). Muda o corpo do 404 nesses caminhos. A
alternativa para o favicon é servir um `favicon.ico` estático, o que é mudança visual.
**Aprovação necessária.**

**W6 — CPU das páginas dinâmicas.** Perfil de CPU de `/` e `/dashboard/statistics`
(skill `workers-profiling`) antes de qualquer mudança. Só entra se houver causa
mensurável, por exemplo payload RSC duplicado ou cálculo repetido.

**W7 — Linhas escritas por requisição no DO.** Medir `rowsWritten` por rota no
runtime workerd (`tests/cloudflare/*-runtime.ts`). Se índices de auditoria sem
consulta (`idx_audit_logs_event`, `_route`, `_request_id`) dominarem as escritas,
propor a remoção. A remoção é uma migração no DO de produção: **parada obrigatória**.
Hoje está dentro da franquia, então isso não entra nesta rodada sem dado que justifique.

**W8 — CLS.** (a) Banner de armazenamento: renderizar no servidor e escondê-lo antes
da primeira pintura para quem já aceitou, com um script inline com nonce no mesmo
padrão do `ThemeScript`. O resultado final é idêntico; some o deslocamento do visitante
novo. (b) Footer em páginas com streaming: reservar a altura do conteúdo no fallback
do Suspense. Reproduzir antes no lab (1440 px e 375 px, storage limpo) e medir o CLS.
Muda a sequência visual de carregamento: **aprovação necessária**.

**W9 (fonte, fase 2) — Subset e limitação de eixos.** Usos medidos: pesos
400/500/600/700, mais `bolder` (pode chegar a 900 dentro de `font-semibold`); larguras
100%, 88% e 75%; `tnum`. Experimento: subset do **TTF original** com a mesma faixa do
latin do Google dá **208.912 B** (o arquivo servido tem 90.096 B; a recompressão do
arquivo servido com fontTools dá 90.164 B, então a diferença está nos dados de
origem). Com `wght 400–900` e `wdth 75–100` cai para 142.416 B, ainda maior que o
servido. Partir do original, como o briefing exige, hoje **piora** os bytes. Opções:
(a) manter `next/font/google` com o preload ajustado (W1) — **recomendado agora**;
(b) subset do arquivo do Google ("subset de subset"; viola a regra do briefing, mas
parte do mesmo build 2.001 que o site já serve);
(c) investigar o pipeline de build do Google a partir dos fontes do projeto Archivo.
Fase 2 só com decisão sua; o script `scripts/fonts/subset.py` só será escrito se (b)
ou (c) for aprovada.

**W10 (fora de escopo, relatar)** — staging ativo (F7) e regra de rate limit (F5).

## 6. Recuperação de dados

Nenhum item W1–W6 altera o esquema ou os dados do DO; o rollback é só de código. W7, se
aprovado, exigiria: bookmark PITR antes (`ctx.storage.getCurrentBookmark()` via RPC
privado), migração forward-only compatível com as duas versões, e rollback por
`onNextSessionRestoreBookmark` ou migração inversa. Um rollback do Worker não reverte
dados.

## 7. Montagem A/B e guardrails do harness

- **Bytes, contagem de requisições, code points, pixels:** build local do baseline e
  do candidato a partir do mesmo snapshot (`bun run build:cloudflare:production` +
  servidor local); `page-bytes`/pixel diff contra os dois.
- **Tempos (L2/L3):** nunca locais. Proposta: subir o candidato com
  `cf workers versions create` e depois `cf workers deployments create` com
  **baseline 100% / candidato 0%**. O harness alcança o candidato pelo header
  `Cloudflare-Workers-Version-Overrides: megasena-analyser="<id>"` (a doc confirma que
  0% é aceito, desde que a versão esteja no deployment atual). **Esse
  `deployments create` é uma ação de deploy em produção**, mesmo com 0%, e precisa do
  seu "sim" explícito por candidato.
- **Limitação verificada na doc:** numa divisão 100/0, cada objeto DO fica na versão de
  100%. Mudanças no código do DO (W7) **não** são medíveis por override; ficam para o
  rollout gradual.
- **Assets por versão:** verificar com uma sonda (asset que só existe no candidato,
  requisitado com e sem override) antes de confiar em números de asset/cache.
- **Cache API por versão:** a chave já inclui `APP_VERSION`; o candidato precisa de
  versão `X.Y.Z-perfN` distinta para não ler entradas do baseline.
- **Tráfego:** UA `megasena-perf-harness/1`, ≤ 3.000 requisições por execução,
  40 req/min (abaixo do limiar observado da regra da zona), qualquer 429 invalida a
  execução, `/api/*` fora da matriz (cada leitura grava auditoria), beacon RUM
  bloqueado no lab.
- **Varredura do sitemap:** o briefing pede L2 em toda URL do sitemap (~3.200). A
  40/min, uma amostra por URL leva ~80 min. Proposta: todas as URLs que não são de
  concurso + 100 concursos estratificados, 1 amostra cada, nos checkpoints. Desvio
  declarado.

## 8. Budgets

`budgets.json`, derivado do baseline, congelado após a revisão. Destaques: HIT warm
de arquivo p50 ≤ 50 ms (hoje falha pelo piso do DO; W2 é o caminho); bytes por página
≤ baseline + 1% ou 1 KB; requisições sem aumento; campo LCP ≤ 2,0 s, INP ≤ 150 ms,
CLS ≤ 0,05 (deferidos: dashboard RUM, 28 dias após o deploy).
