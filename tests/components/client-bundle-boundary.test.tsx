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
