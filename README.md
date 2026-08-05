# Mega-Sena Analyzer

Análise estatística avançada da Mega-Sena com gerador inteligente de apostas baseado em ciência de dados.

## Funcionalidades

- **Análise Estatística Completa**: Frequências, padrões e tendências históricas
- **Referência de Atualização Visível**: A página de estatísticas detalhadas informa claramente o concurso e a data-base exibidos
- **Números Quentes e Frios**: Identificação de números mais e menos sorteados
- **Gerador Inteligente de Apostas**: Múltiplas estratégias (aleatório, balanceado, Fibonacci, etc.)
- **Dashboard Interativo**: Visualização clara e moderna dos dados
- **Banco de Dados Local**: SQLite com dados históricos completos da CAIXA
- **Integração com API**: Conexão com a API oficial do Portal de Loterias da CAIXA
- **Segurança Reforçada**: CSP compatível com App Router/standalone, CORS estrito, rate limiting, validação Zod

## Stack Tecnológica

- **Frontend**: Next.js 16.3.0 + React 19
- **Runtime**: Bun >=1.3.14 (local/CI baseline); imagem Docker de produção usa Bun canary com digest imutável (ver `.bun-canary-revision`)
- **Banco de Dados**: SQLite (bun:sqlite - nativo)
- **Estilização**: Tailwind CSS + componentes shadcn/ui
- **TypeScript**: Tipagem completa
- **Analytics**: Motor estatístico customizado

## Primeiros Passos

### Pré-requisitos

- **Bun >=1.3.14** (runtime obrigatório para o baseline testado com SQLite nativo)
- **pnpm >=11** (gerenciador de dependências; ative com `corepack enable`)

### Instalação

1. Instalar dependências:

```bash
pnpm install
```

2. Executar migrações do banco de dados:

```bash
bun run db:migrate
```

3. Baixar dados de sorteios (opcional - baixa os últimos 100 sorteios):

```bash
bun run db:pull -- --limit 100
```

Ou baixar todo o histórico (pode levar vários minutos):

```bash
bun run db:pull
```

4. Iniciar servidor de desenvolvimento:

```bash
bun run dev
```

Acesse `http://localhost:3000` para ver a aplicação.

Para validar o runtime de produção local:

```bash
bun run build
bun run start
```

O repositório usa `bunfig.toml` com `run.noOrphans = true`, disponível no baseline Bun 1.3.14, para encerrar processos Bun filhos quando o processo pai morre. `bun run build` delega somente a compilação do Next.js ao Node 22+, evitando um crash conhecido do Bun 1.3.14 no Linux; scripts, SQLite, API e runtime de produção continuam no Bun. Os scripts de supervisão também esperam `process.exited` após `SIGTERM` e escalam para `SIGKILL` depois do período de graça; não use `proc.killed` como prova de encerramento.

## Comandos Disponíveis

- `bun run dev` - Iniciar servidor de desenvolvimento (API Bun + proxy Next.js)
- `bun run build` - Build para produção com o bundler padrão do Next.js 16
- `bun run dist:standalone` - Sincronizar `dist/standalone` a partir de `.next/standalone` para deploy self-hosted
- `bun run deploy:verify` - Validar que a produção pública em `/api/health` está saudável e na mesma versão de `package.json`
- `bun run security:csp:edge` - Validar que a borda pública não substitui a CSP nonce-based da aplicação e classificar o dono provável da sobrescrita; quando a CSP é compartilhada por home/API, imprime fingerprint curto, resumo de fontes e ações de remediação públicas; com `ORIGIN_BASE_URL`, compara uma origem direta sem imprimir a URL privada; com token read-only, diferencia zona inacessível de zona acessível sem regra candidata e pode executar Cloudflare Trace com simulação opt-in
- `bun run start` - Iniciar a stack de produção local (API Bun + Next standalone já buildado)
- `bun run lint` - Executar ESLint (falha em warnings)
- `bun run lint:ast` - Executar regras estruturais de supply chain com ast-grep
- `bun run typecheck` - Verificar os tipos TypeScript sem emitir arquivos
- `bun run lint:fix` - Corrigir problemas de lint automaticamente
- `bun run format` - Formatar código com Prettier
- `bun run test` - Executar testes com Vitest (usa fallback de banco em memória)
- `bun run doctor` - Executar o React Doctor instalado pelo lockfile
- `bun run security:secrets` - Escanear a árvore fonte limpa com Gitleaks via Docker
- `bun run security:secrets:history` - Escanear o histórico Git com relatório redigido em `.tmp/` e resumo de alcance por branch/tag
- `bun run db:migrate` - Executar migrações do banco de dados
- `bun run db:pull` - Baixar dados de sorteios da API CAIXA
- `bun run db:backfill-prizes` - Reidratar apenas as colunas de premiação dos sorteios já armazenados
- `bun run audit:prune` - Hard delete de logs de auditoria antigos (retenção)
- `bun run log:prune` - Hard delete de eventos de log antigos (retenção)
- `bun scripts/optimize-db.ts` - Otimizar banco de dados (checkpoint WAL + VACUUM + ANALYZE)

## Scripts de Banco de Dados

### Opções de Download de Dados

```bash
# Baixar últimos N sorteios (substitui existentes)
bun run db:pull -- --limit 100

# Baixar últimos N sorteios (incremental - apenas novos)
bun run db:pull -- --limit 100 --incremental

# Baixar faixa específica
bun run db:pull -- --start 1 --end 500

# Baixar todos os sorteios (sem flags)
bun run db:pull

# Baixar todos incrementalmente (pula existentes)
bun run db:pull -- --incremental

# Aceitar explicitamente lacunas da CAIXA quando uma faixa parcial for aceitável
bun run db:pull -- --incremental --allow-partial
```

### Reidratação de premiação

`db:pull` reescreve todas as colunas de todos os concursos em uma transação única e
longa. Quando faltam apenas os dados de premiação — o caso de um banco carregado antes
do tratamento atual de `listaRateioPremio`/`faixa`, que faz a seção "Prêmios" exibir
`R$ 0,00` — use o backfill dedicado, que altera só as colunas de prêmio, commita em
lotes e é retomável:

```bash
# Somente concursos sem dados de premiação
bun run db:backfill-prizes

# Refazer todos os concursos armazenados
bun run db:backfill-prizes -- --all

# Limitar a quantidade e ajustar o espaçamento entre requisições
bun run db:backfill-prizes -- --limit 100 --delay 500
```

**Modos:**

- **Padrão (Completo)**: Usa UPSERT com `ON CONFLICT ... DO UPDATE` - atualiza sorteios existentes preservando a linha
- **Incremental** (`--incremental`): Usa `ON CONFLICT ... DO NOTHING` - apenas adiciona novos sorteios, pula existentes
- **Parcial explícito** (`--allow-partial`): mantém sorteios baixados mesmo quando alguns concursos falham; sem essa flag, downloads de faixa falham fechados para evitar bases incompletas tratadas como sucesso

**Quando usar modo incremental:**

- Atualizações diárias/semanais para adicionar apenas novos sorteios
- Quando deseja preservar modificações manuais em sorteios existentes
- Para reduzir chamadas de API e tempo de processamento

### Otimização do Banco de Dados

Após baixar grandes quantidades de dados, otimize o banco para recuperar espaço e melhorar performance:

```bash
# Otimizar banco de dados (recomendado após grandes ingestões)
bun scripts/optimize-db.ts
```

Este script executa:

- **WAL Checkpoint**: Mescla Write-Ahead Log de volta ao arquivo principal do banco
- **VACUUM**: Recupera espaço não utilizado e compacta o banco
- **ANALYZE**: Atualiza estatísticas do otimizador de queries para melhor performance

**Quando executar:**

- Após download inicial de dados (`bun run db:pull`)
- Após baixar 100+ novos sorteios
- Semanalmente em ambientes de produção (via cron)
- Quando experimentar problemas de performance

## Build e Empacotamento

O build oficial do projeto usa o fluxo padrão do Next.js 16 com Bun:

```bash
bun run build
```

Para preparar os artefatos usados no deploy self-hosted e no `Dockerfile`, gere `dist/standalone` a partir do output oficial do Next:

```bash
bun run dist:standalone
```

Esse comando copia `.next/standalone` e `.next/static` sem depender de glob de shell, preservando arquivos ocultos como `BUILD_ID` e manifests.
O build exclui bancos SQLite, WAL/SHM, backups e artefatos `.bak` do output tracing do Next.js e falha se `.next/standalone` ainda contiver esses arquivos. O script também remove qualquer diretório `db/` remanescente de `dist/standalone`, mantendo o deploy fail-closed e dependente do volume/runtime reais.

Staging segue o mesmo artefato self-hosted documentado em `docs/DEPLOY.md`, mas exige alvo remoto explícito. Não considere staging publicado quando houver apenas tarball, imagem local ou CI verde; é preciso health check no domínio/base URL de staging real.

## Estrutura do Projeto

```
├── app/                    # App Router Next.js
│   ├── dashboard/         # Páginas do dashboard
│   │   ├── page.tsx      # Dashboard principal
│   │   ├── statistics/   # Página de estatísticas
│   │   └── generator/    # Página do gerador de apostas
│   └── layout.tsx        # Layout raiz
├── components/            # Componentes React
│   ├── ui/               # Componentes shadcn/ui
│   └── *.tsx             # Componentes customizados
├── lib/                   # Bibliotecas principais
│   ├── analytics/        # Estatísticas e geração de apostas
│   ├── api/              # Cliente da API CAIXA
│   ├── security/         # CSP e headers de segurança
│   ├── db.ts             # Utilitários do banco de dados
│   ├── constants.ts      # Constantes compartilhadas
│   └── utils.ts          # Funções auxiliares
├── db/                    # Banco de dados SQLite
│   ├── migrations/       # Migrações SQL
│   └── mega-sena.db      # Arquivo do banco (gerado)
├── docs/SECURITY.md       # Decisões de CSP e manutenção de overrides
├── next.config.js         # Rewrites e output standalone do Next.js
├── proxy.ts               # Proxy Next.js (CSP e headers de segurança)
├── server.ts              # Superfície `/api/*` executada em Bun
└── scripts/               # Scripts CLI
    ├── migrate.ts        # Executor de migrações
    ├── pull-draws.ts     # Ingestão de dados
    └── sync-standalone-dist.ts  # Prepara `dist/standalone` para deploy
```

## Estratégias de Geração de Apostas

1. **Aleatório (Random)**: Números completamente aleatórios
2. **Números Quentes (Hot Numbers)**: Baseado nos números mais sorteados
3. **Números Frios (Cold Numbers)**: Baseado nos números menos sorteados
4. **Balanceado (Balanced)**: Mix inteligente de números quentes e frios
5. **Fibonacci**: Baseado na sequência matemática de Fibonacci

## Schema do Banco de Dados

### Tabela `draws`

Armazena histórico completo de sorteios com:

- Número do concurso, data e números sorteados (1-6)
- Informações de prêmios para Sena, Quina e Quadra
- Dados de acumulação
- Flags de sorteios especiais

### Tabela `number_frequency`

Análise de frequência em cache para todos os números (1-60):

- Total de ocorrências
- Último concurso e data de sorteio

### Tabela `user_bets`

Rastreamento opcional de apostas geradas para análise futura.

## Configuração

Copie `.env.example` para `.env.local` e personalize:

```bash
# URL base usada pelas páginas do App Router para fetches server-side
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Porta exposta pelo servidor Bun (`server.ts`)
API_PORT=3201

# CORS: lista de origens permitidas (separadas por vírgula)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# Confie em headers de proxy apenas quando o peer for loopback ou estiver em TRUSTED_PROXY_IPS
TRUST_PROXY_HEADERS=false
# TRUSTED_PROXY_IPS=172.18.0.10

# Segredo opcional para chamadas server-side internas escaparem do rate limit público.
# Deve ter no mínimo 32 caracteres e nunca ser exposto ao navegador.
# INTERNAL_API_SECRET=

# LGPD: segredo HMAC para pseudonimização de IP (mínimo 32 caracteres).
# Obrigatório em produção (NODE_ENV=production). Gere com: openssl rand -hex 32
IP_HASH_SECRET=

# O E2E injeta um valor público de teste no próprio playwright.config.ts.
# Produção nunca gera esse segredo automaticamente.
```

> Os testes executados via `bun run test` simulam o banco de dados usando um driver em memória quando a variável `VITEST` está definida, permitindo rodar a suite sem o `bun:sqlite` real.

## Privacidade e LGPD

O projeto cumpre a Lei nº 13.709/2018 (LGPD):

- Política de privacidade pública em `/privacy` (fonte: `docs/PRIVACY.md`).
- Página dedicada de direitos do titular em `/privacy/direitos` com modelo de solicitação.
- Documento de governança em `docs/LGPD-COMPLIANCE.md` (RoPA, bases legais, retenção, segurança).
- Plano de resposta a incidente em `docs/INCIDENT-RESPONSE.md` (Art. 48).
- Banner não-bloqueante de transparência sobre `localStorage`.
- Pseudonimização de IP com HMAC-SHA256 e salt rotativo (`lib/security/pseudonymize.ts`).
- Canal de privacidade: `privacidade@megasena-analyzer.com.br`.

## Design System

A aplicação segue um design limpo e minimalista inspirado em Apple/Linear/Mercury com:

- **Tipografia**: Fonte Inter com espaçamento apertado
- **Paleta de Cores**: Base neutra + destaque cyan elétrico
- **Componentes**: Cards arredondados com sombras suaves
- **Micro-interações**: Transições suaves e estados de hover
- **Responsivo**: Abordagem mobile-first

Todos os design tokens estão definidos em `app/globals.css` e `tailwind.config.js`.

## Endpoints da API

### `/api/generate-bets` (POST)

Gera apostas baseadas em orçamento, estratégia e modo.

**Corpo da Requisição:**

```json
{
  "budget": 100,
  "strategy": "balanced",
  "mode": "optimized"
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "bets": [
      {
        "id": "bet_1727711234567_n1m2o3p4q",
        "numbers": [5, 12, 23, 34, 45, 56],
        "cost": 6,
        "type": "simple",
        "numberCount": 6,
        "strategy": "balanced"
      }
    ],
    "totalCost": 6,
    "remainingBudget": 94,
    "budgetUtilization": 6,
    "totalNumbers": 6,
    "strategy": "balanced",
    "mode": "optimized",
    "summary": {
      "simpleBets": 1,
      "multipleBets": 0,
      "averageCost": 6
    }
  }
}
```

## Segurança

Esta aplicação implementa medidas de segurança seguindo OWASP e melhores práticas atuais:

### Content Security Policy (CSP)

- **CSP compatível com App Router/standalone**: política por origem, tipos de recurso e headers restritivos gerados no `proxy.ts`
- **Nonce por request**: scripts de produção usam `nonce` + `strict-dynamic`, sem `unsafe-inline` em `script-src`
- **Estilos com nonce**: produção remove `unsafe-inline` de `style-src`; Google Fonts continua permitido por origem. A exceção estreita `style-src-attr 'unsafe-inline'` é mantida para atributos `style` gerados por bibliotecas de visualização, sem liberar blocos `<style>` inline.
- **Renderização dinâmica**: páginas protegidas por nonce são renderizadas por request, como esperado para CSP nonce-based no Next.js. A alternativa CSP estática/SRI preserva cache estático, mas não é compatível com a hidratação atual do App Router neste projeto.
- **JSON-LD seguro**: dados estruturados recebem nonce e escapam `<` antes da injeção no `<script>`
- **Proteção de Frame**: frame-src, frame-ancestors definidos como 'none'

### Headers de Segurança

| Header                       | Valor                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Content-Security-Policy      | Restritivo por origem e tipos de recurso                                      |
| Cross-Origin-Embedder-Policy | require-corp                                                                  |
| Cross-Origin-Opener-Policy   | same-origin                                                                   |
| Cross-Origin-Resource-Policy | same-origin                                                                   |
| Strict-Transport-Security    | Aplicado pela API Bun em HTTPS confiável e pelo reverse proxy nas páginas TLS |
| X-Content-Type-Options       | nosniff                                                                       |
| X-Frame-Options              | DENY                                                                          |

### Segurança da API

- **Validação de Input**: Schemas Zod em todos os endpoints
- **Rate Limiting**: 100 requisições/minuto por identificador de cliente derivado do IP em toda a superfície `/api/*`, incluindo `/api/health` e preflights CORS
- **Métodos HTTP restritos**: endpoints públicos rejeitam métodos não suportados com `405` e header `Allow`
- **JSON estrito em POST**: endpoints JSON rejeitam `Content-Type` ausente ou não JSON com `415`, evitando requisições simples cross-site sem preflight em operações de custo computacional
- **Headers defensivos próprios**: a superfície `/api/*` em Bun também aplica CSP deny-by-default para JSON, `nosniff`, `DENY` em frame e `no-referrer`
- **CORS mínimo**: validação estrita de origem, sem wildcards em produção, preflight limitado a `Content-Type` e sujeito ao mesmo rate limit da API
- **Proxy trust restrito**: headers `CF-Connecting-IP`/`X-Real-IP`/`X-Forwarded-For` só influenciam IP, auditoria ou rate limit quando `TRUST_PROXY_HEADERS=true`, o peer de socket é loopback ou está em `TRUSTED_PROXY_IPS`, o valor recebido é válido e o proxy sobrescreve headers de IP vindos do cliente; `proxy.ts` não emite HSTS nem `upgrade-insecure-requests`, então HSTS de TLS terminado deve ser aplicado no reverse proxy
- **Rate limit interno**: chamadas server-side podem usar `INTERNAL_API_SECRET` para evitar consumir a cota pública, mas o bypass exige peer loopback e segredo forte compartilhado; um cliente público não deve conseguir ativá-lo apenas enviando headers.
- **SQL Injection**: Queries parametrizadas com bun:sqlite
- **Limite real de payload**: POST JSON é rejeitado acima do teto configurado mesmo sem `Content-Length`

### Infraestrutura

- **Docker**: Imagem runtime-only executada com usuário não-root `bun` (UID/GID 1000)
- **Publicação por digest**: o CI escaneia com Trivy o mesmo digest canônico construído e só aplica tags após o gate `HIGH`/`CRITICAL` passar
- **Shutdown supervisionado**: scripts Bun de produção aguardam saída real dos filhos e fazem fallback para `SIGKILL` quando `SIGTERM` não encerra dentro do prazo
- **Segredos**: arquivos de ambiente fora do VCS; Gitleaks fixado por digest imutável escaneia a árvore atual no CI e o histórico sob demanda

### Telemetria Operacional

- **Logs estruturados**: request ID, rota, status e contexto técnico mínimo
- **Identificador pseudônimo de cliente**: hash derivado do IP para rate limit/auditoria
- **User-Agent sanitizado**: armazenado com limite de tamanho para investigação operacional
- **Redação recursiva**: metadados de logs e auditoria redigem chaves sensíveis aninhadas e limitam profundidade, arrays e tamanho de strings

## Deploy em Produção

Build para produção:

```bash
bun run build
```

A aplicação pode ser implantada via Docker. Veja `docker-compose.yml` para configuração.

O `docker-compose.yml` local publica as portas apenas em `127.0.0.1`. Em produção, exponha somente o proxy reverso público e mantenha a porta da API Bun restrita à rede interna do Docker/proxy.

## Contribuindo

1. Siga o formato Conventional Commits
2. Execute `bun run lint:fix` e `bun run format` antes de commitar
3. Garanta que todos os testes passam com `bun run test -- --run`
4. Atualize a documentação para novas funcionalidades

Antes de publicar uma release, execute `bun run lint`, `bun run lint:ast`, `bun run typecheck`, `bun run test -- --run`, `pnpm audit --prod` e `bun run build`; acrescente `bun run test:e2e` quando houver mudança de UI. Depois do deploy, execute `bun run deploy:verify`; produção com versão antiga em `/api/health` deve ser tratada como release não concluída. Depois de mudanças em Cloudflare/Traefik, execute também `bun run security:csp:edge`; a borda não deve trocar a CSP nonce-based por uma política com `unsafe-inline` em `script-src` ou `style-src`. A aplicação permite apenas a exceção estreita `style-src-attr 'unsafe-inline'` para atributos de estilo. Quando a mesma CSP ampla aparecer na home e em `/api/health`, o verificador deve apontar `shared_response_headers` como diagnóstico provável; investigue primeiro regras globais de response headers ou middleware do proxy. Se o lookup Cloudflare disser que a zona está inacessível ao token, não conclua que a zona não tem regras candidatas.

## Licença

Apache 2.0

## Aviso Legal

Esta aplicação é apenas para fins educacionais e de análise estatística. Não garante resultados vencedores. Jogos de loteria são jogos de azar. Jogue com responsabilidade.
