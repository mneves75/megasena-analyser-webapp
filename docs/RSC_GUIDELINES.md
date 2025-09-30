# React Server Components (RSC) Guidelines

## Core Philosophy: "Two Worlds, Two Doors"

This project treats the frontend and backend as **a single program** split across two machines (client and server). The `'use client'` and `'use server'` directives are not just labels—they are **doors** that open a typed bridge across the network within the module system.

## The Two Directives

### 1. `'use client'` — Typed `<script>` Tag

**Opens a door FROM server TO client.**

When a Server Component imports a Client Component, it doesn't execute the component's logic. Instead, it creates a "client reference" in the payload that tells the browser:
- Which script to load
- Which component to render from that script
- What props to pass to it

#### When to Use

Use `'use client'` ONLY when your component requires:

- **Interactivity & Event Listeners:** `onClick`, `onChange`, `onSubmit`, etc.
- **State & Lifecycle Hooks:** `useState`, `useEffect`, `useReducer`, `useContext`
- **Browser-only APIs:** `window`, `document`, `localStorage`, `navigator`
- **Class Components:** All class components are inherently client-side

#### Implementation

**Placement:** Must be the **first line** of the file, before all imports.

```tsx
'use client'; // MUST be first line

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

#### Props Rules

All props passed from Server Component to Client Component **must be serializable**:

✅ **Allowed:**
- Plain objects and arrays
- Strings, numbers, booleans, null
- Server Actions (special case)

❌ **Not Allowed:**
- Regular functions (except Server Actions)
- Date objects (convert to ISO strings)
- Maps, Sets, WeakMaps
- Class instances
- Symbols, undefined

### 2. `'use server'` — Typed `fetch()` Call

**Opens a door FROM client TO server.**

Creates Server Actions—functions that can be imported and called from client code but execute on the server with full access to databases, secrets, and filesystem.

#### When to Use

Use `'use server'` for:

- **Data Mutations:** Creating, updating, or deleting database records
- **Form Submissions:** Server-side form processing and validation
- **Secure Operations:** Accessing environment variables, secret APIs, or sensitive data
- **Any Server-Side Task:** File operations, image processing, email sending

#### Implementation

**Placement:** Must be the **first line** of the file, before all imports.

```tsx
'use server';

import { getDatabase } from '@/lib/db';

export async function createBet(budget: number, strategy: string) {
  const db = getDatabase();
  const result = await db.insert({ budget, strategy });
  return result;
}
```

#### Client Usage

```tsx
'use client';

import { createBet } from './actions'; // Direct import, fully typed

export function BetForm() {
  async function handleSubmit() {
    // Looks like local function call, executes on server
    const result = await createBet(100, 'balanced');
    console.log(result);
  }
  
  return <button onClick={handleSubmit}>Create Bet</button>;
}
```

## Architecture Guidelines

### 1. Default to Server Components

**CRITICAL RULE:** Every component is a Server Component by default unless explicitly marked with `'use client'`.

**Benefits:**
- Smaller client bundle (less JavaScript to browser)
- Direct database access without API routes
- Better SEO and initial page load
- Automatic code splitting
- Improved security (credentials never exposed to client)

### 2. Minimize Client Components

Only add `'use client'` at the **leaves** of your component tree—the lowest level where interactivity is needed.

#### ❌ Bad: Entire Page is Client-Side

```tsx
'use client'; // DON'T DO THIS

import { useState } from 'react';

export default function Page() {
  const [data, setData] = useState(null);
  
  return (
    <div>
      <Nav />
      <Header />
      <InteractiveForm onSubmit={() => setData(...)} />
      <Footer />
    </div>
  );
}
```

**Problem:** Nav, Header, and Footer don't need state, but they're forced to be client components. Wastes bandwidth and breaks server rendering.

#### ✅ Good: Only Interactive Part is Client

```tsx
// page.tsx - Server Component (no directive needed)
export default function Page() {
  return (
    <div>
      <Nav />      {/* Server Component */}
      <Header />   {/* Server Component */}
      <InteractiveForm /> {/* Client Component */}
      <Footer />   {/* Server Component */}
    </div>
  );
}

// interactive-form.tsx
'use client';

import { useState } from 'react';

export function InteractiveForm() {
  const [data, setData] = useState(null);
  return <form onSubmit={() => setData(...)} />;
}
```

### 3. Avoid Manual API Routes

Replace the old pattern of creating `/api` routes and using `fetch` with Server Actions.

#### ❌ Old Pattern (Don't Use)

```tsx
// app/api/bets/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  const db = getDatabase();
  const result = await db.insert(body);
  return Response.json(result);
}

// component.tsx
'use client';

const response = await fetch('/api/bets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
const result = await response.json();
```

**Problems:**
- No type safety between client and API
- Manual error handling
- Extra boilerplate (headers, JSON parsing)
- Need to create separate route file

#### ✅ New Pattern (Use Server Actions)

```tsx
// actions.ts
'use server';

import { getDatabase } from '@/lib/db';

export async function createBet(data: BetData) {
  const db = getDatabase();
  const result = await db.insert(data);
  return result;
}

// component.tsx
'use client';

import { createBet } from './actions';

// Fully typed, automatic serialization
const result = await createBet(data);
```

**Benefits:**
- End-to-end type safety
- No boilerplate
- Direct function import
- Automatic error boundaries

## React useEffect Guidelines

**Before using `useEffect`, read:** [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

Most `useEffect` usages are unnecessary and can be eliminated by restructuring your code.

### ❌ Don't Use useEffect For

#### 1. Transforming Data for Rendering

```tsx
// ❌ Bad - unnecessary state and effect
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(firstName + ' ' + lastName);
}, [firstName, lastName]);

// ✅ Good - calculate during render
const fullName = firstName + ' ' + lastName;
```

#### 2. Handling User Events

```tsx
// ❌ Bad - effect triggered by state change
const [clicked, setClicked] = useState(false);
useEffect(() => {
  if (clicked) {
    submitForm();
  }
}, [clicked]);

// ✅ Good - use event handler directly
<button onClick={() => submitForm()}>Submit</button>
```

#### 3. Resetting State When Props Change

```tsx
// ❌ Bad - manual state reset
useEffect(() => {
  setItems([]);
  setSelectedId(null);
}, [category]);

// ✅ Good - use key prop to reset component
<List key={category} />
```

#### 4. Adjusting State Based on Props

```tsx
// ❌ Bad - derived state in effect
const [items, setItems] = useState(props.items);
useEffect(() => {
  setItems(props.items);
}, [props.items]);

// ✅ Good - use props directly or useMemo
const items = props.items;
// or if transformation needed:
const items = useMemo(() => 
  props.items.filter(i => i.active), 
  [props.items]
);
```

### ✅ DO Use useEffect For

#### 1. Synchronizing with External Systems

```tsx
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => connection.disconnect();
}, [serverUrl, roomId]);
```

#### 2. Browser APIs

```tsx
useEffect(() => {
  function handleResize() {
    setWindowWidth(window.innerWidth);
  }
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

#### 3. Third-Party Libraries

```tsx
useEffect(() => {
  const chart = new Chart(canvasRef.current, {
    type: 'line',
    data: chartData
  });
  return () => chart.destroy();
}, [chartData]);
```

## File Structure Patterns

### Pattern 1: Simple Interactive Page

```
app/
  dashboard/
    generator/
      page.tsx              ← Server Component (layout, static content)
      generator-form.tsx    ← 'use client' (form with state)
      actions.ts            ← 'use server' (data mutations)
```

**page.tsx (Server Component):**
```tsx
import { GeneratorForm } from './generator-form';

export default function GeneratorPage() {
  return (
    <div>
      <h1>Bet Generator</h1>
      <GeneratorForm />
    </div>
  );
}
```

**generator-form.tsx (Client Component):**
```tsx
'use client';

import { useState } from 'react';
import { generateBets } from './actions';

export function GeneratorForm() {
  const [budget, setBudget] = useState(50);
  const [result, setResult] = useState(null);
  
  async function handleSubmit() {
    const data = await generateBets(budget);
    setResult(data);
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input value={budget} onChange={e => setBudget(e.target.value)} />
      <button type="submit">Generate</button>
      {result && <ResultDisplay data={result} />}
    </form>
  );
}
```

**actions.ts (Server Actions):**
```tsx
'use server';

import { BetGenerator } from '@/lib/analytics/bet-generator';

export async function generateBets(budget: number) {
  const generator = new BetGenerator();
  return generator.generateOptimizedBets(budget);
}
```

### Pattern 2: Server Data Fetching + Client Interactivity

```tsx
// page.tsx (Server Component)
import { getDatabase } from '@/lib/db';
import { StatsDisplay } from './stats-display';

async function getStats() {
  const db = getDatabase();
  return db.query.statistics.findFirst();
}

export default async function DashboardPage() {
  const stats = await getStats(); // Runs on server
  
  return (
    <div>
      <h1>Dashboard</h1>
      <StatsDisplay initialStats={stats} />
    </div>
  );
}
```

```tsx
// stats-display.tsx (Client Component)
'use client';

import { useState } from 'react';

export function StatsDisplay({ initialStats }) {
  const [stats, setStats] = useState(initialStats);
  
  return (
    <div>
      <h2>Statistics</h2>
      {/* Interactive UI */}
    </div>
  );
}
```

### Pattern 3: Nested Client Components

Server Components can import and render Client Components, and Client Components can render other Client Components.

```tsx
// page.tsx (Server)
import { InteractiveSection } from './interactive-section';

export default function Page() {
  return (
    <div>
      <Header />  {/* Server */}
      <InteractiveSection />  {/* Client */}
      <Footer />  {/* Server */}
    </div>
  );
}

// interactive-section.tsx (Client)
'use client';

import { Button } from '@/components/ui/button'; // Also client
import { useState } from 'react';

export function InteractiveSection() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <Button onClick={() => setCount(count + 1)}>
        Count: {count}
      </Button>
    </div>
  );
}
```

## Common Patterns

### Form Submission with Server Action

```tsx
// actions.ts
'use server';

export async function submitForm(formData: FormData) {
  const budget = Number(formData.get('budget'));
  const strategy = formData.get('strategy') as string;
  
  // Validate, process, save to database
  const db = getDatabase();
  await db.insert({ budget, strategy });
  
  return { success: true };
}

// form.tsx
'use client';

import { submitForm } from './actions';

export function Form() {
  return (
    <form action={submitForm}>
      <input name="budget" type="number" required />
      <select name="strategy">
        <option value="balanced">Balanced</option>
        <option value="aggressive">Aggressive</option>
      </select>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Progressive Enhancement

Server Actions work without JavaScript enabled (progressive enhancement):

```tsx
'use client';

import { useFormStatus } from 'react-dom';
import { submitForm } from './actions';

export function Form() {
  return (
    <form action={submitForm}>
      <input name="email" type="email" />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}
```

## Debugging & Troubleshooting

### 1. "use client" Not Working?

**Check:**
- Is it the FIRST line (before imports)?
- Are you mixing `'use client'` and `'use server'` in the same file?
- Did you restart the dev server after adding the directive?

### 2. Serialization Errors?

```
Error: Functions cannot be passed to Client Components
```

**Solution:** Remove functions from props, except Server Actions.

```tsx
// ❌ Bad
<ClientComponent onSave={() => console.log('saved')} />

// ✅ Good - pass data, not functions
<ClientComponent data={data} />

// ✅ Good - Server Actions are allowed
<ClientComponent onSave={serverAction} />
```

### 3. "Cannot access X before initialization"

Usually means you're importing a client component from a server component incorrectly.

**Solution:** Ensure the client component has `'use client'` directive.

### 4. Large Bundle Size?

**Check:**
- Are you marking parent components as `'use client'` unnecessarily?
- Move `'use client'` deeper in the tree to minimize client-side code
- Use dynamic imports for heavy client components

```tsx
// Lazy load heavy client component
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./heavy-chart'), {
  loading: () => <div>Loading chart...</div>
});
```

## Migration Checklist

When converting existing components to RSC:

- [ ] **Identify interactivity needs** - Which parts use state/effects/events?
- [ ] **Create Server Action file** - Move API calls to `actions.ts` with `'use server'`
- [ ] **Extract client logic** - Create separate file with `'use client'` for interactive parts
- [ ] **Update imports** - Import Server Actions directly instead of using `fetch`
- [ ] **Verify props** - Ensure all props crossing boundary are serializable
- [ ] **Remove unnecessary useEffect** - Follow "You Might Not Need an Effect" guidelines
- [ ] **Test functionality** - Confirm everything works as expected
- [ ] **Check bundle size** - Verify client bundle is smaller than before

## Best Practices Summary

1. ✅ **Default to Server Components** - Only use `'use client'` when necessary
2. ✅ **Use Server Actions** - Avoid manual API routes and `fetch` calls
3. ✅ **Minimize Client JS** - Push `'use client'` to leaves of component tree
4. ✅ **Serializable Props** - Only pass JSON-serializable data across boundaries
5. ✅ **Avoid Unnecessary Effects** - Most useEffect can be eliminated
6. ✅ **Co-locate Files** - Keep `page.tsx`, `form.tsx`, and `actions.ts` together
7. ✅ **Type Safety** - Leverage TypeScript with direct function imports
8. ✅ **Progressive Enhancement** - Forms work without JavaScript when possible

## References

- [React Server Components](https://react.dev/reference/react/use-client)
- [Server Actions](https://react.dev/reference/react/use-server)
- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server Components Patterns](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns)

