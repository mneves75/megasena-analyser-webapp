# Capítulo 6: Next.js e React Server Components

## Introdução

Next.js 16 com App Router e React Server Components (RSC) representa uma mudança fundamental em como construímos aplicações web. Este capítulo explica a arquitetura usada neste projeto e por que ela reduz drasticamente o JavaScript enviado ao navegador.

**Meta principal:** Menos JavaScript no navegador = carregamento mais rápido, melhor UX, menor consumo de dados.

---

## Arquitetura: Server vs Client

### A Metáfora

**Server Component = Tag `<script>` tipada**
- Abre a porta DO servidor PARA o cliente
- Código roda no servidor, HTML é enviado ao navegador

**Client Component = Script executado**
- Abre a porta DO cliente PARA o servidor
- Código roda no navegador, tem acesso a hooks e eventos

**Server Action = Chamada `fetch()` tipada**
- Abre a porta DO cliente PARA o servidor
- Funções que podem ser chamadas de componentes client

---

## Server Components (Padrão)

Por padrão, todo componente no Next.js App Router é um Server Component.

Abra `app/dashboard/page.tsx`:

```typescript
// Sem 'use client' = Server Component
import { StatisticsEngine } from '@/lib/analytics/statistics';

export default async function DashboardPage() {
  // Código roda no servidor
  const stats = new StatisticsEngine();
  const frequencies = stats.getNumberFrequencies();

  // HTML é enviado ao navegador
  return (
    <div>
      <h1>Estatísticas</h1>
      <NumberList numbers={frequencies.slice(0, 10)} />
    </div>
  );
}
```

**O que acontece:**
1. Servidor executa o código TypeScript
2. Consulta banco de dados (via `StatisticsEngine`)
3. Renderiza HTML
4. Envia HTML final ao navegador
5. Navegador exibe o HTML

**O que NÃO é enviado ao navegador:**
- Código TypeScript compilado
- Código do `StatisticsEngine`
- Código de acesso ao banco
- Quaisquer dependências usadas apenas no servidor

---

## Client Components (Quando Necessário)

Use `'use client'` APENAS quando precisa de:
- Event handlers (`onClick`, `onChange`)
- React hooks (`useState`, `useEffect`, `useRef`)
- Browser APIs (`window`, `document`, `localStorage`)

Abra `components/ui/button.tsx`:

```typescript
'use client'; // Necessário para onClick

import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      {children}
    </button>
  );
}
```

**Regra de ouro:** Coloque `'use client'` o mais fundo possível na árvore de componentes.

---

## Server Actions

Server Actions permitem chamar funções do servidor diretamente de componentes client.

Abra `app/dashboard/generator/actions.ts`:

```typescript
'use server'; // Marca como Server Action

import { BetGenerator } from '@/lib/analytics/bet-generator';

export async function generateBets(formData: FormData) {
  'use server'; // Segurança adicional

  const budget = Number(formData.get('budget'));
  const strategy = formData.get('strategy') as string;

  const generator = new BetGenerator();
  const result = generator.generateOptimizedBets(budget, 'optimized', strategy);

  return result; // Automaticamente serializado
}
```

**Uso em componente client:**

```typescript
'use client';

import { generateBets } from '../actions';

export function BetForm() {
  async function handleSubmit(formData: FormData) {
    // Chama Server Action diretamente
    const result = await generateBets(formData);
    console.log(result.bets);
  }

  return (
    <form action={handleSubmit}>
      <input name="budget" type="number" />
      <select name="strategy">
        <option value="hot">Quentes</option>
        <option value="cold">Frios</option>
      </select>
      <button type="submit">Gerar</button>
    </form>
  );
}
```

**O que acontece:**
1. Usuário submete formulário
2. Browser faz POST para o servidor
3. Server Action executa no servidor
4. Resultado é retornado como JSON
5. Componente atualiza com os dados

---

## Evitando API Routes

**Abordagem antiga (API Routes):**
```typescript
// app/api/generate-bets/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  const generator = new BetGenerator();
  const result = generator.generateOptimizedBets(...);
  return Response.json(result);
}

// components/client-component.tsx
'use client';
async function generate() {
  const response = await fetch('/api/generate-bets', {
    method: 'POST',
    body: JSON.stringify({ budget: 100 }),
  });
  const result = await response.json();
}
```

**Abordagem moderna (Server Actions):**
```typescript
// app/dashboard/generator/actions.ts
'use server';
export async function generateBets(budget: number) {
  const generator = new BetGenerator();
  return generator.generateOptimizedBets(budget);
}

// components/client-component.tsx
'use client';
async function generate() {
  const result = await generateBets(100);
}
```

**Vantagens:**
- Menos código boilerplate
- Type safety (sem `Response.json()` manual)
- Automaticamente revalida cache
- Progressive enhancement (funciona sem JS)

---

## Padrão: Server Component + Client Leaf

Abra `app/dashboard/generator/page.tsx`:

```typescript
// Server Component (busca dados)
import { BetGenerator } from '@/lib/analytics/bet-generator';
import { BetGeneratorForm } from './bet-generator-form';

export default async function GeneratorPage() {
  const generator = new BetGenerator();
  const availableBets = generator.getAvailableMultipleBets(1000);

  return (
    <div>
      <h1>Gerador de Apostas</h1>
      {/* Client Component recebe dados pré-buscados */}
      <BetGeneratorForm availableBets={availableBets} />
    </div>
  );
}
```

```typescript
// components/bet-generator-form.tsx
'use client'; // Necessário para useState e form handling

interface BetGeneratorFormProps {
  availableBets: Array<{ numbers: number; cost: number }>;
}

export function BetGeneratorForm({ availableBets }: BetGeneratorFormProps) {
  const [bets, setBets] = useState([]);

  return (
    <form>
      <select name="numbers">
        {availableBets.map((bet) => (
          <option key={bet.numbers} value={bet.numbers}>
            {bet.numbers} números (R${bet.cost})
          </option>
        ))}
      </select>
    </form>
  );
}
```

**Por que este padrão:**
- Dados são buscados no servidor (acesso rápido ao DB)
- Interface interativa no cliente
- Props são serializáveis (dados simples)

---

## Props Serializáveis

Ao passar dados entre Server e Client, props devem ser serializáveis.

**Válido:**
```typescript
// string, number, boolean, null, array, objeto plano
interface ValidProps {
  name: string;
  count: number;
  items: Array<{ id: number; value: string }>;
}
```

**Inválido:**
```typescript
// Funções, classes, instâncias, Date, Map, Set
interface InvalidProps {
  onClick: () => void;     // Função
  db: Database;            // Instância de classe
  date: Date;              // Objeto Date
  map: Map<string, number>; // Map
}
```

**Solução para tipos complexos:**
```typescript
// No Server Component
const rawDate = new Date();
const isoString = rawDate.toISOString(); // string
const mapEntries = Array.from(map.entries()); // array

// No Client Component
const date = new Date(isoString);
const map = new Map(mapEntries);
```

---

## Data Fetching Patterns

### 1. Server Components (Padrão)

```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  // Fetch assíncrono no servidor
  const stats = await getStatistics();

  return <StatsView stats={stats} />;
}
```

### 2. Client Components com useEffect

```typescript
'use client';

import { useEffect, useState } from 'react';

export function StatsView() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Fetch no cliente
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <div>Carregando...</div>;
  return <div>{/* ... */}</div>;
}
```

**Prefira Server Components sempre que possível!**

---

## Suspense e Streaming

Next.js pode enviar partes da página conforme ficam prontas.

```typescript
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <Header />
      <Suspense fallback={<CarregandoEstatisticas />}>
        <EstatisticsAsync />
      </Suspense>
      <Suspense fallback={<CarregandoHistorico />}>
        <HistoricoAsync />
      </Suspense>
    </div>
  );
}

async function EstatisticsAsync() {
  const stats = await getStatistics(); // Pode demorar
  return <EstatisticsView stats={stats} />;
}
```

**O que acontece:**
1. Header é renderizado imediatamente
2. Estatísticas são carregadas e enviadas quando prontas
3. Histórico é carregado em paralelo
4. Usuário vê conteúdo incrementalmente

---

## Exercício 6.1: Criar Server Component

**Tarefa:** Crie uma página que mostra estatísticas do banco de dados.

```typescript
// app/stats/page.tsx
// TODO: Criar Server Component que:
// 1. Busca estatísticas do banco
// 2. Mostra números mais frequentes
// 3. Mostra números menos frequentes
// 4. Não usa 'use client'

import { StatisticsEngine } from '@/lib/analytics/statistics';

export default function StatsPage() {
  // Sua implementação aqui
}
```

<details>
<summary>Solução</summary>

```typescript
// app/stats/page.tsx
import { StatisticsEngine } from '@/lib/analytics/statistics';

export default async function StatsPage() {
  const stats = new StatisticsEngine();
  const frequencies = stats.getNumberFrequencies();
  const mostFrequent = frequencies.slice(0, 10);
  const leastFrequent = [...frequencies].reverse().slice(0, 10);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Estatísticas</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Números Mais Frequentes</h2>
        <ul className="grid grid-cols-10 gap-2">
          {mostFrequent.map((num) => (
            <li key={num.number} className="bg-red-100 p-2 rounded text-center">
              <div className="font-bold">{num.number}</div>
              <div className="text-sm">{num.frequency}x</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Números Menos Frequentes</h2>
        <ul className="grid grid-cols-10 gap-2">
          {leastFrequent.map((num) => (
            <li key={num.number} className="bg-blue-100 p-2 rounded text-center">
              <div className="font-bold">{num.number}</div>
              <div className="text-sm">{num.frequency}x</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

</details>

---

## Exercício 6.2: Criar Server Action

**Tarefa:** Crie uma Server Action que busque histórico de sorteios.

```typescript
// app/draws/actions.ts
// TODO: Criar Server Action que:
// 1. Recebe limite como parâmetro
// 2. Busca sorteios do banco
// 3. Retorna array de sorteios

'use server';

import { StatisticsEngine } from '@/lib/analytics/statistics';

export async function getDrawHistory(limit: number = 50) {
  // Sua implementação aqui
}
```

<details>
<summary>Solução</summary>

```typescript
// app/draws/actions.ts
'use server';

import { StatisticsEngine } from '@/lib/analytics/statistics';

export async function getDrawHistory(limit: number = 50) {
  'use server';

  const stats = new StatisticsEngine();
  const draws = stats.getDrawHistory(limit);

  return draws.map(draw => ({
    contestNumber: draw.contestNumber,
    drawDate: draw.drawDate,
    numbers: draw.numbers,
    accumulated: draw.accumulated,
  }));
}
```

</details>

---

## Exercício 6.3: Cliente-Server Boundary

**Tarefa:** Refatore para usar Server Component + Client Component.

```typescript
// Antes: Tudo é client
'use client';

import { useState, useEffect } from 'react';
import { StatisticsEngine } from '@/lib/analytics/statistics';

export function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const engine = new StatisticsEngine();
    const data = engine.getNumberFrequencies();
    setStats(data);
  }, []);

  if (!stats) return <div>Carregando...</div>;
  return <StatsTable stats={stats} />;
}

// Depois: Separe em Server e Client
```

<details>
<summary>Solução</summary>

```typescript
// Server Component
import { StatisticsEngine } from '@/lib/analytics/statistics';
import { StatsTableClient } from './stats-table-client';

export default async function Dashboard() {
  const engine = new StatisticsEngine();
  const stats = engine.getNumberFrequencies();

  return <StatsTableClient stats={stats} />;
}

// Client Component
'use client';

import { useState } from 'react';

interface StatsTableClientProps {
  stats: Array<{ number: number; frequency: number }>;
}

export function StatsTableClient({ stats }: StatsTableClientProps) {
  const [filter, setFilter] = useState('');

  const filtered = stats.filter(s =>
    s.number.toString().includes(filter)
  );

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar número..."
      />
      <table>
        <tbody>
          {filtered.map((stat) => (
            <tr key={stat.number}>
              <td>{stat.number}</td>
              <td>{stat.frequency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

</details>

---

## Resumo do Capítulo 6

**Você aprendeu:**
- A metáfora de Server Components como "tags script tipadas"
- Diferença entre Server e Client Components
- Quando usar `'use client'` (eventos, hooks, browser APIs)
- Server Actions para chamadas de função ao servidor
- Por que evitar API Routes em favor de Server Actions
- O padrão Server Component + Client Leaf
- Props serializáveis e suas limitações
- Suspense e streaming para carregamento progressivo

**Referências de código:**
- `app/dashboard/page.tsx` - Server Components
- `components/bet-generator-form.tsx` - Client Components
- `app/dashboard/generator/actions.ts` - Server Actions

**Insight chave:** A arquitetura RSC reduz drasticamente o JavaScript enviado ao navegador, resultando em carregamento mais rápido e melhor experiência do usuário.

---

## Leitura Complementar

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Suspense](https://react.dev/reference/react/Suspense)

---

**A seguir:** Capítulo 7 cobre o sistema completo de geração de apostas - o coração da funcionalidade deste aplicativo.
