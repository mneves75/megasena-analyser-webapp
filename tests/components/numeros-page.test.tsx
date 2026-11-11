import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import NumbersHubPage from '@/app/numeros/page';

vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/app/_lib/archive', () => ({
  loadNumbersIndex: async () => ({
    archive: {
      totalDraws: 100,
      lastContestNumber: 100,
      lastDrawDate: '2026-09-29',
      lastModified: null,
    },
    numbers: Array.from({ length: 60 }, (_, index) => {
      const number = index + 1;
      return {
        number,
        frequency: number === 10 ? 20 : 10,
        rank: number === 10 ? 1 : 2,
        lastAppearance: { contestNumber: 99, drawDate: '2026-09-28', drawsSince: number % 7 },
      };
    }),
  }),
}));

describe('NumbersHubPage table', () => {
  it('draws the frequency against the most drawn number and keeps three columns on phones', async () => {
    render(await NumbersHubPage());
    const table = screen.getByRole('table', { name: 'Frequência e atraso dos números de 1 a 60' });
    const rows = within(table).getAllByRole('row');
    const [, ten] = [rows[1], rows[10]];
    const bar = ten?.querySelector('svg rect:nth-of-type(2)');
    expect(bar?.getAttribute('width')).toBe('100');
    expect(rows[1]?.querySelector('svg rect:nth-of-type(2)')?.getAttribute('width')).toBe('50');

    const head = within(table).getAllByRole('columnheader');
    expect(head.map((cell) => cell.textContent)).toEqual([
      'Número',
      'Vezes',
      '% dos concursos',
      'Ranking',
      'Atraso',
      'Última vez',
    ]);
    expect(head.map((cell) => cell.className.includes('hidden sm:table-cell'))).toEqual([
      false,
      false,
      true,
      true,
      false,
      true,
    ]);
    expect(head.slice(1).every((cell) => cell.className.includes('text-right'))).toBe(true);
  });

  it('stacks share and rank under the count, and the last contest under the delay, below sm', async () => {
    render(await NumbersHubPage());
    const table = screen.getByRole('table', { name: 'Frequência e atraso dos números de 1 a 60' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(60);
    for (const row of rows) {
      const lines = Array.from(row.querySelectorAll<HTMLElement>('[class~="sm:hidden"]'));
      expect(lines).toHaveLength(2);
      expect(lines.every((line) => /\bblock\b/.test(line.className))).toBe(true);
      expect(lines.every((line) => line.className.includes('text-muted-foreground'))).toBe(true);
    }
    const ten = rows[9]!;
    const [share, last] = Array.from(ten.querySelectorAll<HTMLElement>('[class~="sm:hidden"]'));
    expect(share?.textContent).toBe('20,0% · 1º lugar');
    expect(last?.textContent).toBe('último no 99');
    expect(within(last!).getByRole('link', { name: '99' })).toHaveAttribute('href', '/concurso/99');
  });
});
