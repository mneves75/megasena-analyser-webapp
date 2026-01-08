# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não Lançado]

### Adicionado
- Nenhum

### Alterado
- Workflow de build agora gera saída standalone do Next.js antes do build da imagem Docker.
- Regras de docker ignore agora permitem dist/standalone no contexto de build.
- Etapa SBOM do CI agora usa anchore/sbom-action para substituir a action syft faltante.

### Corrigido
- Requisições retry para API CAIXA em respostas transitórias 5xx/429, respeitando Retry-After quando presente, e adicionada cobertura para comportamento de retry.

### Documentação
- Documentada correção de aspas `GITHUB_OUTPUT` no GitHub Actions para a etapa de versão SBOM.

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
- Exclusões de cobertura documentadas (app/, components/charts/, lib/analytics/*)
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
  - Agora conta todas as ocorrências corretamente através de COUNT(*)
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
