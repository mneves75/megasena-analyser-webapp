# Setup Guide

## Quick Start

Follow these steps to get the Mega-Sena Analyser running locally:

### 1. Install Dependencies

```bash
bun install
```

### 2. Initialize Database

Run the database migrations to create the SQLite schema:

```bash
bun run db:migrate
```

### 3. Load Initial Data

Pull some initial draw data from the CAIXA API. Start with 50 draws for testing:

```bash
bun run db:pull -- --limit 50
```

For a full historical dataset (this will take several minutes):

```bash
bun run db:pull
```

### 4. Start Development Server

```bash
bun run dev
```

Visit `http://localhost:3000` to see the application.

## Troubleshooting

### Issue: "Module not found: better-sqlite3"

Make sure you've run `bun install`. If using Node.js instead of Bun, you may need to rebuild native modules:

```bash
npm rebuild better-sqlite3
```

### Issue: "Database file not found"

Run the migrations first:

```bash
bun run db:migrate
```

### Issue: "No draws in database"

Pull data from the CAIXA API:

```bash
bun run db:pull -- --limit 10
```

### Issue: API Request Timeout

The CAIXA API can be slow. The client includes retry logic and rate limiting. If you continue to see timeouts, reduce the number of draws being pulled at once.

## Project Structure

```
megasena-analyser-20250930/
├── app/                   # Next.js pages and API routes
├── components/            # React components
├── lib/                   # Core business logic
├── db/                    # SQLite database and migrations
├── scripts/               # CLI utilities
└── tests/                 # Test suites
```

## Development Workflow

1. Make changes to code
2. Run linter: `bun run lint`
3. Run tests: `bun run test`
4. Format code: `bun run format`
5. Commit changes

## Production Build

```bash
bun run build
bun run start
```

## Environment Variables

Copy `.env.example` to `.env.local` and customize if needed:

```bash
cp .env.example .env.local
```

Default values work for local development.

## Database Management

### View Database

Use any SQLite client. For CLI:

```bash
sqlite3 db/mega-sena.db
```

### Reset Database

Delete the database file and re-run migrations:

```bash
rm db/mega-sena.db
bun run db:migrate
bun run db:pull -- --limit 50
```

## Next Steps

- Explore the dashboard at `/dashboard`
- View detailed statistics at `/dashboard/statistics`
- Generate bets at `/dashboard/generator`
- Check the API documentation in `README.md`

