// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants')>();
  return { ...actual, MEGASENA_CONSTANTS: { ...actual.MEGASENA_CONSTANTS, MAX_NUMBER: 3 } };
});
vi.mock('@/app/_lib/archive', () => ({
  loadSitemapData: async () => ({
    archive: { lastModified: null }, draws: [], years: [], megaDaViradaLastModified: null,
  }),
}));

const { GET } = await import('@/app/sitemap.xml/route');

describe('GET /sitemap.xml', () => {
  it('lists one number profile per lottery number, from MEGASENA_CONSTANTS', async () => {
    const body = await (await GET()).text();
    const profiles = [...body.matchAll(/\/numeros\/(\d+)<\/loc>/g)].map(([, n]) => Number(n));
    expect(profiles).toEqual([1, 2, 3]);
  });
});
