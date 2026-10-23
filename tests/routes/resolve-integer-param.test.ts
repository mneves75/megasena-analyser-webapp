// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  permanentRedirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  },
}));

import { resolveIntegerParam } from '@/app/_lib/format';

const toContest = (value: number) => `/concurso/${value}`;

/**
 * Archive route params come straight from the public URL, before any API quota
 * applies: parsing must stay linear in the input length.
 */
describe('resolveIntegerParam', () => {
  it('returns a canonical value', () => {
    expect(resolveIntegerParam('3006', 1, 9999, toContest)).toBe(3006);
  });

  it('redirects a zero-padded value to its canonical path', () => {
    expect(() => resolveIntegerParam('03006', 1, 9999, toContest)).toThrow('NEXT_REDIRECT /concurso/3006');
    expect(() => resolveIntegerParam('0070', 1, 9999, toContest)).toThrow('NEXT_REDIRECT /concurso/70');
  });

  it.each(['0', '000', '0x', '', '12a', '99999'])('returns 404 for %j', (raw) => {
    expect(() => resolveIntegerParam(raw, 1, 9999, toContest)).toThrow('NEXT_NOT_FOUND');
  });

  it('rejects a long zero run in linear time', () => {
    const raw = `${'0'.repeat(50_000)}x`;
    const started = performance.now();
    expect(() => resolveIntegerParam(raw, 1, 9999, toContest)).toThrow('NEXT_NOT_FOUND');
    expect(performance.now() - started).toBeLessThan(200);
  });
});
