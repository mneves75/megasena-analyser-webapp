# Mega-Sena Analyzer

Análise estatística avançada da Mega-Sena com gerador inteligente de apostas baseado em ciência de dados.

## Funcionalidades

- **Análise Estatística Completa**: Frequências, padrões e tendências históricas
- **Números Quentes e Frios**: Identificação de números mais e menos sorteados
- **Gerador Inteligente de Apostas**: Múltiplas estratégias (aleatório, balanceado, Fibonacci, etc.)
- **Dashboard Interativo**: Visualização clara e moderna dos dados
- **Banco de Dados Local**: SQLite com dados históricos completos da CAIXA
- **Integração com API**: Conexão com a API oficial do Portal de Loterias da CAIXA
- **Segurança Reforçada**: CSP com nonces, CORS estrito, rate limiting, validação Zod

## Stack Tecnológica

- **Frontend**: Next.js 16 + React 19
- **Runtime**: Bun >=1.1 (obrigatório)
- **Banco de Dados**: SQLite (bun:sqlite - nativo)
- **Estilização**: Tailwind CSS + componentes shadcn/ui
- **TypeScript**: Tipagem completa
- **Analytics**: Motor estatístico customizado

## Primeiros Passos

### Pré-requisitos

- **Bun >=1.1.0** (obrigatório - utiliza SQLite nativo)

### Instalação

1. Instalar dependências:
```bash
bun install
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

## Comandos Disponíveis

- `bun run dev` - Iniciar servidor de desenvolvimento (API Bun + proxy Next.js)
- `bun run build` - Build para produção
- `bun run start` - Iniciar servidor de produção
- `bun run lint` - Executar ESLint (falha em warnings)
- `bun run lint:fix` - Corrigir problemas de lint automaticamente
- `bun run format` - Formatar código com Prettier
- `bun run test` - Executar testes com Vitest (usa fallback de banco em memória)
- `bun run db:migrate` - Executar migrações do banco de dados
- `bun run db:pull` - Baixar dados de sorteios da API CAIXA
- `bun run audit:prune` - Soft delete de logs de auditoria antigos (retenção)
- `bun run log:prune` - Soft delete de eventos de log antigos (retenção)
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
```

**Modos:**
- **Padrão (Completo)**: Usa `INSERT OR REPLACE` - sobrescreve sorteios existentes com dados atualizados
- **Incremental** (`--incremental`): Usa `INSERT OR IGNORE` - apenas adiciona novos sorteios, pula existentes

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

## Estrutura do Projeto

```
├── app/                    # App Router Next.js
│   ├── dashboard/         # Páginas do dashboard
│   │   ├── page.tsx      # Dashboard principal
│   │   ├── statistics/   # Página de estatísticas
│   │   └── generator/    # Página do gerador de apostas
│   ├── api/              # Rotas de API
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
├── proxy.ts               # Proxy Next.js (nonces CSP, headers de segurança)
├── server.ts              # Servidor API Bun
└── scripts/               # Scripts CLI
    ├── migrate.ts        # Executor de migrações
    └── pull-draws.ts     # Ingestão de dados
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
```

> Os testes executados via `bun run test` simulam o banco de dados usando um driver em memória quando a variável `VITEST` está definida, permitindo rodar a suite sem o `bun:sqlite` real.

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

Esta aplicação implementa medidas de segurança abrangentes seguindo OWASP e melhores práticas de 2025:

### Content Security Policy (CSP)
- **CSP baseado em Nonce**: Nonces criptográficos gerados por requisição via middleware Next.js
- **strict-dynamic**: Permite carregamento de scripts confiados sem unsafe-inline
- **Proteção de Frame**: frame-src, frame-ancestors definidos como 'none'

### Headers de Segurança
| Header | Valor |
|--------|-------|
| Content-Security-Policy | Baseado em nonce com strict-dynamic |
| Cross-Origin-Embedder-Policy | require-corp |
| Cross-Origin-Opener-Policy | same-origin |
| Cross-Origin-Resource-Policy | same-origin |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |

### Segurança da API
- **Validação de Input**: Schemas Zod em todos os endpoints
- **Rate Limiting**: 100 requisições/minuto por IP com cache LRU
- **CORS**: Validação estrita de origem, sem wildcards em produção
- **SQL Injection**: Queries parametrizadas com bun:sqlite

### Infraestrutura
- **Docker**: Build multi-stage com usuário não-root (UID 1001)
- **Secrets**: Pre-commit hooks com detect-secrets

## Deploy em Produção

Build para produção:
```bash
bun run build
```

A aplicação pode ser implantada via Docker. Veja `docker-compose.yml` para configuração.

## Contribuindo

1. Siga o formato Conventional Commits
2. Execute `bun run lint:fix` e `bun run format` antes de commitar
3. Garanta que todos os testes passam com `bun run test`
4. Atualize a documentação para novas funcionalidades

## Licença

Apache 2.0

## Aviso Legal

Esta aplicação é apenas para fins educacionais e de análise estatística. Não garante resultados vencedores. Jogos de loteria são jogos de azar. Jogue com responsabilidade.
