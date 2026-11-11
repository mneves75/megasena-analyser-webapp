import { describe, expect, it, vi } from 'vitest';

// zod v4 probes `Function("")` when it loads, which the production CSP
// (no 'unsafe-eval') reports as a violation. Client components must not reach it.
vi.mock('zod', () => {
  throw new Error('zod reached a client module graph');
});

describe('client module graph', () => {
  it('loads the generator components and the archive UI without zod', async () => {
    await expect(import('@/components/bet-generator')).resolves.toBeDefined();
    await expect(import('@/app/_components/archive-ui')).resolves.toBeDefined();
  });
});

describe('archive UI in the client graph', () => {
  // The generator's client rows import DezenaChips and FactList from archive-ui,
  // so whatever archive-ui imports ships to the browser. The field of sixty is a
  // server-only figure and must stay out of that graph.
  it('archive-ui does not import the number field', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('app/_components/archive-ui.tsx', 'utf8');
    expect(source).not.toMatch(/from '@\/components\/number-field'/);
  });

  it('the generator form does not import the number field either', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('app/dashboard/generator/generator-form.tsx', 'utf8');
    expect(source).not.toMatch(/from '@\/components\/number-field'/);
  });

  it('the error state stays out of archive-ui: error boundaries load on every route', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('components/error-state.tsx', 'utf8');
    expect(source).not.toMatch(/from '@\/app\/_components\/archive-ui'/);
  });
});
