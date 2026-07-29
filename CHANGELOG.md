# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [1.11.1] - 2026-07-28

### Security

- O pipeline de imagens agora constrói e envia ao GHCR apenas o digest canônico, faz o Trivy escanear esse mesmo artefato com falha bloqueante para vulnerabilidades `HIGH`/`CRITICAL` e só então promove o digest aprovado para as tags finais. Isso elimina a janela em que uma imagem era publicada antes do scan e evita analisar um `:latest` antigo.
- React Doctor passa a executar exclusivamente a versão resolvida pelo `pnpm-lock.yaml`. Os scanners Gitleaks compartilham um único pin OCI imutável e rodam sem rede; ast-grep bloqueia a reintrodução de uma imagem Gitleaks baseada somente em tag no CI e no pre-commit.

### Added

- Cinco testes de contrato cobrem a identidade da imagem entre build, scan e publicação, o comportamento bloqueante do Trivy e os pins imutáveis das ferramentas de segurança.

## [1.11.0] - 2026-07-28

### Fixed

- Contraste WCAG AA nos tokens `--primary` e `--destructive`. O Lighthouse apontava três nós abaixo de 4,5:1 (CTA do hero, botão do aviso de privacidade e a nota do rodapé). Os dois tokens são usados tanto como **superfície** (`bg-primary`/`bg-destructive` com texto claro) quanto como **texto** (`text-primary` em cards, `text-destructive` no rodapé), exigências que puxam em direções opostas — escurecer o token corrigia os botões e quebrava o texto. Resolvido por tema: no claro `--primary` 38% → 34% (4,81 sobre texto branco); no escuro `--primary` 44% → 52% e `--destructive` 44% → 60%, ambos pareados com foreground escuro (6,42 e 5,08 como texto; 6,73 e 4,83 como superfície). Acessibilidade medida: 96 → 100, com `color-contrast` aprovado nos dois esquemas de cor.

### Notes

- Auditoria Lighthouse do build de produção, servido localmente sem CDN: performance 95 / acessibilidade 100 / boas práticas 100 / SEO 100 (tema claro) e 93 / 100 / 100 / 100 (escuro). Servido através da Cloudflare, o mesmo build mede 61 / 96 / 81 / 100: o script `/cdn-cgi/challenge-platform/.../main.js` (JavaScript Detections) consome ~4,3 s de execução — contra 0,2 s de todo o JavaScript da aplicação — e é a origem das três APIs depreciadas que derrubam "boas práticas". Elevar a produção acima de 95 depende de desativar esse recurso no painel da Cloudflare, não de mudanças no código.

## [1.10.0] - 2026-07-28

### Added

- Script `scripts/backfill-prizes.ts` (`bun run db:backfill-prizes`): reidrata as colunas de premiação dos sorteios já armazenados, em lotes commitados e de forma retomável, sem reescrever as demais colunas como um `db:pull` completo faria.

### Fixed

- **Premiação histórica ausente no banco.** Apenas 10 dos 3.036 sorteios tinham `prize_sena` e 65 tinham `prize_quina`: a carga histórica é anterior ao tratamento atual de `listaRateioPremio`/`faixa` e nunca foi refeita. Toda a seção "Prêmios" de `/dashboard/statistics` exibia `R$ 0,00M` e correlação `0x`. Após o backfill: 657 sorteios com prêmio de sena e 3.036 com prêmio de quina.
- `PrizeCorrelationEngine` passa a expor `prizeDrawCount` e a excluir das listas os números que nunca apareceram em um sorteio premiado — média indefinida não é média baixa e não deve ser classificada como "abaixo da média".
- `lib/analytics/pair-analysis.ts`: a frequência esperada de um par usava probabilidades por posição (`(freq/(sorteios*6))² * sorteios * 15`) e subestimava a expectativa em ~2,03x, inflando toda correlação exibida. Agora usa as marginais por sorteio com correção de amostragem sem reposição, reduzindo-se exatamente ao valor hipergeométrico `sorteios * (6/60) * (5/59)` sob histórico uniforme.
- `getStreakSets` ordenava os números frios pela intensidade decrescente, devolvendo os *menos* frios sob o título "Baixa Intensidade".
- Estratégias "Quentes"/"Frias" viravam aleatórias após a primeira aposta: a seleção era determinística (`slice(0, n)`), toda tentativa seguinte colidia na deduplicação e o fallback caía nos 60 números — mantendo o rótulo original. A seleção agora varia dentro do pool escolhido e o rótulo `_fallback` deixou de ser ocultado pela UI.
- Apostas do modo Otimizado agora preferem números ainda não usados no plano, fazendo a cobertura real coincidir com a planejada (R$100 balanceado: 40 → 60 dezenas distintas).
- Gerador: o formulário oferecia até R$ 100.000 enquanto a API recusa o modo Otimizado acima de R$ 20.000, e `actions.ts` descartava a mensagem do servidor em favor de `response.statusText` — o usuário via "Bad Request". O teto agora acompanha o modo selecionado, a mensagem pt-BR do servidor é preservada e os seletores de estratégia/modo continuam clicáveis com orçamento inválido (antes ficavam desabilitados junto com o botão, contradizendo a instrução de trocar de modo).
- `lib/db.ts`: uma migração registrada como `failed` era reexecutada e o `INSERT` de sucesso violava a restrição `UNIQUE(name)`, deixando o banco preso permanentemente. O sucesso agora é gravado por upsert dentro da mesma transação.
- `lib/api/api-fetch.ts`: a checagem que deveria impedir o envio de `INTERNAL_API_SECRET` para fora da máquina comparava a origem do destino com a origem derivada do mesmo `API_HOST`, sendo sempre verdadeira. O segredo agora só acompanha destinos loopback; destinos externos geram `security.internal_secret_target_rejected`.
- `lib/api/caixa-client.ts`: respostas da CAIXA passam por validação de schema (concurso, data, seis dezenas distintas entre 1 e 60, valores finitos não negativos) e exigem `numero === concurso solicitado`; falhas de validação não entram no retry.
- `scripts/pull-draws.ts`: os caches derivados são reconstruídos antes do `COMMIT`, dentro da transação externa. Antes os sorteios eram commitados primeiro e uma falha na reconstrução deixava dados novos com caches antigos, com `/api/health` ainda saudável.
- `scripts/backup-database.ts`: retenção padrão de 30 para 7 dias, alinhando o script à promessa pública de `docs/PRIVACY.md` e `docs/LGPD-COMPLIANCE.md`; variáveis validadas como inteiros positivos (`BACKUP_MAX_COUNT=-1` apagava até o backup recém-criado e ainda saía com sucesso); `DATABASE_PATH` passa a ser respeitado.
- `components/theme-provider.tsx`: acessos ao `localStorage` protegidos por `try/catch` e valor persistido validado — em contextos que lançam `SecurityError` a exceção podia derrubar a raiz React.
- `lib/api/caixa-client.ts`: o atraso progressivo entre requisições crescia 500ms a cada 100 sucessos sem teto, chegando a ~15s por requisição perto do concurso 3.000 e tornando uma recarga completa do histórico um trabalho de ~7 horas. Limitado por `PROGRESSIVE_DELAY_MAX`.

### Security

- `script-src-elem` passa a incluir `'strict-dynamic'`. Pela CSP3 a diretiva substitui `script-src` para elementos `<script>` sem fallback, então o `'self'` isolado admitia qualquer script same-origin sem nonce — estritamente mais permissivo que a política principal.
- Nova variável `TRUSTED_CLIENT_IP_HEADER` fixa um único header de IP de cliente. Um header apenas repassado pelo edge é controlado pelo cliente e vira a chave do rate limit; com a origem alcançável fora da Cloudflare, valores forjados em `CF-Connecting-IP` criam um bucket novo por requisição. A invariante operacional está documentada em `docs/SECURITY.md`.
- Todas as GitHub Actions externas fixadas por SHA de commit (com a tag em comentário) e o estágio `deps` do `Dockerfile` fixado pelo digest de `node:22-alpine`.

### Changed

- O programa dinâmico do modo Otimizado deixou de usar a quantidade de apostas como dimensão de estado, passando a minimizá-la dentro de um estado `(cobertura, custo)` em arrays tipados. No teto de R$ 20.000 o custo caiu de ~106 MB e ~75 ms para ~1 MB e ~1 ms por requisição — o limite do contêiner de produção é 384 MB, então duas requisições simultâneas podiam derrubá-lo. Os planos gerados permanecem idênticos em 3.199 dos 3.200 orçamentos testados; o único caso divergente é um empate com mesma cobertura, custo, número de apostas e total de dezenas.
- Hook pre-commit unificado em `.githooks/pre-commit` (gitleaks + React Doctor). Havia dois diretórios de hooks concorrentes: `core.hooksPath` apontava para `.husky/_`, de modo que o scan de segredos versionado em `.githooks/` nunca rodava, e o wrapper do React Doctor engolia o código de saída. `.husky/` foi removido; ative com `git config core.hooksPath .githooks`.
- Documentação de agentes corrigida: `AGENTS.md` descreve `app/dashboard/statistics/` e `app/dashboard/generator/` (antes listados como rotas de topo), registra que `/api/*` vive em `server.ts` (não há `app/api/`) e documenta `proxy.ts` como middleware do Next 16.
- `.cursor/rules/*.mdc` reescritas: descreviam Supabase, `better-sqlite3`, Next.js 15, `bun install`, `sqlite/migrations` e docs `PROMPT*.md` inexistentes.

## [1.9.0-beta.1] - 2026-07-28

### Added

- Runtime Bun canary para imagem Docker de produção, pinado por digest imutável (`oven/bun:canary-alpine@sha256:...`) e acompanhado do arquivo `.bun-canary-revision`.
- Action composta `.github/actions/setup-bun-pinned/action.yml` e arquivo `.bun-ci-version` para pinar a versão estável do Bun no CI (1.3.14); workflows `ci-cd.yml` e `cli-smoke.yml` atualizados para usá-la.
- Integração com React Doctor (`react-doctor@0.9.2`): script `bun run doctor`, workflow `.github/workflows/react-doctor.yml` pinado por SHA e versão, e hook pre-commit bloqueando apenas erros (não warnings).
- Hardening do pnpm: `pnpm-workspace.yaml` agora define `minimumReleaseAge: 1440` e `trustPolicy: no-downgrade`, com exceções documentadas para pacotes cujos metadados de confiança mudaram no registry.
- Variável de ambiente `DATABASE_PATH` nos workflows de CI para isolar o banco de testes.

### Fixed

- `server.ts` (`/api/trends`): o callback do cache não faz mais `JSON.stringify` duplo, corrigindo erro 500 em toda requisição; teste E2E ajustado para refletir a ordem solicitada pelo chamador.
- `lib/analytics/bet-generator.ts`: orçamento do modo `optimized` limitado a R$ 20.000 (`BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET`) para evitar vetor de negação de serviço pela DP de custos alcançáveis; `server.ts` retorna 400 com mensagem pt-BR para valores maiores.
- `buildOptimizedBetSizes` reescrito com programação dinâmica de custos alcançáveis (sparse reachable-cost DP), corrigindo planos subótimos em orçamentos como R$ 672 (agora retorna 10 apostas: 8×7 + 2×8).
- `PrizeCorrelationEngine` usa `COALESCE(AVG(...), 0)` para médias condicionais, evitando NULL quando um número só aparece em sorteios sem premiação.
- `components/statistics/section-nav.tsx`: cleanup explícito do `IntersectionObserver` sem retornos antecipados no `useEffect`, eliminando o falso-positivo do React Doctor.
- Adicionada dependência `ajv@^8.17.1` e override específico `conf>ajv` para compatibilidade com `react-doctor/conf`, mantendo `ajv@6.14.0` para ESLint via override geral.

### Changed

- Workflows de CI passam a usar a action composta de setup do Bun em vez de `oven-sh/setup-bun@v2` diretamente.
- Hook pre-commit do React Doctor usa `--blocking error`, permitindo que warnings sejam tratados de forma advisory.

## [1.8.0] - 2026-07-16

### Added

- Redesign 2026 de todas as páginas: novo app-shell com header fixo (`components/site-header.tsx`, indicador de rota ativa, menu mobile acessível, theme toggle), home data-forward com painel do último sorteio real via `/api/dashboard` (prêmio acumulado exibe "Acumulou", nunca "R$ 0,00"), navegação de seções com scrollspy na página de estatísticas (`components/statistics/section-nav.tsx`), radiogroups ARIA reais no gerador (roving tabindex) e páginas de conteúdo em prosa de 70ch. Brief de design registrado em `PRODUCT.md`.
- Cache de respostas em memória por concurso para `/api/statistics` e `/api/dashboard` (`lib/api/response-cache.ts`): chave construída apenas das opções validadas do handler, invalidação por `MAX(contest_number)` e TTL defensivo de 10 minutos. Mitiga exaustão de CPU por requisições repetidas (bun:sqlite é síncrono).
- Hook pre-commit versionado em `.githooks/pre-commit` com scan de segredos via gitleaks (fail-open sem a ferramenta; ativação: `git config core.hooksPath .githooks`).
- Suítes de teste com banco real para time-series, pares, compute-once e agregações; testes de unidade para `toIsoDate`/`formatDate`, lógica de rota ativa do header e asserts exatos do otimizador DP de apostas.
- Script `typecheck` (`tsc --noEmit`) no `package.json`.

### Fixed

- Datas de sorteio normalizadas para ISO 8601 no banco e no wire (migrations `008`/`009` + conversão na ingestão): corrige `/api/trends`, que retornava um único bucket nulo (`strftime` não entende `DD/MM/YYYY`), e o "visto pela última vez" dos padrões, que usava `MAX` lexical e reportava datas erradas. A UI formata para pt-BR via `formatDate` (parse estrito ISO, timezone UTC).
- Tabela `number_pair_frequency` agora é reconstruída em toda ingestão (`pull-draws` e `fetch-missing`); os dados de pares estavam congelados 111 concursos atrás. O rebuild lazy foi removido do caminho de leitura (GET não segura mais write-lock); cache vazio retorna lista vazia com log de aviso.
- Rebuild de pares calcula frequências individuais diretamente de `draws` (não depende mais do estado da tabela cache `number_frequency`).
- Engines de análise não repetem mais agregações caras: prize-correlation, streaks e delay-distribution computam uma vez por resposta; decade/prime/pair usam uma única query `GROUP BY` em vez de centenas de `COUNT(*)` por chamada.

### Changed

- Gerenciamento de dependências migrado de Bun para pnpm 11 (corepack): `pnpm-lock.yaml` substitui `bun.lock`, overrides de segurança vivem em `pnpm-workspace.yaml` (com `nodeLinker: hoisted`), CI usa cache do store pnpm e o Dockerfile instala deps de produção no stage `deps` com `pnpm install --prod --frozen-lockfile`. Bun segue como runtime obrigatório.
- Override de `@babel/core` restrito a `>=7.29.1 <8` (o range aberto resolvia para Babel 8, major breaking ESM-only).
- Dependências mortas removidas (`framer-motion`, `date-fns`); motion é 100% tokens CSS.
- Docs alinhadas ao fluxo real (README, CLAUDE.md, AGENTS.md, docs/DEPLOY.md, docs/SECURITY.md, docs/learn/04-data-flow.md).

## [1.7.17] - 2026-06-09

### Added

- Reduced-motion support: a global `@media (prefers-reduced-motion: reduce)` guard in `app/globals.css` neutralizes all transitions and animations (forces near-zero `transition-duration`/`animation-duration` and disables the hover-lift transform). This is the first accessibility handling of the OS "reduce motion" preference in the app. Verified via Playwright `reducedMotion: 'reduce'` (computed `transition-duration` drops to `1e-05s`).
- Curated easing-curve tokens grounded in Emil Kowalski's "Animations on the Web" principles (the `animate` skill): `--ease-out-quint`, `--ease-out-cubic`, `--ease-in-out-cubic`, `--ease-out-back` as CSS custom properties in `app/globals.css` and matching Tailwind `transitionTimingFunction` keys (`ease-out-quint`, etc.) in `tailwind.config.js`.
- `.hover-lift` utility (`app/globals.css`): GPU-friendly hover elevation animating only `transform: translateY(-2px)` + `box-shadow` with the quint easing.

### Changed

- Buttons now have tactile press feedback: `active:scale-[0.98]` added to the `buttonVariants` base (`components/ui/button.tsx`), so every button and `asChild` button-styled link reacts to press.
- `components/stats-card.tsx` uses the new `.hover-lift` (transform + elevation) instead of the shadow-only `hover:shadow-glow`.
- `components/lottery-ball.tsx` hover scale now uses the `ease-out-quint` curve for a more premium feel (motion unchanged otherwise).
- Animation approach decision recorded: the project animates exclusively via CSS tokens + Tailwind utilities, not `framer-motion` (which remains a dead, unused dependency in `package.json`).

## [1.7.16] - 2026-06-09

### Fixed

- Theme flash (FOUC): the page no longer paints white before switching to the resolved theme. `ThemeProvider` only applied the `dark`/`light` class in a post-hydration effect, so the first paint used the light `:root` tokens. Added `components/theme-script.tsx`, a blocking pre-paint inline script (rendered as the first child of `<body>` with the CSP nonce) that reads the stored theme with a `prefers-color-scheme` fallback and sets the class on `<html>` during HTML parse, before first paint. Mirrors the ThemeProvider storage key and matches Vercel's `rendering-hydration-no-flicker` guidance. Regression test in `tests/app/theme-flash.spec.ts`.

## [1.7.15] - 2026-06-09

### Fixed

- `/api/*` responses now send `Cache-Control: no-store` via the shared `buildApiSecurityHeaders` (`lib/security/csp.ts`). This is the root-cause fix for the stale `/api/health` served by the Cloudflare edge across deploys (1.7.14 cache-busted the verifier; this stops the endpoint from being cached at all). All API responses are dynamic JSON and must never be stored in a shared/CDN cache. Test added in `tests/lib/security/csp.test.ts`. Note: if a Cloudflare "Cache Everything" rule explicitly ignores origin headers, a CDN-side bypass for `/api/*` is still required.

## [1.7.14] - 2026-06-09

### Fixed

- `bun run deploy:verify` (`scripts/check-production-freshness.ts`) now bypasses the CDN/edge cache: the health request carries a unique `cb=` cache-buster plus `Cache-Control: no-cache` / `Pragma: no-cache` and `cache: 'no-store'`. This removes the false "produção desatualizada" negatives caused by Cloudflare serving a cached `/api/health`. The displayed health URL stays canonical (no query); only the request carries the buster. Regression test added in `tests/scripts/check-production-freshness.test.ts`.

## [1.7.13] - 2026-06-09

### Fixed

- Lottery ball styling moved to a semantic `--shadow-ball` token (light + dark) and a `boxShadow.ball` Tailwind utility, replacing the hardcoded `ring-white/20` and inline hsl() shadow in `components/lottery-ball.tsx`. Resolves a closeout review finding against the project's "semantic tokens only, never hardcode colors" rule. Light rendering is unchanged (token values are byte-identical); the dark-mode drop shadow is now theme-adaptive instead of a fixed teal.

## [1.7.12] - 2026-06-09

### Changed

- UI redesign across all screens (home, dashboard, statistics, generator, about, privacy, rights, terms, and error/loading states). Audited with the design-taste skill in redesign-preserve mode; information architecture, routes, and copy unchanged.
- Design tokens recalibrated in `app/globals.css`: primary recolored from oversaturated cyan (`191 95% 50%`) to a deep desaturated teal (`192 72% 38%`) so white-on-primary text now meets WCAG AA contrast; surfaces moved from pure `#fff`/near-black to tinted off-white/off-black for depth; the 40px neon `--shadow-glow` halo replaced by a subtle tinted elevation; destructive/secondary/muted/chart tokens re-harmonized to a single cool hue family. Recolor propagates to all pages that consumed these tokens.
- Lottery balls (`components/lottery-ball.tsx`) rebuilt as real spheres (top-light to bottom-dark gradient, inset highlight, tight shadow, tabular figures) instead of the neon-glow gradient; hover softened to `scale-105`.
- Hero headlines on home and generator changed from gradient-clipped text to solid foreground with tighter tracking; data-page headings aligned to the same scale.

### Added

- Workflow rules in `CLAUDE.md` and `AGENTS.md`: verify every change with the agent-browser, reproduce bugs with a failing test before fixing, and close out with the autoreview skill.

## [1.7.11] - 2026-06-08

### Added

- `bun run db:export-draws` exports the public CAIXA draw history to a versionable, PII-free JSON seed at `db/seed/draws.json` (draws table only; internal id and local timestamps dropped for stable diffs). Telemetry tables are never included.
- Seed integrity test (`tests/scripts/export-draws.test.ts`) asserting contiguous contests, six unique numbers per draw in 1-60, well-formed dates/fields, and no telemetry/internal columns.

## [1.7.10] - 2026-06-08

### Added

- Health/deploy verification now includes data readiness and draw freshness gates, and E2E covers standalone CSS delivery plus mobile overflow on core routes.
- Database migration `007_draw_number_integrity.sql` adds draw-number integrity guards.

### Changed

- CAIXA ingestion now fails full-range pulls on partial failures by default; `--allow-partial` is the explicit opt-in.
- Production startup syncs `.next/static` into the standalone runtime before launch, and Docker installs Linux production dependencies inside the image build.
- Proxy trust now requires explicit `TRUSTED_PROXY_IPS` for non-loopback peers.
- `assert-standalone-clean` now scans the whole `.next/standalone` tree (skipping `node_modules`) instead of only `db/`, so a database under a non-default `DATABASE_PATH` cannot ship undetected.

### Security

- Internal server-side API rate-limit bypass now requires a strong `INTERNAL_API_SECRET` and loopback peer; spoofed public headers remain rate-limited.
- CSP docs/tests now distinguish blocked `unsafe-inline` in `script-src`/`style-src` from the narrow `style-src-attr 'unsafe-inline'` chart-style exception.
- CI includes `bun audit`, and mobile icon-only navigation keeps accessible labels.
- Time-series period SQL formats are now a frozen allowlist (`PERIOD_FORMATS`), making the raw-interpolated period expression safe-by-construction regardless of the caller-supplied period value.

### Fixed

- Fixed JSON-LD hydration warnings, generator error announcement/focus behavior, duplicate draw-number acceptance, mobile legal-template overflow, and compact recent-draw row overflow.

## [1.7.9] - 2026-05-24

### Added

- `bun run security:csp:edge` agora imprime ações de remediação públicas para o dono provável da sobrescrita de CSP, incluindo a ordem segura para `shared_response_headers`: correlacionar fingerprint, verificar Response Header Transform Rules, remover apenas o header CSP e revalidar home/API.

### Security

- Documentado que as ações impressas pelo verificador não autorizam publicar IDs de regras, hosts privados, caminhos reais, tokens ou URLs de origem.

## [1.7.8] - 2026-05-24

### Added

- `bun run security:csp:edge` agora infere um dono provável para a sobrescrita pública de CSP (`shared_response_headers`, `cloudflare_client_side_security`, `origin_or_app` ou `inconclusive`) e imprime a próxima ação recomendada sem expor IDs, hosts privados ou tokens.

### Security

- Documentado que `shared_response_headers` é o diagnóstico esperado quando HTML e `/api/health` compartilham a mesma CSP não-app enquanto o HTML ainda contém nonce da aplicação; nesse caso, investigue Cloudflare Response Header Transform Rules ou middleware de headers do proxy antes de Page Shield.

## [1.7.7] - 2026-05-24

### Added

- `bun run security:csp:edge` agora aceita `ORIGIN_BASE_URL` para comparar a borda pública com uma origem direta opt-in, sem imprimir a URL privada, e classificar se a substituição de CSP acontece depois da aplicação.

### Security

- Documentado que `ORIGIN_BASE_URL` deve ficar fora do repositório e ser usado apenas como diagnóstico local/operacional; hosts, IPs, caminhos privados e detalhes do servidor continuam proibidos em commits e logs públicos.

## [1.7.6] - 2026-05-24

### Added

- `bun run security:csp:edge` agora imprime um fingerprint curto (`sha256:<16 hex>`) e resumo de diretivas/fontes suspeitas quando a mesma CSP não-app aparece na home e em `/api/health`, facilitando correlacionar a política pública com regras no Cloudflare/Traefik sem publicar IDs privados.

### Security

- Documentado que o fingerprint público de CSP deve ser usado como evidência de correlação, não como autorização para registrar IDs de regras, hosts, caminhos reais ou detalhes privados do deploy.

## [1.7.5] - 2026-05-24

### Added

- Cloudflare Trace no `bun run security:csp:edge` agora aceita headers customizados e opções `skip_response`/`skip_challenge` para reproduzir melhor a avaliação da borda sem alterar a configuração remota.

### Security

- Headers de Trace são lidos de JSON opt-in e valores não-string são ignorados, evitando interpolação acidental de objetos ou segredos em logs públicos.

## [1.7.4] - 2026-05-24

### Added

- `bun run security:csp:edge` agora pode executar Cloudflare Request Trace quando `CLOUDFLARE_ACCOUNT_ID` está disponível, destacando passos matched que citam `Content-Security-Policy` sem imprimir tokens ou IDs.

### Security

- Documentado o uso de token read-only com permissão `Allow Request Tracer Read` para identificar a regra Cloudflare ativa quando a borda substitui a CSP nonce-based da aplicação.

## [1.7.3] - 2026-05-24

### Changed

- `bun run security:csp:edge` agora diferencia zona Cloudflare inacessível, falha parcial de leitura e zona acessível sem regra CSP candidata, evitando o diagnóstico ambíguo de lista vazia.

### Security

- Documentado que o lookup Cloudflare read-only deve confirmar acesso real à zona antes de concluir que não existem Response Header Transform Rules ou políticas Page Shield candidatas.

## [1.7.2] - 2026-05-24

### Changed

- `bun run security:csp:edge` agora lê uma amostra HTML limitada para confirmar nonces emitidos pela aplicação, detectar Cloudflare JavaScript Detections e priorizar o diagnóstico de regra global quando a mesma CSP não-app aparece em HTML e `/api/health`.

### Security

- Documentado o padrão observado em produção: HTML com nonce da aplicação, CSP pública ampla em HTML e API, headers obsoletos e script JSD do Cloudflare indicam sobrescrita por camada compartilhada de response headers antes de tratar como problema LGPD ou bug do App Router.

## [1.7.1] - 2026-05-23

### Added

- Adicionado `bun run security:csp:edge` para detectar quando Cloudflare/Traefik substituem a CSP nonce-based pública por uma política ampla com `unsafe-inline`.
- O verificador de CSP pode usar `CLOUDFLARE_API_TOKEN` com `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_ZONE_NAME` para listar Response Header Transform Rules e políticas Client-side security/Page Shield candidatas sem imprimir segredos.
- Documentado o limite de staging: deploy de staging exige alvo remoto explícito e health check real, não apenas tarball, imagem local ou CI verde.

### Security

- Documentado o diagnóstico da CSP de borda, incluindo checks para Cloudflare Response Header Transform Rules, Client-Side Security/Page Shield, Snippets/Workers e middleware de headers do Traefik.
- Adicionado override temporário de `ws` para manter `bun audit` limpo contra `GHSA-58qx-3vcg-4xpx` via `jsdom`.

## [1.7.0] - 2026-05-21

### Added

- LGPD: política de privacidade reescrita (`docs/PRIVACY.md`, `/privacy`) com controlador, encarregado (`privacidade@megasena-analyzer.com.br`), bases legais, retenção, transferência internacional, direitos e segurança.
- LGPD: nova página `/privacy/direitos` com modelo de requisição, mailto pré-preenchido, lista de direitos do Art. 18 e canal único.
- LGPD: banner não-bloqueante de transparência de armazenamento local (`components/storage-disclosure.tsx`), persistido em `megasena-privacy-ack`.
- LGPD: documentos de governança `docs/LGPD-COMPLIANCE.md` (RoPA, bases legais, fail-closed, RoPA) e `docs/INCIDENT-RESPONSE.md` + `docs/INCIDENT-RESPONSE-TEMPLATE.md` (Art. 48).
- Link "Direitos LGPD" no rodapé de todas as páginas.

### Changed

- Pseudonimização de IP migrada de SHA-256 cru para HMAC-SHA256 com salt rotativo (`lib/security/pseudonymize.ts`) usando `IP_HASH_SECRET` (mínimo 32 caracteres).
- Auditoria armazena pseudônimo `hmac-sha256:v1:<windowId>:<digest>` em vez de `sha256:<digest>`.
- `scripts/dev.ts` e `scripts/start-prod.ts` declaram `NODE_ENV` explicitamente para o subprocesso da API.

### Security

- Produção (`NODE_ENV=production`) é **fail-closed** quando `IP_HASH_SECRET` está ausente ou tem menos de 32 caracteres. A validação ocorre antes das migrations, impedindo side effects em deploy mal configurado.
- Escape hatch explícita `IP_HASH_SECRET_AUTOGENERATE=true` para E2E (configurada em `playwright.config.ts`); não habilitar em produção real.
- `docker-compose.yml` exige `IP_HASH_SECRET` via `${IP_HASH_SECRET:?...}`.
- `bun run security:secrets:history` agora inclui resumo de alcance por branch/tag para cada commit com achados redigidos.

## [1.6.21] - 2026-05-14

### Security

- Excluídos bancos SQLite, WAL/SHM, backups e artefatos `.bak` do output tracing do Next.js standalone.
- `bun run build` agora falha se `.next/standalone` contiver artefatos SQLite locais, evitando publicar banco de produção/desenvolvimento embutido no bundle.

## [1.6.20] - 2026-05-14

### Added

- Adicionado `bun run security:secrets:history` para varrer histórico Git com Gitleaks em modo redigido e falhar quando houver achados.

### Security

- Documentado o limite entre varredura da árvore atual e varredura de histórico, incluindo a regra de não publicar relatórios brutos de possíveis segredos.

## [1.6.19] - 2026-05-14

### Added

- Adicionado `bun run deploy:verify` para validar que a produção pública em `/api/health` está saudável e retorna a mesma versão de `package.json`.
- Cobertura unitária para o verificador de frescor da produção.

### Security

- O fluxo documentado de deploy agora inclui `bun.lock` no tarball e usa `bun install --frozen-lockfile`, evitando resolução nova de dependências no servidor durante o deploy.

## [1.6.18] - 2026-05-14

### Segurança

- `POST /api/generate-bets` agora exige `Content-Type` JSON e responde `415` para `text/plain` ou header ausente, reduzindo abuso cross-site por requisições simples sem preflight CORS.

### Testes

- Cobertura unitária adicionada para detecção de media type JSON e cobertura Playwright para rejeição de `text/plain` no endpoint de geração.

## [1.6.17] - 2026-05-14

### Operação

- Supervisão de runtime em Bun agora aguarda `process.exited` depois de `SIGTERM` e escala para `SIGKILL` após o período de graça, evitando que o shutdown Docker/local declare sucesso apenas porque o sinal foi enviado.
- `Dockerfile` passa a executar `scripts/start-docker.ts` preservando a estrutura de diretórios, mantendo imports compartilhados testáveis no runtime.

### Testes

- Cobertura unitária adicionada para shutdown gracioso e fallback forçado de subprocessos.

## [1.6.16] - 2026-05-14

### Segurança

- Resolução de IP confiado agora prefere `CF-Connecting-IP` e `X-Real-IP` antes de `X-Forwarded-For`, reduzindo risco de spoofing quando proxies preservam cadeias encaminhadas.
- `nginx.conf.example` agora sobrescreve `X-Forwarded-For` com `$remote_addr` em vez de anexar cadeias recebidas do cliente.

### Testes

- Cobertura unitária adicionada para precedência segura de headers de IP encaminhados por proxy confiável.

## [1.6.15] - 2026-05-14

### Segurança

- Preflights CORS em `/api/*` agora consomem o mesmo rate limit dos demais endpoints, fechando bypass de abuso por `OPTIONS` ilimitado.

### Testes

- Cobertura Playwright adicionada para validar `429` após exceder o limite de preflights CORS de um mesmo cliente.

## [1.6.14] - 2026-05-14

### Dados

- Base atualizada com 21 novos sorteios (#2987 a #3007), último concurso #3007 de 12/05/2026. Total de 3006 sorteios no banco.

### Documentação

- `nginx.conf.example` alinhado ao modelo atual de TLS no reverse proxy: HSTS no bloco HTTPS, sem sobrescrever CSP da aplicação e sem `X-XSS-Protection` obsoleto.
- `docs/DEPLOY.md` agora explicita que HSTS deve ser aplicado pelo proxy reverso que termina TLS.

### Build

- `bun run dist:standalone` agora bloqueia artefatos Docker com rewrite de API para porta temporária de E2E, evitando publicar imagem apontando para `localhost` incorreto.

## [1.6.13] - 2026-05-14

### Segurança

- `proxy.ts` deixou de emitir HSTS e `upgrade-insecure-requests`, porque o standalone do Next pode reconstruir `request.url` a partir de `X-Forwarded-Proto` antes do middleware validar qualquer peer. HSTS de páginas TLS deve ser aplicado no reverse proxy.

### Testes

- Cobertura unitária e Playwright adicionada para garantir que `X-Forwarded-Proto: https` não força HSTS/CSP de HTTPS em páginas servidas pelo Next.

## [1.6.12] - 2026-05-14

### Segurança

- API Bun agora ignora `X-Forwarded-Proto` para cálculo de requisição segura quando o peer de socket não é um proxy confiável, evitando que headers spoofados influenciem HSTS/upgrade logic.
- `X-Forwarded-For`, `X-Real-IP` e `CF-Connecting-IP` agora precisam conter IP válido antes de serem usados em rate limit/auditoria.

### Testes

- Cobertura unitária adicionada para spoofing de `X-Forwarded-Proto` e IPs encaminhados malformados.

## [1.6.11] - 2026-05-14

### Segurança

- `/api/health` passou a participar do mesmo rate limit da API pública, reduzindo abuso de leituras de banco por health checks externos.
- Endpoints públicos agora rejeitam métodos HTTP não suportados com `405` e header `Allow`, antes de executar handlers analíticos.

### Testes

- Cobertura E2E adicionada para rate limit headers em `/api/health` e rejeição de métodos inválidos na API Bun.

## [1.6.10] - 2026-05-14

### Segurança

- `/api/trends` agora rejeita listas de números fora do domínio 1-60 ou maiores que o domínio completo da Mega-Sena, evitando trabalho analítico desnecessário em entrada pública.
- `docker-compose.yml` passa a publicar portas locais apenas em `127.0.0.1`, reduzindo exposição acidental da API Bun e do proxy local na rede.

### Testes

- Cobertura adicionada para parsing defensivo dos números usados pela análise de tendências.

## [1.6.9] - 2026-05-14

### Segurança

- Superfície `/api/*` em Bun agora aplica headers defensivos próprios em todas as respostas, incluindo CSP deny-by-default para JSON, `nosniff`, `DENY` em frame e `no-referrer`.
- CORS da API foi reduzido para aceitar apenas `Content-Type` em preflights, removendo `Authorization` da lista permitida enquanto a API pública não usa autenticação por esse header.
- Logs estruturados e auditoria passaram a usar sanitização recursiva compartilhada para redigir chaves sensíveis aninhadas, limitar profundidade/arrays e tratar ciclos.
- Baseline legado de secret scanning foi removido do repositório, e o CI passou a escanear a árvore atual com Gitleaks.
- Headers de proxy para rate limiting/auditoria agora só são aceitos quando `TRUST_PROXY_HEADERS=true` e o peer de socket é local ou privado.

### Corrigido

- Mensagens públicas de erro retornadas pela API e pelo gerador foram alinhadas ao pt-BR com acentos.
- Workflow de build Docker agora expõe o digest a partir do step correto.

### Infraestrutura

- GitHub Actions de checkout, cache, Bun, Docker, upload de artefato, SBOM e CodeQL foram atualizadas para tags atuais verificadas via GitHub API.
- Dependências diretas de baixo risco foram atualizadas em patches/minors compatíveis, preservando majors que exigem migração dedicada.
- Dockerfile runtime agora copia artefatos com ownership do usuário `bun` e executa a aplicação como usuário não-root.

### Testes

- Cobertura adicionada para headers defensivos da API Bun, CORS mínimo e sanitização recursiva em logs/auditoria.

## [1.6.8] - 2026-05-14

### Corrigido

- Corrigida a resolução da versão no job de SBOM do CI/CD para produzir artefatos com nome versionado.
- O upload de SBOM agora falha explicitamente quando o arquivo esperado não existe.

## [1.6.7] - 2026-05-14

### Corrigido

- Corrigido o workflow de CI/CD para gerar tags Docker válidas em builds disparados por tags Git.
- Atualizado o pin do `aquasecurity/trivy-action` para uma tag publicada, restaurando a etapa de varredura de segurança.

## [1.6.6] - 2026-05-14

### Testes

- E2E do Playwright agora prepara um banco SQLite determinístico em `.tmp/e2e/`, evitando falha em CI quando o runner não possui dados reais de sorteios.

## [1.6.5] - 2026-05-14

### Infraestrutura

- Baseline Bun elevado para 1.3.14 em `package.json`, Docker, CI e documentação.
- `bunfig.toml` passa a habilitar `run.noOrphans = true` para evitar processos Bun órfãos quando o processo pai morre.
- Workflow de SBOM deixa de depender de `node -p` e resolve a versão do pacote com `bun -p`.
- Chamadas auxiliares de Playwright/Vitest foram padronizadas para `bun x` nos pontos documentados e no CI.

## [1.6.4] - 2026-05-14

### Segurança

- Next.js atualizado para 16.2.6 e cadeia de testes/estilos atualizada para remover vulnerabilidades reportadas por `bun audit`.
- CSP de produção consolidada no modelo com nonce por request, `strict-dynamic` e sem `unsafe-inline` em `script-src` ou `style-src`.
- JSON-LD agora recebe nonce e escapa `<` na serialização para evitar fechamento prematuro de `<script>`.
- A alternativa CSP estática/SRI foi validada, mas rejeitada porque quebra a hidratação do App Router com scripts inline de streaming; páginas protegidas por nonce passam a renderizar dinamicamente conforme requisito do Next.js para CSP nonce-based.
- Overrides de dependências vulneráveis foram atualizados para `brace-expansion`, `flatted`, `picomatch` e `postcss`.

### Testes

- Cobertura adicionada para CSP com nonce, proxy, serialização segura de JSON-LD e E2E de headers/violações CSP no navegador.

## [1.6.3] - 2026-03-20

### Alterado

- A página de estatísticas detalhadas agora mostra explicitamente o concurso, a data e o total de sorteios usados como base da análise.

## [1.6.2] - 2026-03-20

### Alterado

- Fluxo de `dev` e `build` alinhado ao padrão do Next.js 16 com Bun, removendo o opt-out explícito de Webpack dos scripts principais.
- `proxy.ts` simplificado para o caminho sem nonce morto, mantendo CSP compatível com App Router/standalone sem cabeçalhos de request desnecessários.

### Adicionado

- Novo comando `bun run dist:standalone` para sincronizar `dist/standalone` a partir de `.next/standalone` e `.next/static` sem depender de globs frágeis de shell.
- Novos testes para endurecer a migração: `tests/proxy.test.ts` e `tests/scripts/sync-standalone-dist.test.ts`.

### Documentação

- `README.md`, `CLAUDE.md`, `docs/DEPLOY.md` e `docs/learn/chapter-06-nextjs-rsc.md` alinhados ao fluxo real do projeto: frontend Next.js standalone, superfície `/api/*` em `server.ts` com Bun e deploy self-hosted sem `deploy.sh`.

### Segurança

- O artefato `dist/standalone` agora descarta bancos SQLite e backups locais traçados pelo build, evitando deploy acidental com snapshot embutido.

## [1.6.1] - 2026-03-19

### Corrigido

- Fluxo de produção local corrigido com `bun run start` real para `standalone` + API Bun.
- Bootstrap de desenvolvimento endurecido para aguardar saúde da API antes de liberar páginas SSR dependentes.
- Rota `/dashboard/generator` voltou a hidratar corretamente em produção com CSP compatível com App Router/standalone.
- `manifest.webmanifest` adicionado para eliminar 404 e ruído de runtime no navegador.
- Script morto `db:sync` removido do `package.json`.

### CI/CD

- Pipeline agora executa E2E antes do build de imagem.
- Gate falso de cobertura vazio removido do CI; a suíte continua obrigatória, mas sem publicar artefato enganoso.
- Toolchain fixada em versões compatíveis com o fluxo validado do projeto.

### Documentação

- `README.md`, `CLAUDE.md`, `docs/DEPLOY.md`, `docs/PRIVACY.md` e `docs/learn/chapter-08-testing.md` alinhados ao fluxo real de produção, aos comandos atuais e ao fato de este ser um repositório público.

### Segurança

- Rate limiting passou a confiar apenas em `requestIP()` por padrão, com `TRUST_PROXY_HEADERS=true` exigido para confiar em headers de proxy.
- Limite de payload do `POST /api/generate-bets` agora é aplicado por leitura stream-based, não apenas por `Content-Length`.

## [1.6.0] - 2026-03-18

### SEO

- **[CRITICAL] Removed fake aggregateRating** from Schema.org structured data (manual action risk)
- **[CRITICAL] Removed `force-dynamic` from root layout** -- home, privacy, terms, generator, about now statically prerendered (was forcing SSR on every page)
- **[CRITICAL] Centralized BASE_URL** -- consolidated 12 inline `process.env.NEXT_PUBLIC_BASE_URL` definitions into single `lib/constants.ts` export
- **Fixed sitemap.xml** -- removed `changeFrequency`/`priority` (Google ignores), added meaningful `lastModified` dates
- **Fixed heading hierarchy** on statistics page -- added H2 section headers, changed orphaned H4s to H3s
- **Activated breadcrumb schema** on all dashboard pages with `BreadcrumbList` structured data
- **Updated MultiJsonLd to @graph structure** -- single `<script>` with proper `@graph` array
- **Removed empty `sameAs`** from Organization schema
- **Added FAQ schema** to home page with 5 FAQs (featured snippet targets)
- **Fixed Portuguese accents** in all user-facing content (SEO-critical for pt-BR indexing)

### Adicionado

- **Pagina Sobre** (`/about`) -- projeto, fonte de dados (API CAIXA), metodologia, disclaimer, contato
- **Conteudo educacional na home** -- secao "O que e o Mega-Sena Analyzer?" + FAQ accordion
- **Conteudo educacional no gerador** -- explicacao das 4 estrategias (Balanceada, Otimizada, Quentes/Frios, Fibonacci)
- **Link "Sobre o Projeto"** no footer

### Acessibilidade

- Adicionado `aria-label` em todos os `<nav>` do dashboard (5 paginas)

### Corrigido

- `security.txt` -- removida URL de Policy inexistente
- `manifest.json` -- adicionados acentos corretos no campo description
- `CLAUDE.md` -- atualizada URL de producao para `megasena-analyzer.com.br`

## [1.5.9] - 2026-03-18

### Dados

- **Atualização de sorteios**: 40 novos concursos adicionados
  - Antes: Concurso #2945 (Dez 2025), 2944 sorteios
  - Depois: Concurso #2985 (17/03/2026), 2984 sorteios

### Corrigido

- Titulo SEO encurtado e adicionado skip link para acessibilidade

### Alterado

- Workflow de build agora gera saida standalone do Next.js antes do build da imagem Docker.
- Regras de docker ignore agora permitem dist/standalone no contexto de build.
- Etapa SBOM do CI agora usa anchore/sbom-action para substituir a action syft faltante.

### Corrigido

- Requisicoes retry para API CAIXA em respostas transitorias 5xx/429, respeitando Retry-After quando presente, e adicionada cobertura para comportamento de retry.

### Documentacao

- Documentada correcao de aspas `GITHUB_OUTPUT` no GitHub Actions para a etapa de versao SBOM.
- Adicionadas secoes de SEO e deployment ao CLAUDE.md.

## [1.5.8] - 2025-12-29

### Adicionado

- **Documentação Educacional Completa (`docs/learn/`)**: Tutorial de 8 capítulos em pt-BR para desenvolvedores juniores
  - Capítulo 1: Introdução ao Mega-Sena Analyzer (probabilidade, stack tecnológica, arquitetura)
  - Capítulo 2: Combinatória - matemática de contagem e combinações (C(n,k), preços exponenciais)
  - Capítulo 3: Análise Estatística de Dados Históricos (análise de frequência, padrões, descritiva vs inferencial)
  - Capítulo 4: Algoritmos - Fisher-Yates shuffle, programação dinâmica, MDC, estratégias de geração de apostas
  - Capítulo 5: Banco de Dados - padrões SQLite, transações, prepared statements, otimização
  - Capítulo 6: Next.js e RSC - arquitetura Server Components, Server Actions, fronteiras cliente-servidor
  - Capítulo 7: Sistema de Geração de Apostas - arquitetura completa, modos, estratégias, otimização
  - Capítulo 8: Testes com Vitest - mocks, cobertura, padrões de teste
  - 4.573 linhas de conteúdo educacional usando técnica Feynman
  - 20+ exercícios práticos com soluções
  - Referências diretas ao código em `lib/analytics/`, `lib/constants.ts`, etc.
- Melhorias na documentação CLAUDE.md com rastreamento de versão (v1.5.7)
- **Padrão de Teste com Banco em Memória**
  - Banco de dados em memória com normalização SQL para testes unitários rápidos
  - Extraído da implementação lib/db.ts:116-475
  - Fornece testes unitários 100-1000x mais rápidos eliminando I/O de arquivo
- Seção de Estratégia de Testes documentando padrão de Banco em Memória para testes unitários rápidos
- Seção de Padrões Importantes documentando padrões arquiteturais chave:
  - Banco em Memória (`lib/db.ts:116-475`) para testes rápidos e confiáveis sem I/O de arquivo
  - Otimização de apostas com Programação Dinâmica (`lib/analytics/bet-generator.ts:157-268`)
  - Retenção de log de auditoria com pruning de hard-delete para workflows de compliance

### Alterado

- Atualizada documentação com guidelines de infraestrutura e operações
- Migrado Tailwind para v4 (CSS import + @tailwindcss/postcss) e renomeado config para `tailwind.config.js`
- Normalizado tratamento de esquema de rewrite API_HOST; documentada exceção cacheComponents e restauradas rotas force-dynamic
- Substituída ingestão de sorteios por UPSERT para preservar created_at e evitar semântica de delete
- Habilitado noImplicitReturns/noUnusedLocals/noUnusedParameters e ignorados artefatos de cobertura no ESLint
- Adicionado sink SQLite durável log_events com flushes enfileirados para logs estruturados
- Registrado sink de log via módulo server-only para evitar que bundles cliente puxem dependências SQLite
- Adicionado agendador de retenção de logs + CLI (scripts/prune-log-events.ts) com default de 30 dias
- Adicionado LOG_RETENTION_DAYS ao .env.example e entrada de script log:prune
- Atualizado toolchain Vite/Vitest e dados do browserslist para remover avisos de depreciação e staleness
- Alterada retenção de audit/log para hard deletes conforme exceção no-soft-delete
- Adicionada migração 006 para remover colunas deleted_at de audit_logs e log_events

### Documentação

- CLAUDE.md agora inclui estratégia de testes abrangente e padrões arquiteturais
- Exclusões de cobertura documentadas (app/, components/charts/, lib/analytics/\*)
- Padrão de banco em memória documentado com detalhes de normalização SQL
- Algoritmo DP de otimização de apostas documentado com referências de número de linha
- Atualizado exec spec de engenharia com marcos, exceções e evidências de verificação

## [1.5.7] - 2025-12-28

### Adicionado

- Adicionada exibição de versão no footer.

### Alterado

- Atualizada documentação para refletir cobertura Playwright E2E e status atual da suite de testes.

## [1.5.6] - 2025-12-28

### Adicionado

- Adicionado helper compartilhado de fetch API com timeouts e resolução de URL base para chamadas server-side.
- Adicionado cache de fallback SSR para dados de dashboard e estatísticas em falhas de API.
- Adicionado agendador de retenção de auditoria + comando CLI de pruning com exemplo `AUDIT_RETENTION_DAYS`.
- Adicionado config Playwright e scaffolding de testes e2e.
- Adicionado job de geração SBOM no CI e ignorados artefatos de saída.
- Adicionada localização de migrações de backup e tooling de sincronização.

### Alterado

- Server action do gerador agora usa helper compartilhado de fetch API com logging de erro estruturado.
- Config Vitest agora enforce thresholds de cobertura de 80% e exclui artefatos e2e/build.
- Adaptador de teste de BD em memória agora respeita timestamp de retenção de auditoria e queries de lookup de log de auditoria.

### Corrigido

- Corrigidos erros da tabela audit_logs em produção causados por mounts de volume Docker escondendo migrações.
- Corrigida reconstrução de plano de dimensionamento de apostas otimizado sob verificações de índice estritas.
- Corrigido relatório de retenção de auditoria sob exactOptionalPropertyTypes.
- Corrigido acesso a env do Playwright CI para satisfazer assinaturas de índice TypeScript estritas.

## [1.5.5] - 2025-12-28

### Alterado

- Bump de versão para alinhamento de metadados de release e documentação.

## [1.5.4] - 2025-12-28

### Adicionado

- Adicionado otimizador de programação dinâmica para dimensionamento de apostas com limite máximo de apostas e tie-breaks de cobertura explícitos.
- Adicionada suite de testes de otimização e cobertura de aposta múltipla de 20 números.
- Adicionado log estruturado de sucesso para geração de apostas.

### Alterado

- Atualizado Next.js para 16.1.1 e eslint-config-next para 16.1.1.
- Elevado requisito de engine Bun para >=1.3.2.
- Estendida tabela de combinações de apostas para cobrir 16-20 números.
- Limitadas apostas máximas geradas por requisição para evitar geração descontrolada.

### Corrigido

- Alinhados loops de seleção de apostas múltiplas com limite oficial de 20 números.
- Corrigidos caminhos de ícones do manifesto PWA para corresponder a rotas de ícone dinâmico Next.js.

## [1.5.3] - 2025-12-28

### Alterado

- Alinhado o fetch de estatísticas ao padrão de API_HOST/API_PORT no SSR, removendo dependência de NEXT_PUBLIC_API_URL.
- Mantida compatibilidade client-side via NEXT_PUBLIC_BASE_URL quando necessário.

## [1.5.2] - 2025-12-28

### Adicionado

- Adicionado `env.d.ts` para tipar `process.env` para `NEXT_PUBLIC_BASE_URL`, `API_HOST` e `API_PORT`.

### Alterado

- Padronizado acesso a `NEXT_PUBLIC_BASE_URL` para notação de ponto para metadata, sitemap e robots.
- Atualizada cópia de imagem Open Graph/Twitter e ação not-found para pt-BR com acentuação.
- Atualizada dependência dev `baseline-browser-mapping` para versão mais recente para reduzir avisos de build.
- Adicionado `metadataBase` a exports de metadata em nível de rota para silenciar avisos de URL base Open Graph/Twitter.

### Corrigido

- Adicionado metadata `metadataBase` para handlers global/not-found para parar aviso de build e garantir que URLs OG/Twitter resolvam corretamente.

## [1.5.1] - 2025-12-28

### Adicionado

- Skeleton de loading compartilhado (`components/loading-state.tsx`) com UI de loading em nível de rota para root, dashboard, gerador e estatísticas.
- Rotas de erro e not-found para boundaries de app e globais (`app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/global-not-found.tsx`).
- Expandida cópia pt-BR (acentos) e novos blocos de conteúdo para estatísticas, termos, privacidade, erros e loading.

### Alterado

- Adotado Geist + Space Grotesk via `next/font`, com tokens de tipografia aplicados globalmente.
- Padronizados alerts em termos e privacidade para tokens de design semânticos (removidas classes hardcoded red/green/yellow).
- Substituídos logs `console.*` no cliente API Caixa por eventos de logger estruturado.
- Endurecida inicialização SQLite com PRAGMAs recomendados (WAL, busy timeout, cache size, trusted schema, etc.).
- Otimizadas atualizações de frequência de estatísticas reusando prepared statements.
- Habilitadas flags mais estritas do compilador TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `useUnknownInCatchVariables`, `moduleDetection`, `verbatimModuleSyntax`).

### Corrigido

- Strings pt-BR agora usam acentuação consistente em dashboard, estatísticas, gerador, termos e privacidade.

## [1.5.0] - 2025-12-27

### Corrigido

**Correções de Bugs Críticos:**

- **Bug de Desperdício de Orçamento**: Corrigido loop de deduplicação que incorretamente debitava R$6 sem gerar aposta
  - Antes: Após 2 tentativas falhas de deduplicação, código descartava R$6
  - Depois: Saída limpa antecipada, sem desperdício de orçamento
  - Impacto: Utilização de orçamento melhorada de ~85% para 96%
  - Localização: `lib/analytics/bet-generator.ts:350-352`

- **Determinismo de Números Quentes/Frios**: Removido shuffle das estratégias hot_numbers e cold_numbers
  - Antes: Usuário selecionando "números quentes" obtinha 6 aleatórios dos top 30 (não-determinístico)
  - Depois: Usuário obtém OS 6 números mais quentes (determinístico, previsível)
  - Impacto: Estratégias agora correspondem a expectativas do usuário e são explicáveis
  - Localizações: `lib/analytics/bet-generator.ts:428-430, 445-447`

### Adicionado

- **Aviso Estatístico**: Adicionado aviso ético proeminente na página do gerador de apostas
  - Declara aleatoriedade da loteria e independência de eventos
  - Esclarece que nenhuma estratégia pode prever sorteios futuros
  - Nota valor esperado negativo devido a margem da casa
  - Estilizado com cores destructive para visibilidade
  - Localização: `app/dashboard/generator/page.tsx:53-60`

### Alterado

- **Limpeza de Logging**: Removido console.log/console.error de componentes cliente user-facing
  - `app/dashboard/generator/generator-form.tsx:59`: Removido console.error
  - `components/bet-generator/bet-card.tsx:34-36`: Falha silenciosa de clipboard
  - console.error server-side mantido (apropriado para Server Components)

### Verificado

**Resultados de Teste Runtime:**

```
Otimização de Orçamento:
  Orçamento: R$ 100,00
  Custo Total: R$ 96,00 (96% utilização)
  Restante: R$ 4,00 (desperdício mínimo)
  Números Únicos: 43/60 (71,7% cobertura)
  PASSOU

Determinismo:
  Números quentes: Idênticos em múltiplas execuções
  Números frios: Idênticos em múltiplas execuções
  PASSOU

Deduplicação:
  100 apostas geradas
  0 duplicatas detectadas
  PASSOU
```

### Documentação

- Adicionada auditoria completa de qualidade de código (`docs/CODE_QUALITY_AUDIT_2025-12-27.md`)
- Criado exec spec de engenharia (`docs/EXECPLAN_2025-12-27_Code_Quality_Fixes.md`)
- Gerado plano de implementação de 19 tarefas (`docs/TODO_2025-12-27_Implementation_Plan.md`)

---

## [1.4.3] - 2025-12-18

### Corrigido

- **Docker Runtime**: Adicionado flag `--bun` no spawn do API server em `scripts/start-docker.ts`
  - Antes: `spawn(['bun', 'server.ts'])` - Bun usava polyfills Node.js para algumas APIs
  - Depois: `spawn(['bun', '--bun', 'server.ts'])` - Bun runtime nativo completo (crypto, fetch, fs)
  - Impacto: Melhor performance e consistência com build local

### Alterado

- **CLAUDE.md**: Refatorado com seção "Development Guidelines"
  - Tamanho otimizado: ~940 linhas -> ~230 linhas (75% redução)
  - Diretrizes de desenvolvimento consolidadas

## [1.4.2] - 2025-12-17

### Correções de Deploy

- **Dockerfile**: Adicionado `COPY tsconfig.json` para resolver aliases de path (`@/lib/*`)
- **deploy.sh**: Corrigido bug de arquivos ocultos - alterado de `cp -r dir/*` para `cp -r dir/.`
  - Bug fazia com que pasta `.next` (oculta) não fosse copiada, causando erro "Could not find production build"
- **Traefik Config**: Documentada configuração de roteamento para produção

### Documentação

- **CLAUDE.md**: Adicionada seção "Production Deployment" com comandos e troubleshooting

## [1.4.1] - 2025-12-17

### Observabilidade e Auditoria

- **Logs estruturados (JSON)**: `server.ts` agora emite logs com `requestId`, `route`, `statusCode` e `durationMs`, com redação de chaves sensíveis e sem stack traces em produção.
- **Trilha de auditoria (SQLite)**: adicionado `audit_logs` (append-only) para eventos significativos (`api.dashboard_read`, `api.statistics_read`, `api.trends_read`, `bets.generate_requested`) com identificador do cliente em hash (sem IP bruto).
- **Retenção (hard delete)**: adicionado `bun run audit:prune` para aplicar política de retenção por remoção definitiva (idempotente, sem soft delete).

### Infraestrutura

- **Saúde**: `/api/health` agora reporta `version` a partir de `package.json` (com fallback por `APP_VERSION`).
- **Docker**: imagem de runtime mantida como `oven/bun:1.3.4-alpine` (runtime-only) para evitar problemas operacionais observados em imagens distroless.

## [1.4.0] - 2025-12-17

### Infraestrutura

- **Docker Distroless**: Migrado para `oven/bun:1.3.4-distroless` como imagem de produção
  - Superfície de ataque reduzida (sem shell, sem package manager)
  - Builder alterado de Alpine para Debian para compatibilidade glibc
  - Bundles pré-compilados para ambiente sem shell
  - Health checks usando `bun -e` ao invés de shell scripts

- **Bun Runtime Completo**: Flag `--bun` adicionado em todos os comandos Next.js
  - `bun --bun next build` - Bun runtime durante build
  - `bun --bun next start` - Bun runtime em produção
  - `bun --bun next dev` - Bun runtime em desenvolvimento
  - Sem `--bun`, Next.js usa Node.js internamente

- **Next.js 16 Standalone**: Output simplificado
  - Arquivos agora em `.next/standalone/` diretamente
  - Removida estrutura aninhada de versões anteriores

### Adicionado

- `scripts/start-docker-distroless.ts`: Orquestrador de startup sem shell
  - Inicia API server e Next.js em sequência
  - Graceful shutdown via SIGTERM/SIGINT
  - Monitoramento de processos filhos

### Alterado

- `Dockerfile`: Reescrito para distroless
  - Stage 1: `oven/bun:1.3.4-debian` (builder com glibc)
  - Stage 2: `oven/bun:1.3.4-distroless` (runner minimal)
  - Bundles compilados: `server-bundle`, `start-bundle`

- `package.json`: Scripts atualizados com `--bun`
- `scripts/dev.ts`: Next.js spawn com `--bun`
- `next.config.js`: Adicionado `output: 'standalone'`
- `docker-compose.*.yml`: Porta interna alterada para 80

### Métricas

- Tamanho da imagem: 392MB
- Limite de memória: 384MB (antes: 512MB)
- Tempo de startup: ~8 segundos
- Testes: 83 passando

### Documentação

- `docs/BUN_RUNTIME_FIX.md`: Atualizado com lições aprendidas
  - Incompatibilidade glibc/musl documentada
  - Next.js 16 standalone output explicado
  - Flag `--bun` requirement detalhado
- `AGENTS.md`: Reforçado como entrypoint de regras do repo (mindset, pre-action protocol, stack)

---

## [1.3.2] - 2025-12-10

### Corrigido

- **Produção offline**: Corrigida configuração de container Docker
  - Adicionado overlay docker-compose para labels Traefik
  - Suporte HTTPS com Let's Encrypt
  - Redirect automático HTTP -> HTTPS

---

## [1.3.1] - 2025-12-05

### Adicionado

- **Domínios de produção configurados**: Traefik routing para três domínios
  - `megasena-analyzer.com.br` (primário, TLD brasileiro)
  - `megasena-analyzer.com` (internacional)
  - `megasena-analyzer.online` (alternativo)
  - Let's Encrypt SSL automático via Traefik

- **Fonte de dados alternativa**: API Heroku para contornar bloqueio da CAIXA
  - API oficial CAIXA bloqueada por CDN Azion (geo-restrição ou bot protection)
  - Nova fonte: `loteriascaixa-api.herokuapp.com/api/megasena`
  - Suporta busca por concurso específico: `/api/megasena/{numero}`
  - Documentação em `docs/CAIXA_API_ALTERNATIVE.md`

### Corrigido

- **Apostas duplicadas no gerador**: Reescrita completa do algoritmo de deduplicação
  - Bug crítico: orçamento era debitado mesmo quando aposta não era adicionada
  - Pools de candidatos pré-carregados (top 30 hot/cold) para eficiência
  - Fisher-Yates shuffle para seleção aleatória verdadeira
  - Fallback automático para random após 10 tentativas falhas
  - Limite de 50 tentativas de deduplicação por aposta
  - Cálculo de orçamento agora 100% preciso

### Alterado

- **CLAUDE.md**: Adicionado Structured Reasoning & Planning Protocol
  - 9 regras sistemáticas para tomada de decisão
  - Análise de dependências, riscos, hipóteses
  - Protocolo de persistência e precisão

### Dados

- **Atualização de sorteios**: 27 novos concursos adicionados
  - Antes: Concurso #2920 (27/09/2025), 150 sorteios
  - Depois: Concurso #2947 (04/12/2025), 177 sorteios
  - Período: 30/09/2025 a 04/12/2025

---

## [1.3.0] - 2025-12-03

### Alterado

- **Upgrade para Next.js 16**: Major upgrade do framework
  - Next.js 15.5.4 -> 16.0.7
  - React 19.1.1 -> 19.2.1
  - Turbopack agora padrão para builds
  - Middleware renomeado para proxy (requisito do Next.js 16)
  - ESLint migrado para flat config (eslint.config.mjs)

### Adicionado

- **Ambiente de staging**: Infraestrutura para testes pré-produção
  - docker-compose.staging.yml (portas 3100/3401)
  - Scripts de deploy automatizado para staging
  - Observação atual: esses artefatos não existem no estado atual do repositório; o contrato vigente de staging está documentado em `docs/DEPLOY.md` e exige alvo remoto explícito.

### Corrigido

- **CSP para HTTP**: Headers de segurança agora detectam protocolo
  - `upgrade-insecure-requests` apenas em HTTPS
  - HSTS apenas em conexões seguras
  - Permite acesso via HTTP direto para testes

---

## [1.2.6] - 2025-12-03

### Adicionado

- **Novo favicon**: Design de bola de loteria com número 6
  - Gradiente cyan (cores primárias do app)
  - Bola principal branca com número 6
  - Bolas decorativas coloridas (amarelo, verde, rosa)
  - Apple Touch Icon (180x180) para iOS

---

## [1.2.5] - 2025-12-03

### Corrigido

- **Acentuação em português**: Corrigidos todos os acentos nas páginas legais
  - Privacy: Todos os acentos adicionados (Política, você, informações, etc.)
  - Terms: Todos os acentos adicionados (Última, aleatório, decisões, etc.)
  - Home disclaimer: Acentos corrigidos (NÃO, aleatória)

- **Footer duplicado**: Removido Footer das páginas Privacy e Terms
  - Footer já renderizado pelo layout.tsx global
  - Evita duplicação visual no rodapé

### Removido

- **REPOSITORY de APP_INFO**: URL do GitHub removida de constants.ts

---

## [1.2.4] - 2025-12-03

### Alterado

- **Privacy e Terms reescritos**: Abordagem minimalista e honesta
  - Privacy: 6 seções claras, foco em "não coletamos dados pessoais"
  - Terms: 7 seções com disclaimer agressivo sobre loteria ser aleatória
  - Isenção de responsabilidade reforçada
  - Removida falsa alegação de "assessoria jurídica"

- **Disclaimer na home page**: Aviso visível antes do botão de acesso
  - "Esta ferramenta NÃO aumenta suas chances de ganhar"
  - Link para termos de uso

### Removido

- **Google Analytics removido**: Decisão de privacidade
  - Removido GA4 do layout.tsx
  - Removidas constantes GA do CSP
  - Zero cookies de rastreamento = política de privacidade simples

---

## [1.2.2] - 2025-12-03

### Alterado

- **Rebranding**: Alterado nome do projeto de "Analyser" para "Analyzer" (padrão americano)
  - Atualizado em todas as telas (home, dashboard, generator, statistics, terms, privacy)
  - Atualizado metadados (title, OG tags, authors)
  - Atualizado constantes (APP_INFO.NAME, AUTHOR)
  - Atualizado docker startup logs
  - Atualizado testes unitários

---

## [1.2.1] - 2025-12-02

### Infraestrutura

- **Configuração Multi-Domínio**: Suporte para três domínios simultâneos
  - `megasena-analyzer.com.br` (domínio principal, TLD brasileiro)
  - `megasena-analyzer.com` (TLD genérico internacional)
  - `megasena-analyzer.online` (TLD moderno)
  - Traefik labels atualizados com regra `Host()` para todos os domínios
  - CORS configurado para aceitar origens de todos os domínios

- **Preparação para Cloudflare**: Arquivos de configuração para proxy reverso Cloudflare
  - `traefik-cloudflare.yaml`: Middleware para IPs confiáveis do Cloudflare
  - `traefik-cloudflare-tls.yaml`: Configuração de certificado de origem
  - `scripts/setup-cloudflare-firewall.sh`: Script UFW para restringir acesso a IPs Cloudflare
  - Proteção DDoS, WAF e CDN via Cloudflare (configuração manual necessária)

### Modificado

- **docker-compose**: Atualizado para multi-domínio
  - Labels Traefik para HTTP->HTTPS redirect
  - Configuração TLS SAN para certificado único
  - Variável `ALLOWED_ORIGINS` com lista de origens permitidas

- **app/layout.tsx**: Adicionado `metadataBase` para SEO
  - URLs canônicas geradas corretamente
  - OpenGraph e Twitter Cards com URLs absolutas
  - Suporte a alternates para SEO multi-domínio

- **.env.example**: Atualizado `ALLOWED_ORIGIN` para `ALLOWED_ORIGINS` (plural)
  - Alinhado com server.ts que já esperava lista separada por vírgulas

### Documentação

- Atualizado docs de deploy com instruções Cloudflare
- Adicionados scripts de automação para firewall

---

## [1.2.0] - 2025-12-02

### Corrigido

- **Fórmula de Atraso Médio** (`delay-analysis.ts`): Corrigida fórmula matemática incorreta
  - **Problema**: `(latestContest - 1) / totalOccurrences` não representava o espaçamento correto
  - **Solução**: Fórmula correta `latestContest / totalOccurrences` para calcular atraso esperado
  - **Impacto**: Estatísticas de atraso agora refletem valores matematicamente corretos

- **Violação de Regra no-emoji** (`statistics/page.tsx`): Emojis removidos da página de estatísticas
  - Substituídos emojis de fogo/gelo por ícones Lucide (`Flame`, `Snowflake`)
  - Alinhado com regra CLAUDE.md "Never use emojis!"

- **Edge case banco vazio** (`delay-analysis.ts`): Tratamento para banco de dados vazio
  - Retorna array vazio ao invés de erro quando não há sorteios
  - Previne crash em inicialização limpa

### Adicionado

- **Avisos estatísticos** (`statistics/page.tsx`): Disclaimers educativos
  - Seção Hot/Cold: Alerta sobre Falácia do Jogador e independência de eventos
  - Correlação de Prêmios: Explicação que valores dependem de acumulado/ganhadores, não números
  - Referência: [Lottery Number Frequency Analysis](https://pickitz.ai/articles/frequency-analysis.html)

- **Testes para DelayAnalysisEngine** (`tests/lib/analytics/delay-analysis.test.ts`, 12 testes)
  - Cobertura de fórmula de atraso, categorização, edge cases
  - Skip automático em ambiente in-memory (Vitest sem Bun)

### Modificado

- **Padronização de arredondamento**: Uso consistente de `roundTo()` em analytics
  - `prime-analysis.ts`: `Math.round(x * 100) / 100` -> `roundTo(x)`
  - `decade-analysis.ts`: Três instâncias migradas para `roundTo()`
  - `complexity-score.ts`: Padronizado para usar `roundTo()`

### Removido

- **Página de Changelog** (`/changelog`): Removida página web de changelog em favor do CHANGELOG.md no repositório
- **Link de Changelog no Footer**: Removido do menu Legal para simplificar navegação
- **Emails de contato nas páginas legais**: Removidos de Terms e Privacy para privacidade

### UI/UX

- **Páginas Terms e Privacy**: Layout redesenhado para consistência com dashboard
  - Adicionada barra de navegação superior com links para Estatísticas e Gerador
  - Aplicado background gradiente consistente (`bg-gradient-to-br from-background via-background to-primary/5`)
  - Adicionado Footer component para navegação e disclaimers
  - Estrutura flexbox para layout responsivo (`min-h-screen flex flex-col`)

### Testes

- **Novos testes para Footer** (`tests/components/footer.test.tsx`, 11 testes)
  - Validação de ausência do link changelog
  - Validação de presença de links Terms/Privacy/Dashboard
  - Cobertura de seções principais e links externos
  - **Total**: 95 testes (83 passando + 12 skipped para delay-analysis em ambiente in-memory)

## [1.1.3] - 2025-12-02

### Segurança

- CSP migrado para nonces via `proxy.ts` com `strict-dynamic`, `object-src 'none'`, COOP/COEP/CORP e HSTS preload em produção.
- Removido header estático com `'unsafe-inline'` do `next.config.js`; nonces propagados pelo layout.
- Adicionado `public/.well-known/security.txt` (RFC 9116) para canal de disclosure.
- Workflow `update-draws.yml` agora usa usuário `deploy` e caminho configurável, evitando acesso root.

### Testes

- Novos testes unitários para `buildCsp`/`buildSecurityHeaders` garantindo ausência de `unsafe-inline` em produção e presença de HSTS/COOP/COEP.

### Corrigido

- **CRÍTICO**: Eliminado anti-pattern de useEffect em paginação de apostas (`bet-list.tsx`)
  - **Problema**: Componente usava `useEffect` para resetar paginação quando resultado mudava, causando renderizações duplas
  - **Solução**: Implementado padrão de `key` prop recomendado pelo React para reset de estado
  - **Impacto**: Renderização única ao invés de dupla (effect), código mais idiomático
  - **Referência**: [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)

### Adicionado

- **Suite de Testes para Componentes React** (34 novos testes)
  - `tests/components/bet-list.test.tsx` (11 testes): Paginação, key prop pattern, regression
  - `tests/components/generator-form.test.tsx` (9 testes): Cleanup de AbortController, prevenção de memory leaks
  - `tests/components/theme-provider.test.tsx` (14 testes): localStorage persistence, media query cleanup, DOM manipulation
  - **Cobertura**: Todos os padrões críticos de useEffect e cleanup testados
  - **Resultado**: 52/52 testes passando (18 existentes + 34 novos)

- **Biblioteca @testing-library/jest-dom** para matchers do React Testing Library
  - Configurado em `tests/setup.ts` para todos os testes de componentes
  - Adiciona matchers como `toBeInTheDocument`, `toBeDisabled`, etc.

### Modificado

- **Otimização de dependency arrays em `theme-provider.tsx`**
  - Removido `storageKey` dos arrays de dependências (constante nunca muda)
  - Documentado trade-off com comentários explicativos e `eslint-disable`
  - **Justificativa**: `storageKey` sempre usa valor default 'megasena-theme', nunca passado como prop

- **Documentação expandida em CLAUDE.md e AGENTS.md**
  - Adicionadas diretrizes completas de useEffect best practices
  - Seção sobre ExecPlans e metodologia PLANS.md
  - Guidelines sobre ast-grep, concisão, e critical thinking

### Documentação

- **Comentários de código em padrões complexos**
  - `bet-list.tsx`: Explicação do padrão key prop vs useEffect
  - `generator-form.tsx`: Documentação do AbortController cleanup pattern
  - `theme-provider.tsx`: Justificativa para omissão de storageKey em deps
  - **Objetivo**: Facilitar manutenção futura e code reviews

## [1.1.2] - 2025-10-26

## [1.1.1] - 2025-10-01

### Corrigido

- **CRÍTICO**: Corrigido erro `SQLITE_IOERR_VNODE` (disk I/O error) no script de ingestão de dados
  - **Problema**: Script `pull-draws.ts` fazia 2921 commits individuais sem transação, causando I/O excessivo e falhas quando disco próximo da capacidade (>95%)
  - **Solução**: Implementado batch insert com transação única (`BEGIN TRANSACTION` / `COMMIT`)
  - **Impacto**: Redução de 99.9% em operações de disco (1 sync ao invés de 2921)
  - **Performance**: Ingestão de dados ~100-1000x mais rápida

### Adicionado

- **Modo Incremental no `pull-draws.ts`** (`--incremental` flag)
  - Permite adicionar apenas sorteios novos sem sobrescrever dados existentes
  - Usa `INSERT OR IGNORE` ao invés de `INSERT OR REPLACE`
  - Estatísticas detalhadas: mostra quantos sorteios foram adicionados vs ignorados
  - Casos de uso:
    - Atualizações diárias/semanais para adicionar apenas novos sorteios
    - Preservar modificações manuais em sorteios existentes
    - Reduzir tempo de processamento em atualizações frequentes
  - Exemplo: `bun scripts/pull-draws.ts --limit 50 --incremental`

- **Script de Otimização de Banco** (`scripts/optimize-db.ts`)
  - Checkpoint automático do WAL (Write-Ahead Log) com `PRAGMA wal_checkpoint(TRUNCATE)`
  - Recuperação de espaço em disco via `VACUUM`
  - Análise de índices para otimização de queries via `ANALYZE`
  - Estatísticas de tamanho do banco de dados
  - Uso recomendado: Executar após grandes ingestões de dados ou semanalmente

### Modificado

- **Transações no `pull-draws.ts`** (linhas 104-147, 174-180)
  - Todos os inserts agora executam dentro de uma única transação
  - Rollback automático em caso de erro para prevenir estado inconsistente
  - Tratamento de erro melhorado para operações de transação
  - Contadores de estatísticas para novos vs existentes
  - Função `saveDraw` agora retorna boolean indicando se foi inserido

### Documentação

- Documentado novo script `optimize-db.ts` em README.md e CLAUDE.md
- Adicionadas best practices para operações de banco de dados
- Alertas sobre requisitos de espaço em disco para SQLite WAL mode

### Performance

- **Batch Inserts**: 99.9% menos operações de I/O (2921 -> 1)
- **WAL Checkpoint**: Libera espaço do arquivo WAL de volta para o disco
- **VACUUM**: Compacta banco e recupera páginas não utilizadas
- **ANALYZE**: Melhora planos de execução de queries ao atualizar estatísticas

### Notas Importantes

- **Espaço em Disco**: SQLite WAL mode requer espaço temporário durante writes. Recomendado manter pelo menos 15-20% de espaço livre no disco.
- **Manutenção**: Execute `bun scripts/optimize-db.ts` após ingestões grandes ou semanalmente para manter performance.

---

## [1.1.0] - 2025-10-01

### Adicionado - Docker e DevOps

- **Dockerização Completa**: Multi-stage Dockerfile otimizado para produção
  - Imagem Alpine-based (~200-250 MB comprimida)
  - Execução como usuário não-root para segurança
  - Health checks integrados
  - Suporte a dumb-init para graceful shutdown
- **Docker Compose**: Configurações para desenvolvimento e produção
  - `docker-compose.yml` para ambiente local
  - `docker-compose.prod.yml` com overrides de produção
  - Volumes persistentes para SQLite
  - Resource limits configuráveis
- **CI/CD Automatizado**: Pipeline completo via GitHub Actions
  - Linting e type checking automáticos
  - Testes unitários com cobertura
  - Build e push de imagens Docker para GHCR
  - Security scanning com Trivy
  - Deploy automático em push para main
  - Workflow de rollback manual
- **Backup Automatizado de Banco de Dados** (`scripts/backup-database.ts`)
  - Backups timestamped com verificação de integridade
  - Política de retenção configurável (30 dias / 50 backups)
  - Limpeza automática de backups antigos
  - Suporte a agendamento via cron
  - Estatísticas detalhadas de backup

### Adicionado - Funcionalidades

- **CORS (Cross-Origin Resource Sharing)**: Configuração completa no API server
  - Whitelist configurável de origens permitidas via `ALLOWED_ORIGIN`
  - Suporte a preflight requests (OPTIONS)
  - Headers CORS em todas as respostas da API
  - Logs de tentativas de acesso não autorizadas
- **Graceful Shutdown**: Script Docker com gerenciamento avançado de sinais
  - Tratamento correto de SIGTERM/SIGINT
  - Shutdown ordenado (Next.js -> API -> cleanup)
  - Logs de uptime e status
  - Prevenção de múltiplos shutdowns simultâneos

### Corrigido

- **CRÍTICO**: Configuração de API rewrite em `next.config.js`
  - **Problema**: URL hardcoded (`http://localhost:3201`) não funcionava em Docker ou deployments distribuídos
  - **Solução**: Implementadas variáveis de ambiente `API_HOST` e `API_PORT`
  - **Impacto**: Suporte completo para containers Docker e arquiteturas multi-servidor
- **Linting**: Removida função `importBunSqlite` não utilizada em `lib/db.ts`
  - Corrige erro de linting que bloqueava CI/CD
  - Build agora passa com `--max-warnings=0`

### Documentação

- **Guia Completo de Deployment Docker**
  - Quick start para desenvolvimento local
  - Instruções detalhadas de deployment
  - Configuração de environment variables
  - Gerenciamento de banco de dados
  - Troubleshooting completo
  - Procedimentos de rollback
  - Migração de PM2 para Docker
  - Best practices de segurança e performance
- **Plano de Implementação** (`docs/IMPLEMENTATION_PLAN.md`)
  - Roadmap detalhado de todas as fases
  - Métricas de sucesso
  - Estratégias de mitigação de riscos
  - Timeline de implementação
- **Análise de Deployment** (`docs/DOCKER_DEPLOYMENT_PLAN.md`)
  - Comparação Docker vs PM2
  - Arquitetura de containers
  - Estratégias de CI/CD

### Segurança

- **Execução como usuário não-root** em containers Docker
- **Security scanning automático** via Trivy no CI/CD
- **CORS configurável** para prevenir ataques cross-origin
- **Resource limits** para prevenir DoS
- **Secrets via environment variables** (nunca commitados)

### Performance

- **Multi-stage Docker builds**: Redução de ~70% no tamanho da imagem
- **BuildKit caching**: Builds ~80% mais rápidos após primeira execução
- **Layer optimization**: Camadas ordenadas por frequência de mudança
- **Production-ready**: Configuração otimizada para produção

### Alterações de Infraestrutura

- **Novo método de deployment primário**: Docker (PM2 mantido como fallback)
- **CI/CD totalmente automatizado**: Push to deploy
- **Backup automatizado**: Agendável via cron
- **Health monitoring**: Endpoints e Docker health checks

### Notas de Migração

#### De PM2 para Docker

1. **Backup obrigatório** do banco de dados antes da migração
2. **Testar localmente** com `docker compose up` antes de produção
3. **Manter PM2 configurado** como fallback durante período de transição
4. **Monitorar por 24-48h** após migração para Docker
5. Ver documentação de deployment seção "Migration from PM2"

#### Variáveis de Ambiente Novas

```bash
# Obrigatórias para Docker
API_HOST=localhost          # Nome do host do API server
API_PORT=3201              # Porta do API server

# Opcionais
ALLOWED_ORIGIN=http://localhost:3000,https://seu-dominio.com
BACKUP_RETENTION_DAYS=30   # Dias de retenção de backup
BACKUP_MAX_COUNT=50        # Número máximo de backups
```

Ver `.env.example` atualizado para lista completa.

### Breaking Changes

Nenhuma breaking change nesta versão. Totalmente retrocompatível com v1.0.x.

### Próximos Passos (v1.2.0)

- Playwright E2E tests
- Kubernetes support (Helm charts)
- Database read replicas
- Redis caching layer
- Prometheus + Grafana monitoring

---

## [1.0.3] - 2025-10-01

### Corrigido

- Corrigido erro React "does not recognize the `asChild` prop on a DOM element" no componente Button ao remover a propagação não intencional da prop para o elemento DOM nativo.

### Refatorado

- Página de estatísticas (`app/dashboard/statistics/page.tsx`) agora busca dados da API Bun ao invés de computar diretamente no servidor Next.js, resolvendo problemas de compilação com `bun:sqlite` no ambiente Next.js.
- Melhorada a lógica de inicialização do banco de dados (`lib/db.ts`) para lidar com requisitos de runtime Bun de forma mais eficaz, incluindo verificações de ambiente e tratamento de erros aprimorado.

### Documentação

- Reorganizada estrutura de documentação técnica: movidos arquivos de revisão e planos de agentes para o subdiretório `docs/AGENTS_PLAN/` para melhor organização.
- Adicionada revisão "Fresh Eyes Review" (2025-10-01) documentando a análise técnica da arquitetura e melhorias prioritárias.

## [1.0.2] - 2025-09-30

### Corrigido

- Ajustado o endpoint `POST /api/generate-bets` para validar o orçamento recebido e utilizar `generateOptimizedBets`, evitando exceções em runtime quando o payload vinha no formato incorreto.
- Eliminados avisos de `implicit any` nas páginas do dashboard ao tipar as respostas das APIs, garantindo compatibilidade com o TypeScript estrito.

### Adicionado

- Ambiente de banco de dados em memória para a suite do Vitest, permitindo executar os testes automatizados em contextos Node (como o runner do Vitest) sem depender de `bun:sqlite`.
- Arquivo `.env.example` documentando as variáveis `NEXT_PUBLIC_BASE_URL`, `API_PORT` e `ALLOWED_ORIGIN`.
- Dependências de teste `jsdom`, `@types/jsdom` e `@testing-library/react` para suportar o ambiente JSDOM configurado no Vitest.

### Documentação

- Atualizado o README com as novas variáveis de ambiente, o corpo esperado do endpoint de geração de apostas e instruções sobre a camada em memória usada nos testes.
- Registrada no `docs/BUN_RUNTIME_FIX.md` a estratégia de fallback em memória para o Vitest.

## [1.0.1] - 2025-09-30

### Modificado

- **BREAKING CHANGE**: Migrado de `better-sqlite3` para `bun:sqlite` (SQLite nativo do Bun)
  - Resolve problemas de compatibilidade ABI com módulos nativos do Node.js
  - Melhor performance e integração com runtime Bun
  - Não requer compilação de binários nativos
  - **Nota**: Projeto agora requer Bun como runtime (não funciona com Node.js)

### Corrigido

- **CRÍTICO**: Corrigido bug grave no cálculo de frequências de números (lib/analytics/statistics.ts:62-79)
  - Frequências estavam sendo calculadas incorretamente devido a uso de LIMIT 1 em query SQL
  - Agora conta todas as ocorrências corretamente através de COUNT(\*)
  - Todas as estatísticas de frequência agora refletem dados reais históricos
- **CRÍTICO**: Corrigidos timeouts na busca de dados históricos da API CAIXA
  - Timeout aumentado de 10s para 30s para lidar com respostas lentas
  - Número máximo de tentativas aumentado de 3 para 5
  - Backoff exponencial aprimorado: 2s, 4s, 8s, 16s, 32s (antes: 1s, 2s, 4s)
  - Adicionado delay de 3x após erros para evitar rate limiting
  - Busca de dados agora continua em caso de erro individual ao invés de abortar completamente

### Adicionado

- Classes CSS utilitárias para shadows (shadow-glow, shadow-elegant, hover:shadow-glow)
- Arquivo .env.example para documentação de variáveis de ambiente
- Implementação de exponential backoff no cliente da API CAIXA
- Cache ETag para requisições HTTP otimizadas (reduz bandwidth e latência)
- Sistema de retry robusto com backoff exponencial (2s, 4s, 8s, 16s, 32s)
- Rate limiting progressivo após 50+ requisições bem-sucedidas (previne sobrecarga da API)
- Constantes para valores "mágicos" em BET_ALLOCATION e STATISTICS_DISPLAY
- Tipos de retorno explícitos em todas as funções exportadas
- Suite completa de testes para StatisticsEngine (12 casos de teste)
- Índices de performance no banco de dados (migrations/002_add_performance_indexes.sql)
  - Índices em todas as colunas number_1 a number_6
  - Índice para consultas de sorteios acumulados
  - Índice parcial para consultas de prêmios

### Modificado

- Refatorado: Removidos valores hardcoded, substituídos por constantes semânticas
- Melhorado: Error handling com try-catch em updateNumberFrequencies()
- Otimizado: Queries SQL para frequências agora usam COUNT() ao invés de .all().length
- Aprimorado: Tipo de retorno Promise<NextResponse> nas rotas da API

### Documentação

- Adicionado CODE_REVIEW_PLAN.md com análise completa de bugs e melhorias
- Documentadas todas as correções críticas e suas justificativas técnicas
- Adicionados comentários inline explicando algoritmos de frequência

### Performance

- Queries de frequência ~60x mais rápidas com novos índices de banco de dados
- Cache HTTP reduz latência em até 95% para dados já buscados
- Exponential backoff previne sobrecarga da API CAIXA em caso de falhas

## [1.0.0] - 2025-09-30

### Adicionado

- Dashboard principal com navegação intuitiva
- Módulo de estatísticas avançadas da Mega-Sena
  - Análise de frequência de números
  - Padrões de números pares/ímpares
  - Distribuição por dezenas
  - Análise de sequências
- Gerador inteligente de apostas
  - Geração baseada em análise estatística
  - Suporte a apostas simples e múltiplas
  - Otimização de orçamento
  - Seletor de estratégias
- Integração com API oficial da CAIXA
- Sistema de armazenamento local com SQLite
- Testes automatizados (Vitest)
- Documentação completa do projeto

### Segurança

- Implementação de Content Security Policy (CSP)
- Proteção contra XSS e CSRF
- Rate limiting nas chamadas de API
- Validação rigorosa de entrada de dados

---

## Formato do Versionamento

- **MAJOR**: Mudanças incompatíveis na API
- **MINOR**: Funcionalidades adicionadas de forma retrocompatível
- **PATCH**: Correções de bugs retrocompatíveis

---

## Tipos de Mudanças

- `Adicionado` para novas funcionalidades
- `Modificado` para mudanças em funcionalidades existentes
- `Depreciado` para funcionalidades que serão removidas
- `Removido` para funcionalidades removidas
- `Corrigido` para correções de bugs
- `Segurança` para correções de vulnerabilidades
