# Mega-Sena Analyser

Análise estatística avançada da Mega-Sena com gerador inteligente de apostas baseado em ciência de dados.

## Features

- **Análise Estatística Completa**: Frequências, padrões e tendências históricas
- **Números Quentes e Frios**: Identificação de números mais e menos sorteados
- **Gerador Inteligente de Apostas**: Múltiplas estratégias (aleatório, balanceado, Fibonacci, etc.)
- **Dashboard Interativo**: Visualização clara e moderna dos dados
- **Banco de Dados Local**: SQLite com dados históricos completos da CAIXA
- **API Integration**: Conexão com a API oficial do Portal de Loterias da CAIXA

## Tech Stack

- **Frontend**: Next.js 15 + React 19
- **Runtime**: Bun ≥1.1
- **Database**: SQLite (better-sqlite3)
- **Styling**: Tailwind CSS + shadcn/ui components
- **TypeScript**: Full type safety
- **Analytics**: Custom statistical engine

## Getting Started

### Prerequisites

- Bun ≥1.1.0 or Node.js ≥20.0.0

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

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint (fails on warnings)
- `bun run lint:fix` - Auto-fix lint issues
- `bun run format` - Format code with Prettier
- `bun run test` - Run tests with Vitest
- `bun run db:migrate` - Run database migrations
- `bun run db:pull` - Pull draw data from CAIXA API

## Database Scripts

### Pull Data Options

```bash
# Pull latest N draws
bun run db:pull -- --limit 100

# Pull specific range
bun run db:pull -- --start 1 --end 500

# Pull all draws (no flags)
bun run db:pull
```

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
│   ├── db.ts             # Database utilities
│   ├── constants.ts      # Shared constants
│   └── utils.ts          # Helper functions
├── db/                    # SQLite database
│   ├── migrations/       # SQL migrations
│   └── mega-sena.db      # Database file (generated)
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
DATABASE_PATH=./db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
```

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
Generate bets based on budget and strategy.

**Request Body:**
```json
{
  "budget": 50,
  "strategy": "balanced",
  "betType": "simple"
}
```

**Response:**
```json
{
  "bets": [
    {
      "numbers": [5, 12, 23, 34, 45, 56],
      "cost": 5.00,
      "strategy": "balanced"
    }
  ],
  "totalCost": 5.00,
  "remainingBudget": 45.00,
  "strategy": "balanced"
}
```

## Contributing

1. Follow Conventional Commits format
2. Run `bun run lint:fix` and `bun run format` before committing
3. Ensure all tests pass with `bun run test`
4. Update documentation for new features
5. **Update CHANGELOG.md** following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format

## License

MIT

## Disclaimer

This application is for educational and statistical analysis purposes only. It does not guarantee winning results. Lottery games are games of chance. Play responsibly.

