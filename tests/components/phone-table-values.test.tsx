import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MegaDaViradaPage from '@/app/mega-da-virada/page';
import DrawResultPage from '@/app/concurso/[numero]/page';

/*
 * A table that hides a column below `sm` stacks that value in a cell that
 * stays, as a small muted line shown only on phones, so a phone loses nothing.
 */
vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));

const record = (contestNumber: number, drawDate: string, winners: number, prize: number) => ({
  contestNumber,
  drawDate,
  numbers: [2, 10, 18, 26, 34, 52],
  sena: { winners, prize },
  quina: { winners: 3, prize: 50_000 },
  quadra: { winners: 0, prize: 0 },
  accumulated: winners === 0,
  accumulatedValue: null,
  nextEstimatedPrize: null,
  totalCollection: null,
});

vi.mock('@/app/_lib/archive', () => ({
  loadMegaDaVirada: async () => ({
    lastModified: '2026-01-01T00:00:00.000Z',
    editions: [
      { edition: 2025, draw: record(2955, '2025-12-31', 6, 181_887_550.23) },
      { edition: 2024, draw: record(2810, '2024-12-31', 1, 600_000_000) },
      { edition: 2009, draw: record(1140, '2009-12-31', 0, 0) },
    ],
  }),
  loadDrawPage: async () => ({
    draw: record(3005, '2026-05-09', 0, 0),
    lastModified: '2026-05-10T00:00:00.000Z',
    previous: null,
    next: null,
    megaDaViradaEdition: null,
    numberHistory: [2, 10, 18, 26, 34, 52].map((number, index) => ({
      number,
      timesDrawn: 300,
      previous:
        index === 0 ? null : { contestNumber: 3000, drawDate: '2026-04-25', drawsBetween: 4 },
    })),
    sumContext: { earlierDraws: 3004, lowerSum: 1500 },
  }),
}));

const phoneLines = (row: HTMLElement): HTMLElement[] =>
  Array.from(row.querySelectorAll<HTMLElement>('[class~="sm:hidden"]'));
const text = (element: HTMLElement): string =>
  (element.textContent ?? '').replace(/\s+/g, ' ').trim();

function expectPhoneLine(line: HTMLElement): void {
  expect(line.className).toMatch(/\bblock\b/);
  expect(line.className).toContain('text-xs');
  expect(line.className).toContain('text-muted-foreground');
}

describe('Mega da Virada editions on phones', () => {
  it('stacks the date, the winners and the prize under the dezenas', async () => {
    render(await MegaDaViradaPage());
    const table = screen.getByRole('table', {
      name: 'Resultados de todas as edições da Mega da Virada',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => phoneLines(row).map(text))).toEqual([
      ['31/12/2025', '6 apostas ganhadoras: R$ 181.887.550,23 cada'],
      ['31/12/2024', '1 aposta ganhadora: R$ 600.000.000,00'],
      ['31/12/2009', 'Nenhuma aposta ganhadora'],
    ]);
    for (const row of rows) {
      const [date, outcome] = phoneLines(row);
      expect(date?.closest('td')).toBe(outcome?.closest('td'));
      expect(outcome?.closest('td')?.className).toContain('whitespace-nowrap');
      phoneLines(row).forEach(expectPhoneLine);
    }
  });
});

describe('draw page tables on phones', () => {
  it('stacks the hits under each prize tier name', async () => {
    render(await DrawResultPage({ params: Promise.resolve({ numero: '3005' }) }));
    const table = screen.getByRole('table', { name: 'Premiação do concurso 3005' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => phoneLines(row).map(text))).toEqual([
      ['6 acertos'],
      ['5 acertos'],
      ['4 acertos'],
    ]);
    for (const row of rows) {
      const [line] = phoneLines(row);
      expect(line?.closest('th')).not.toBeNull();
      expectPhoneLine(line!);
    }
  });

  it('stacks the date of the previous appearance under its contest', async () => {
    render(await DrawResultPage({ params: Promise.resolve({ numero: '3005' }) }));
    const table = screen.getByRole('table', { name: 'Histórico das dezenas até o concurso 3005' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => phoneLines(row).map(text))).toEqual([
      [],
      ...Array.from({ length: 5 }, () => ['25/04/2026']),
    ]);
    rows.slice(1).forEach((row) => phoneLines(row).forEach(expectPhoneLine));
  });
});
