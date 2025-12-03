# Mega-Sena Analyzer

Análise estatística avançada da Mega-Sena com gerador inteligente de apostas baseado em ciência de dados.

## Features

- **Análise Estatística Completa**: Frequências, padrões e tendências históricas
- **Números Quentes e Frios**: Identificação de números mais e menos sorteados
- **Gerador Inteligente de Apostas**: Múltiplas estratégias (aleatório, balanceado, Fibonacci, etc.)
- **Dashboard Interativo**: Visualização clara e moderna dos dados
- **Banco de Dados Local**: SQLite com dados históricos completos da CAIXA
- **API Integration**: Conexão com a API oficial do Portal de Loterias da CAIXA
- **Security Hardened**: CSP com nonces, CORS estrito, rate limiting, validação Zod

## Tech Stack

- **Frontend**: Next.js 15 + React 19
- **Runtime**: Bun ≥1.1 (required)
- **Database**: SQLite (bun:sqlite - native)
- **Styling**: Tailwind CSS + shadcn/ui components
- **TypeScript**: Full type safety
- **Analytics**: Custom statistical engine

## Getting Started

### Prerequisites

- **Bun ≥1.1.0** (required - uses native SQLite)

### Installation

1. Install dependencies:
```bash
bun install
```

2. Run database migrations:
```bash
bun run db:migrate
```

3. Pull initial draw data (optional - pulls latest 100 draws):
```bash
bun run db:pull -- --limit 100
```

Or pull all historical data (may take several minutes):
```bash
bun run db:pull
```

4. Start development server:
```bash
bun run dev
```

Visit `http://localhost:3000` to see the application.

## Available Commands

- `bun run dev` - Start development server (Bun API + Next.js proxy)
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint (fails on warnings)
- `bun run lint:fix` - Auto-fix lint issues
- `bun run format` - Format code with Prettier
- `bun run test` - Run tests with Vitest (usa fallback de banco em memória)
- `bun run db:migrate` - Run database migrations
- `bun run db:pull` - Pull draw data from CAIXA API
- `bun scripts/optimize-db.ts` - Optimize database (checkpoint WAL + VACUUM + ANALYZE)

## Database Scripts

### Pull Data Options

```bash
# Pull latest N draws (replaces existing)
bun run db:pull -- --limit 100

# Pull latest N draws (incremental - only new draws)
bun run db:pull -- --limit 100 --incremental

# Pull specific range
bun run db:pull -- --start 1 --end 500

# Pull all draws (no flags)
bun run db:pull

# Pull all draws incrementally (skip existing)
bun run db:pull -- --incremental
```

**Modes:**
- **Default (Full)**: Uses `INSERT OR REPLACE` - overwrites existing draws with fresh data
- **Incremental** (`--incremental`): Uses `INSERT OR IGNORE` - only adds new draws, skips existing ones

**When to use incremental mode:**
- Daily/weekly updates to add only new draws
- When you want to preserve manual modifications to existing draws
- To reduce API calls and processing time

### Database Optimization

After pulling large amounts of data, optimize the database to reclaim space and improve performance:

```bash
# Optimize database (recommended after large ingestions)
bun scripts/optimize-db.ts
```

This script performs:
- **WAL Checkpoint**: Merges Write-Ahead Log back to main database file
- **VACUUM**: Reclaims unused space and compacts the database
- **ANALYZE**: Updates query optimizer statistics for better performance

**When to run:**
- After initial data pull (`bun run db:pull`)
- After pulling 100+ new draws
- Weekly in production environments (via cron)
- When experiencing performance issues

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   │   ├── page.tsx      # Main dashboard
│   │   ├── statistics/   # Statistics page
│   │   └── generator/    # Bet generator page
│   ├── api/              # API routes
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── *.tsx             # Custom components
├── lib/                   # Core libraries
│   ├── analytics/        # Statistics & bet generation
│   ├── api/              # CAIXA API client
│   ├── security/         # CSP and security headers
│   ├── db.ts             # Database utilities
│   ├── constants.ts      # Shared constants
│   └── utils.ts          # Helper functions
├── db/                    # SQLite database
│   ├── migrations/       # SQL migrations
│   └── mega-sena.db      # Database file (generated)
├── middleware.ts          # Next.js middleware (CSP nonces, security headers)
├── server.ts              # Bun API server
└── scripts/               # CLI scripts
    ├── migrate.ts        # Migration runner
    └── pull-draws.ts     # Data ingestion
```

## Bet Generation Strategies

1. **Aleatório (Random)**: Números completamente aleatórios
2. **Números Quentes (Hot Numbers)**: Baseado nos números mais sorteados
3. **Números Frios (Cold Numbers)**: Baseado nos números menos sorteados
4. **Balanceado (Balanced)**: Mix inteligente de números quentes e frios
5. **Fibonacci**: Baseado na sequência matemática de Fibonacci

## Database Schema

### `draws` Table
Stores complete draw history with:
- Contest number, date, and drawn numbers (1-6)
- Prize information for Sena, Quina, and Quadra
- Accumulation data
- Special draw flags

### `number_frequency` Table
Cached frequency analysis for all numbers (1-60):
- Total occurrences
- Last drawn contest and date

### `user_bets` Table
Optional tracking of generated bets for future analysis.

## Configuration

Copy `.env.example` to `.env.local` and customize:

```bash
# Base URL usada pelas paginas do App Router para fetches server-side
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Porta exposta pelo servidor Bun (`server.ts`)
API_PORT=3201

# CORS: lista de origens permitidas (separadas por virgula)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

> Os testes executados via `bun run test` simulam o banco de dados usando um driver em memória quando a variável `VITEST` está definida, permitindo rodar a suíte sem o `bun:sqlite` real.

## Design System

The application follows a clean, minimal design inspired by Apple/Linear/Mercury with:

- **Typography**: Inter font with tight letter spacing
- **Color Palette**: Neutral base + electric cyan accent
- **Components**: Rounded cards with soft shadows
- **Micro-interactions**: Smooth transitions and hover states
- **Responsive**: Mobile-first approach

All design tokens are defined in `app/globals.css` and `tailwind.config.ts`.

## API Endpoints

### `/api/generate-bets` (POST)
Generate bets based on budget, strategy, and mode.

**Request Body:**
```json
{
  "budget": 100,
  "strategy": "balanced",
  "mode": "optimized"
}
```

**Response:**
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

## Security

This application implements comprehensive security measures following OWASP and 2025 best practices:

### Content Security Policy (CSP)
- **Nonce-based CSP**: Cryptographic nonces generated per-request via Next.js middleware
- **strict-dynamic**: Enables trusted script loading without unsafe-inline
- **Frame protection**: frame-src, frame-ancestors set to 'none'

### Security Headers
| Header | Value |
|--------|-------|
| Content-Security-Policy | Nonce-based with strict-dynamic |
| Cross-Origin-Embedder-Policy | require-corp |
| Cross-Origin-Opener-Policy | same-origin |
| Cross-Origin-Resource-Policy | same-origin |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |

### API Security
- **Input Validation**: Zod schemas on all endpoints
- **Rate Limiting**: 100 requests/minute per IP with LRU cache
- **CORS**: Strict origin validation, no wildcards in production
- **SQL Injection**: Parameterized queries with bun:sqlite

### Infrastructure
- **SSH**: Ed25519 key authentication only
- **Fail2Ban**: 3 attempts/10 min, 1 hour ban
- **Docker**: Multi-stage build with non-root user (UID 1001)
- **Secrets**: Pre-commit hooks with detect-secrets

## Production Deployment

### Domains

The application is configured for multi-domain deployment:

| Domain | Purpose |
|--------|---------|
| `megasena-analyzer.com.br` | Primary (Brazilian TLD) |
| `megasena-analyzer.com` | International |
| `megasena-analyzer.online` | Alternative |

### Deployment Options

**Docker + Coolify (Recommended)**
```bash
# Deploy with Coolify's docker-compose
docker compose -f docker-compose.coolify.yml up -d --build
```

**Docker Standalone**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Cloudflare Integration

For DDoS protection and CDN, Cloudflare proxy is recommended:

1. Add domains to Cloudflare
2. Set SSL mode to "Full (strict)"
3. Configure A records pointing to VPS IP (proxied)
4. Run `scripts/setup-cloudflare-firewall.sh` to restrict VPS access to Cloudflare IPs only

See `docs/DEPLOY_VPS/DEPLOY_DOCKER.md` for detailed instructions.

## Contributing

1. Follow Conventional Commits format
2. Run `bun run lint:fix` and `bun run format` before committing
3. Ensure all tests pass with `bun run test`
4. Update documentation for new features

## License

MIT

## Disclaimer

This application is for educational and statistical analysis purposes only. It does not guarantee winning results. Lottery games are games of chance. Play responsibly.
