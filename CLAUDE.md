# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mega-Sena Analyzer** is a Next.js-based lottery analysis application focused on Brazil's Mega-Sena lottery. The system fetches historical draw data from the official CAIXA API, stores it in a local SQLite database, performs statistical analysis, and generates betting strategies based on various heuristics.

### Core Requirements

- Expert-level data analysis and statistics capabilities
- No speculation or "hallucination" - all claims must be verifiable
- Explicit acknowledgment that lottery prediction is statistically impossible
- Focus on historical analysis, pattern detection, and budget-constrained betting strategies
- Clean, minimal, Apple/Linear-level UI polish

## Core Development Guidelines

**FOLLOW THESE GUIDELINES ALWAYS!**

**Knowledge Base:** Treat `DOCS/GUIDELINES-REF/` as the canonical knowledge base. Consult it first for direction. Key references:
- **`DOCS/GUIDELINES-REF/CLAUDE.md`** - Universal guide for effective CLAUDE.md files and AI-assisted development
- **`DOCS/GUIDELINES-REF/SECURITY-GUIDELINES.md`** - Zero Trust, input validation, CSP, CORS, authentication
- **`DOCS/GUIDELINES-REF/DEV-GUIDELINES.md`** - Core development standards, TypeScript patterns, testing
- **`DOCS/GUIDELINES-REF/DB-GUIDELINES.md`** - Database best practices, soft deletes, parameterized queries
- **`DOCS/GUIDELINES-REF/WEB-NEXTJS-GUIDELINES.md`** - Next.js 15, React 19, Server Components, Server Actions

**Project-Specific Rules:**
- **Never create markdown files after you are done. NEVER!** Use `agent_planning/` for planning docs only, archive when done in `agent_planning/archive/`. Do NOT externalize or document your work, usage guidelines, or benchmarks in markdown files after completing the task, unless explicitly instructed to do so.
- **Never use emojis!** No emojis in code, commit messages, or any output.
- **Think critically and push reasoning to 100% of capacity.** I'm trying to stay a critical and sharp analytical thinker. Walk me through your thought process step by step. The best people in the domain will verify what you do. Think hard! Be a critical thinker!
- **Use `ast-grep` for syntax-aware searches.** This environment has `ast-grep` available. Whenever a search requires syntax-aware or structural matching, default to `ast-grep --lang <language> -p '<pattern>'` (set `--lang` appropriately: typescript, javascript, python, etc.) and avoid falling back to text-only tools like `rg` or `grep` unless explicitly requested for plain-text search.
- **Sacrifice grammar for the sake of concision.** Be brief and direct.
- **List any unresolved questions at the end of your response, if any exist.**
- **ALWAYS work through lists / todo / plans items and not stop until all the work is done and you are 100% certain that it works!**
- **WE NEVER WANT WORKAROUNDS**: Always full implementations that are long-term sustainable. No half-baked solutions.

### Structured Reasoning & Planning Protocol

**You are a strong reasoner and planner.** Before taking any action (tool calls OR responses to users), proactively, methodically, and independently reason through:

#### 1. Logical Dependencies & Constraints

Analyze intended actions against these factors. Resolve conflicts in order of importance:

1. **Policy-based rules**: Mandatory prerequisites and constraints
2. **Order of operations**: Ensure actions don't prevent subsequent necessary actions
   - Users may request actions in random order - reorder operations to maximize success
3. **Other prerequisites**: Information and/or actions needed
4. **Explicit user constraints or preferences**

#### 2. Risk Assessment

What are the consequences of taking the action? Will the new state cause future issues?

- For exploratory tasks (like searches), missing *optional* parameters is **LOW risk**
- **Prefer calling tools with available information over asking users**, unless your Dependencies reasoning (Rule 1) determines optional info is required for a later step

#### 3. Abductive Reasoning & Hypothesis Exploration

At each step, identify the most logical and likely reason for any problem:

- Look beyond immediate or obvious causes - the most likely reason may require deeper inference
- Hypotheses may require additional research; each may take multiple steps to test
- Prioritize hypotheses by likelihood, but don't discard less likely ones prematurely - low-probability events may still be the root cause

#### 4. Outcome Evaluation & Adaptability

Does the previous observation require changes to your plan?

- If initial hypotheses are disproven, actively generate new ones based on gathered information

#### 5. Information Availability

Incorporate all applicable and alternative sources:

- Available tools and their capabilities
- All policies, rules, checklists, and constraints
- Previous observations and conversation history
- Information only available by asking the user

#### 6. Precision & Grounding

Ensure reasoning is extremely precise and relevant to each exact ongoing situation:

- Verify claims by quoting exact applicable information (including policies) when referring to them

#### 7. Completeness

Ensure all requirements, constraints, options, and preferences are exhaustively incorporated:

- Resolve conflicts using the order of importance in Rule 1
- **Avoid premature conclusions**: There may be multiple relevant options
  - To check option relevance, reason about all information sources from Rule 5
  - You may need to consult the user to know whether something is applicable - don't assume without checking
- Review applicable sources from Rule 5 to confirm which are relevant to the current state

#### 8. Persistence & Patience

Do not give up unless all reasoning above is exhausted:

- Don't be dissuaded by time taken or user frustration
- **This persistence must be intelligent**:
  - On *transient* errors (e.g., "please try again"): **MUST retry** unless an explicit retry limit has been reached
  - If such a limit is hit, **MUST stop**
  - On *other* errors: Change strategy or arguments - don't repeat failed calls

#### 9. Inhibit Response

**Only take action after all the above reasoning is completed.** Once you've acted, you cannot take it back.

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript (strict mode)
- **Runtime:** Bun (≥1.1) **[REQUIRED - Not compatible with Node.js]**
- **Database:** SQLite (bun:sqlite - native, zero compilation)
- **Styling:** TailwindCSS v4 with semantic design tokens
- **UI Components:** shadcn/ui (heavily customized)
- **Animations:** Framer Motion for micro-interactions
- **Package Manager:** Bun (npm/yarn/pnpm not supported)
- **Testing:** Vitest (unit) + Playwright (E2E)

**⚠️ CRITICAL:** This project uses Bun's native SQLite (`bun:sqlite`) and **will not work with Node.js**. All commands must use `bun`, not `node` or `npm`.

## Essential Commands

**⚠️ All commands MUST use `bun` (not `node`, `npm`, `yarn`, or `pnpm`)**

```bash
# Environment setup
bun install                     # Install dependencies with Bun
bun --version                   # Verify Bun runtime (>=1.1)

# Database (uses bun:sqlite - native)
bun scripts/migrate.ts          # Apply SQLite migrations
bun run db:migrate              # Same as above (via package.json script)
bun scripts/pull-draws.ts       # Pull all historical draws (INSERT OR REPLACE)
bun scripts/pull-draws.ts --incremental  # Pull only new draws (INSERT OR IGNORE)
bun scripts/optimize-db.ts      # Optimize database (WAL checkpoint + VACUUM + ANALYZE)

# Development
bun run dev                     # Start Next.js dev server (localhost:3000)
bun run lint                    # Run ESLint with --max-warnings=0
bun run lint --fix              # Auto-fix linting issues
bun run format                  # Run Prettier

# Testing
bun run test                    # Run Vitest in watch mode
bun run test -- --run           # Run tests once (CI mode)
bunx vitest --coverage          # Generate coverage report (≥80% required)

# Production
bun run build                   # Create production bundle + type check
```

## Production Deployment

**Target:** Hostinger VPS with Coolify/Traefik
**Domains:** megasena-analyzer.com.br, .com, .online
**SSH:** `ssh -i ~/.ssh/id_vps_hostinger_1 root@srv849078.hstgr.cloud`

### Quick Deploy

```bash
./deploy.sh                    # Full build + deploy
./deploy.sh --skip-build       # Reuse existing build
./deploy.sh --image-only       # Build image only
```

### Manual Deploy Steps (if deploy.sh fails)

```bash
# 1. Build Next.js locally (avoids QEMU/AVX issues)
bun --bun next build

# 2. Copy standalone output (CRITICAL: use '.' to include hidden .next folder)
rm -rf dist/standalone
mkdir -p dist/standalone
cp -r .next/standalone/. dist/standalone/
mkdir -p dist/standalone/.next/static
cp -r .next/static/. dist/standalone/.next/static/

# 3. Build Docker image with correct platform
docker build --no-cache --platform linux/amd64 -t megasena-analyzer:latest .

# 4. Save and transfer
docker save megasena-analyzer:latest | gzip > megasena-analyzer.tar.gz
scp -i ~/.ssh/id_vps_hostinger_1 megasena-analyzer.tar.gz root@srv849078.hstgr.cloud:/tmp/

# 5. Deploy on VPS
ssh -i ~/.ssh/id_vps_hostinger_1 root@srv849078.hstgr.cloud << 'EOF'
docker stop megasena-analyzer; docker rm megasena-analyzer
docker load < /tmp/megasena-analyzer.tar.gz
rm -f /tmp/megasena-analyzer.tar.gz
cd /home/claude/apps/megasena-analyser
docker compose -f docker-compose.coolify.yml up -d
EOF
```

### Common Deployment Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find package 'zod'` | node_modules not copied to image | Rebuild with `--no-cache` |
| `Cannot find module '@/lib/db'` | tsconfig.json missing in container | Ensure `COPY tsconfig.json` in Dockerfile |
| `Could not find production build in .next` | Hidden `.next` folder not copied | Use `cp -r dir/.` instead of `cp -r dir/*` |
| 502 Bad Gateway (container healthy) | Traefik routing to wrong host/port | Check `/data/coolify/proxy/dynamic/megasena-analyzer.yaml` |

### Traefik Configuration

Coolify manages Traefik config at: `/data/coolify/proxy/dynamic/megasena-analyzer.yaml`

**CRITICAL:** This file overrides Docker labels. If routing fails, verify:
```yaml
services:
  megasena-app:
    loadBalancer:
      servers:
        - url: 'http://megasena-analyzer:80'  # Must match container name and port
```

After editing: `docker restart coolify-proxy`

### Verification Commands (on VPS)

```bash
# Container status
docker ps --filter name=megasena-analyzer

# Health check
docker inspect megasena-analyzer --format='{{.State.Health.Status}}'

# Network (must be on 'coolify' network)
docker network inspect coolify | grep megasena

# Direct container test
docker exec megasena-analyzer curl -s http://localhost:80 | head -5

# Traefik logs
docker logs coolify-proxy --tail 20 2>&1 | grep megasena
```

## Architecture

### Directory Structure

- **`app/`** - Next.js App Router routes
  - Start with `app/dashboard/page.tsx` for main analytics dashboard
- **`components/`** - Reusable UI components
  - Use TailwindCSS semantic tokens exclusively
  - Heavily customize shadcn/ui components with variants
- **`lib/`** - Business logic and utilities
  - `lib/analytics/` - Mega-Sena statistical analysis
  - `lib/api/` - CAIXA API integration and data fetching
  - `lib/constants.ts` - Centralized configuration (no magic numbers)
- **`db/`** - Database layer
  - `db/migrations/` - SQL migrations (versioned)
  - `db/mega-sena.db` - SQLite database file
- **`scripts/`** - Bun CLI utilities
  - `scripts/pull-draws.ts` - Ingest historical draw data from CAIXA API
- **`tests/`** - Test suites mirroring source structure
  - `tests/lib/**/*.test.ts` - Vitest unit tests
  - `tests/app/**/*.spec.ts` - Playwright E2E tests
  - `tests/mocks/` - MSW handlers for HTTP mocking
- **`docs/`** - Product specifications and prompts
  - Update when scope changes

### Data Source

**Official API:** `https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`

- Implement exponential backoff and ETag/If-Modified-Since caching
- Never fabricate data if API fails - log errors explicitly
- Parametrize all pricing/rules (do not hardcode values)

### Database Best Practices

**SQLite WAL Mode Considerations:**

1. **Transaction Batching** (CRITICAL)
   - ALWAYS use transactions for batch inserts/updates
   - Pattern: `db.run('BEGIN TRANSACTION')` → operations → `db.run('COMMIT')`
   - Rollback on error: `db.run('ROLLBACK')` in catch block
   - Performance: 100-1000x faster than individual commits

2. **Disk Space Requirements**
   - SQLite WAL mode requires temporary space during writes
   - **Minimum**: Keep 15-20% disk space free
   - Symptoms of low space: `SQLITE_IOERR_VNODE` errors
   - Monitor disk usage before large ingestions

3. **Database Maintenance**
   - Run `bun scripts/optimize-db.ts` after large data ingestions
   - Schedule weekly optimization via cron for production
   - Operations performed:
     - `PRAGMA wal_checkpoint(TRUNCATE)` - Merges WAL to main DB
     - `VACUUM` - Reclaims unused space
     - `ANALYZE` - Updates query optimizer statistics

4. **Error Handling**
   - Always wrap database operations in try-catch
   - Implement automatic rollback on transaction failures
   - Log full error details for debugging I/O issues
   - Check disk space before attempting large writes

**Example Transaction Pattern:**
```typescript
try {
  db.run('BEGIN TRANSACTION');

  for (const item of largeDataset) {
    // ... insert operations
  }

  db.run('COMMIT');
} catch (error) {
  try {
    db.run('ROLLBACK');
  } catch (rollbackError) {
    // Ignore - transaction may not have started
  }
  throw error;
}
```

## Code Style & Standards

### TypeScript

- Strict mode enabled
- Explicit return types on all exported functions
- Two-space indentation
- `PascalCase` for React components
- `camelCase` for utilities and variables
- `kebab-case` for file names (e.g., `budget-panel.tsx`)

## React Server Components (RSC) Architecture

### Core Philosophy: "Two Worlds, Two Doors"

**CRITICAL:** This project uses React Server Components (RSC). Understanding the client/server boundary is essential.

The application is a **single program** that spans two environments (server and client). The `'use client'` and `'use server'` directives are not just labels—they open **doors** that create typed bridges across the network.

### The Two Directives

#### 1. `'use client'` — Typed `<script>` Tag

Opens a door **FROM server TO client**. When the server renders a page, it creates a "client reference" that tells the browser:
- Which script to load
- Which component to render
- What props to pass (must be serializable)

**Use ONLY when you need:**
- Event handlers: `onClick`, `onChange`, `onSubmit`
- React hooks: `useState`, `useEffect`, `useReducer`, `useContext`
- Browser APIs: `window`, `document`, `localStorage`, `navigator`
- Class components (all are client-side)

**Placement:** Must be the **first line** of the file, before all imports.

**Example:**
```tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

#### 2. `'use server'` — Typed `fetch()` Call

Opens a door **FROM client TO server**. Creates Server Actions—functions that:
- Execute on the server with full access to databases, secrets, filesystem
- Can be imported and called from client components like local functions
- Automatically handle serialization, HTTP transport, and error boundaries

**Use for:**
- Database mutations (create, update, delete)
- Form submissions and validation
- Accessing environment variables or secure APIs
- Any operation requiring server-side execution

**Placement:** Must be the **first line** of the file, before all imports.

**Example:**
```tsx
'use server';

import { db } from '@/lib/db';

export async function createBet(budget: number, strategy: string) {
  const result = await db.insert({ budget, strategy });
  return result;
}
```

**Client usage:**
```tsx
'use client';

import { createBet } from './actions'; // Direct import, fully typed

export function BetForm() {
  async function handleSubmit() {
    const result = await createBet(100, 'balanced'); // Looks local, runs on server
    console.log(result);
  }
  
  return <button onClick={handleSubmit}>Create Bet</button>;
}
```

### Architecture Guidelines

#### 1. Default to Server Components

**RULE:** Every component is a Server Component unless explicitly marked with `'use client'`.

**Benefits:**
- Smaller client bundle (less JavaScript shipped to browser)
- Direct database access without API routes
- Better SEO and initial page load
- Automatic code splitting

#### 2. Minimize Client Components

Only add `'use client'` at the **leaves** of your component tree—the lowest level where interactivity is needed.

**❌ Bad (entire page is client-side):**
```tsx
'use client'; // DON'T DO THIS

export default function Page() {
  const [data, setData] = useState(null);
  
  return (
    <div>
      <Nav />
      <InteractiveForm onSubmit={() => setData(...)} />
      <Footer />
    </div>
  );
}
```

**✅ Good (only interactive part is client):**
```tsx
// page.tsx - Server Component (no directive)
export default function Page() {
  return (
    <div>
      <Nav /> {/* Server Component */}
      <InteractiveForm /> {/* Client Component */}
      <Footer /> {/* Server Component */}
    </div>
  );
}

// interactive-form.tsx
'use client';

export function InteractiveForm() {
  const [data, setData] = useState(null);
  return <form onSubmit={() => setData(...)} />;
}
```

#### 3. Avoid Manual API Routes

**❌ Old Pattern (don't use):**
```tsx
// app/api/bets/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  // ... database logic
}

// component
const response = await fetch('/api/bets', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

**✅ New Pattern (use Server Actions):**
```tsx
// actions.ts
'use server';

export async function createBet(data: BetData) {
  // ... database logic
}

// component
'use client';
import { createBet } from './actions';

await createBet(data); // Fully typed, no manual fetch
```

#### 4. Serialization Rules

**Data crossing the client/server boundary must be serializable:**

✅ **Allowed:**
- Plain objects and arrays
- Strings, numbers, booleans, null
- Server Actions (special case)

❌ **Not allowed:**
- Functions (except Server Actions)
- Date objects (convert to ISO strings)
- Maps, Sets, WeakMaps
- Class instances
- Symbols, undefined

### React useEffect Guidelines

**Before using `useEffect`, read:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

Most `useEffect` usages can be eliminated by restructuring your code.

#### ❌ DON'T use useEffect for:

1. **Transforming data for rendering:**
```tsx
// ❌ Bad
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// ✅ Good - calculate during render
const fullName = firstName + ' ' + lastName;
```

2. **Handling user events:**
```tsx
// ❌ Bad
useEffect(() => {
  if (buttonClicked) {
    submitForm();
  }
}, [buttonClicked]);

// ✅ Good - use event handler
<button onClick={() => submitForm()}>Submit</button>
```

3. **Resetting state when props change:**
```tsx
// ❌ Bad
useEffect(() => {
  setItems([]);
}, [category]);

// ✅ Good - use key prop
<List key={category} />
```

4. **Notifying parent components:**
```tsx
// ❌ Bad
useEffect(() => {
  if (data) {
    onDataChange(data);
  }
}, [data, onDataChange]);

// ✅ Good - call during event or lift state up
function handleChange(newData) {
  setData(newData);
  onDataChange(newData);
}
```

5. **Subscribing to external stores:**
```tsx
// ❌ Bad - race conditions and memory leaks
const [data, setData] = useState(null);
useEffect(() => {
  const unsub = store.subscribe(() => setData(store.getData()));
  return unsub;
}, []);

// ✅ Good - use useSyncExternalStore
const data = useSyncExternalStore(
  store.subscribe,
  store.getData
);
```

6. **Fetching data:**
```tsx
// ❌ Bad - race conditions, no caching, no error handling
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// ✅ Good - use Server Components or React Query/SWR
// Server Component (Next.js 15):
async function Page() {
  const data = await fetchData(); // Runs on server
  return <UI data={data} />;
}

// Or use React Query for client-side:
const { data } = useQuery(['key'], fetchData);
```

#### ✅ DO use useEffect for:

1. **Synchronizing with external systems:**
```tsx
useEffect(() => {
  const socket = connectToWebSocket();
  return () => socket.disconnect();
}, []);
```

2. **Browser APIs and third-party libraries:**
```tsx
useEffect(() => {
  const chart = new Chart(canvasRef.current);
  return () => chart.destroy();
}, [data]);
```

3. **Operations requiring cleanup:**
```tsx
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

#### Effect Cleanup Checklist

**Always return cleanup for:**
- Event listeners: `removeEventListener`, `unsubscribe`
- Timers: `clearTimeout`, `clearInterval`
- Connections: WebSocket disconnect, abort controllers
- Third-party libraries: chart destroy, player cleanup

**Pattern for async operations:**
```tsx
useEffect(() => {
  let mounted = true;

  async function load() {
    const data = await fetch('/api/data');
    if (mounted) {
      setData(data); // Only update if still mounted
    }
  }

  load();
  return () => { mounted = false; }; // Cleanup
}, []);
```

#### Dependency Array Rules

1. **Never omit dependencies** - always include all values from component scope used inside effect
2. **Empty array `[]`** - only if effect truly runs once (no dependencies)
3. **Extract static values** - move functions/objects outside component if they don't use props/state
4. **Use `useCallback`/`useMemo`** - for functions/objects that must be dependencies

**Example from codebase (correct pattern):**
```tsx
// From components/ui/glass-card.tsx
useEffect(() => {
  let mounted = true;

  async function checkReduceMotion() {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mounted) {
        setReduceMotion(mediaQuery.matches);
      }
    }
  }

  checkReduceMotion();
  return () => { mounted = false; };
}, []);
```

This demonstrates legitimate useEffect usage:
- Synchronizes with OS accessibility API (external system)
- Proper cleanup with mounted flag
- Empty dependency array justified (runs once to check system preference)

### File Structure Example

```
app/
  dashboard/
    generator/
      page.tsx              ← Server Component (default, no directive)
      actions.ts            ← 'use server' (Server Actions)
      generator-form.tsx    ← 'use client' (interactive UI)
      
components/
  lottery-ball.tsx          ← Can be Server Component if no interactivity
  budget-selector.tsx       ← 'use client' if uses useState/onChange
  
lib/
  analytics/
    bet-generator.ts        ← Pure TypeScript (no React, runs on server)
```

### Migration Checklist

When converting existing components to RSC:

1. ✅ **Identify interactivity needs** - Does it use state/effects/events?
2. ✅ **Create Server Action file** - Move API calls to `actions.ts` with `'use server'`
3. ✅ **Extract client logic** - Create separate file with `'use client'` for interactive parts
4. ✅ **Update imports** - Import Server Actions directly, not via `fetch`
5. ✅ **Verify props** - Ensure all props are serializable
6. ✅ **Test** - Confirm functionality and check bundle size reduction

### Common Patterns

#### Pattern 1: Form with Server Action
```tsx
// actions.ts
'use server';
export async function submitForm(data: FormData) {
  const budget = Number(data.get('budget'));
  // ... save to database
  return { success: true };
}

// form.tsx
'use client';
import { submitForm } from './actions';

export function Form() {
  return (
    <form action={submitForm}>
      <input name="budget" type="number" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### Pattern 2: Data Fetching on Server
```tsx
// page.tsx (Server Component)
async function getData() {
  const db = getDatabase();
  return db.query.draws.findMany();
}

export default async function Page() {
  const draws = await getData(); // Runs on server
  return <DrawList draws={draws} />;
}
```

#### Pattern 3: Client State + Server Mutations
```tsx
// page.tsx (Server)
import { InteractiveWidget } from './widget';

export default function Page() {
  return <InteractiveWidget />;
}

// widget.tsx
'use client';
import { useState } from 'react';
import { updateData } from './actions';

export function InteractiveWidget() {
  const [count, setCount] = useState(0);
  
  async function handleClick() {
    setCount(count + 1);
    await updateData(count + 1); // Server Action
  }
  
  return <button onClick={handleClick}>{count}</button>;
}

// actions.ts
'use server';
export async function updateData(value: number) {
  // ... database update
}
```

### Debugging Tips

1. **"use client" not working?**
   - Ensure it's the FIRST line (before imports)
   - Check for mixing `'use client'` and `'use server'` in same file

2. **Serialization errors?**
   - Remove functions, Date objects, class instances from props
   - Convert dates to ISO strings: `date.toISOString()`

3. **Bundle too large?**
   - Check if you're marking parent components as `'use client'` unnecessarily
   - Move `'use client'` deeper in the tree

4. **Type errors with Server Actions?**
   - Ensure proper imports (not dynamic imports)
   - Check that all parameters and returns are serializable types

### Styling Philosophy

**CRITICAL:** Never use ad-hoc inline styles or explicit color classes (`text-white`, `bg-black`). All styles must be defined via semantic design tokens in `index.css` and `tailwind.config.ts`.

#### Design System Rules

1. **Semantic Tokens Only**
   - Define colors, gradients, shadows, animations in design system
   - Use HSL colors exclusively in `index.css`
   - Create component variants for all states (hover/press/focus/disabled/loading)

2. **Component Variants**
   - Extend shadcn/ui components with custom variants
   - Example: `<Button variant="hero">` instead of `<Button className="bg-white/10">`

3. **Premium Polish**
   - Clean, minimal aesthetic (Apple/Linear/Mercury level)
   - Typography: Inter font, regular/medium weight, tracking ~-0.02 to -0.04em
   - Neutral base palette + 1 accent color for priority states
   - Rounded-2xl cards, soft shadows, subtle depth
   - No stock AI gradients or emojis

4. **Micro-interactions**
   - Smooth transitions (120-220ms, cubic-bezier easing)
   - Drag-and-drop for task ordering
   - Ripple effects on buttons (discrete, non-intrusive)
   - Loading skeletons for data fetching
   - Toast notifications for user feedback

### Accessibility

- Complete keyboard navigation with visible focus rings
- ARIA labels/roles on interactive elements
- Focus trapping in modals/sheets
- WCAG 2.2 AA compliance (≥4.5:1 contrast ratios)
- Mobile-first responsive layout

## Testing Requirements

- ≥80% line coverage via Vitest
- Co-locate unit tests with source files in `tests/` mirror structure
- Mock HTTP via MSW handlers
- Seed test database with `scripts/pull-draws.ts --limit 5` before integration tests
- E2E specs in Playwright for critical user flows

## Commit Standards

- **Conventional Commits:** `feat: add jackpot probability panel`
- Single concern per commit
- Include affected file paths in commit body when migrations run
- Reference issue IDs: `Refs #123`
- CI must pass (`bun run lint && bun run test`) before merging

## Pull Requests

Must include:
- Clear scope description
- Edge cases tested
- UI screenshots (if applicable)
- Issue/Jira reference
- Passing CI checks (`bun run lint && bun run test`)

## Security & Configuration

- Secrets in `.env.local` (copy from `.env.example`)
- Never commit credentials or SQLite database files
- Cache CAIXA API responses in Redis or local cache files
- Document security changes in `docs/SYSTEM_PROMPT.md`
- Add `db/*.db` and `db/*.sqlite*` to `.gitignore`

## Development Workflow from Cursor Rules

### Task Execution Procedure

1. **Clarify scope** - Confirm objective and plan approach before coding
2. **Locate insertion points** - Identify precise files/lines for changes
3. **Minimal edits** - Avoid unrelated refactors or scope creep
4. **Verify correctness** - Check for security issues and side effects
5. **Clear delivery** - Summarize changes, files touched, risks/assumptions

### Constraints

- Do not introduce new abstractions unless explicitly requested
- Keep logic isolated to prevent regressions
- Use absolute paths when invoking tools
- Align with existing project patterns
- Preserve indentation style (tabs vs spaces)

## Important Notes

### Statistical Integrity

- **Lottery prediction is impossible** - explicitly acknowledge this
- Focus on historical pattern analysis and frequency statistics
- All betting strategies are heuristic-based with no guaranteed outcomes
- Provide clear disclaimers about randomness and independent trials

### Design System Priority

- Always edit design system (`index.css`, `tailwind.config.ts`) before components
- Create variants for all component states
- Never use explicit color classes in JSX
- Use semantic tokens: `bg-background`, `text-foreground`, `border-accent`

### Code References

When referencing code in discussions, use the format `file_path:line_number` for easy navigation.

Example: "The API integration is implemented in `lib/api/caixa-client.ts:42`"

### Documentation

- `docs/PROMPT_UI.md` - UI/UX requirements and design specifications
- `docs/PROMPT-MAIN.md` - Core domain logic and betting strategies
- `docs/SYSTEM_PROMPT.md` - System architecture and technical context
- `AGENTS.md` - Repository structure and coding guidelines

Update documentation when product scope changes.