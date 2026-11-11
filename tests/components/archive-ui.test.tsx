import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  DrawsTable,
  FrequencyGrid,
  RankedList,
  TableFrame,
  rankBy,
} from '@/app/_components/archive-ui';
import { LatestDrawFigure } from '@/app/_components/latest-draw-figure';

const items = [
  { number: 4, frequency: 30 },
  { number: 10, frequency: 60 },
  { number: 26, frequency: 15 },
  { number: 53, frequency: 60 },
];
const times = (item: { frequency: number }): string => `${item.frequency} vezes`;

describe('rankBy', () => {
  it('returns the measure itself as value, even when ranking by a negated score', () => {
    const least = rankBy(
      2,
      items,
      (item) => -item.frequency,
      times,
      (item) => item.frequency
    );
    expect(least.map((entry) => [entry.number, entry.value])).toEqual([
      [26, 15],
      [4, 30],
    ]);
  });

  it('uses the score as value by default and shares positions on ties', () => {
    const most = rankBy(3, items, (item) => item.frequency, times);
    expect(most.map((entry) => [entry.number, entry.rank, entry.value])).toEqual([
      [10, 1, 60],
      [53, 1, 60],
      [4, 3, 30],
    ]);
  });
});

describe('RankedList', () => {
  const entries = rankBy(4, items, (item) => item.frequency, times);

  it('renders rank, linked dezena and detail without bars when no barMax is given', () => {
    const { container } = render(
      <>
        <h3 id="lista">Lista</h3>
        <RankedList labelId="lista" entries={entries} />
      </>
    );
    const list = screen.getByRole('list', { name: 'Lista' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByRole('link', { name: '04' })).toHaveAttribute('href', '/numeros/4');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('draws one bar per row against the shared maximum when barMax is given', () => {
    const { container } = render(
      <>
        <h3 id="barras">Barras</h3>
        <RankedList labelId="barras" entries={entries} barMax={120} />
      </>
    );
    const bars = Array.from(container.querySelectorAll('svg'));
    expect(bars).toHaveLength(4);
    expect(bars.map((bar) => bar.querySelectorAll('rect')[1]?.getAttribute('width'))).toEqual([
      '50',
      '50',
      '25',
      '12.5',
    ]);
    expect(bars.every((bar) => bar.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});

describe('FrequencyGrid', () => {
  it('describes the shade without assuming a light page, and carries no source line', () => {
    render(<FrequencyGrid entries={items} label="Grade" />);
    expect(
      screen.getByText('Quanto mais forte a cor da casa, mais vezes a dezena foi sorteada.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Fonte:/)).not.toBeInTheDocument();
  });
});

describe('LatestDrawFigure', () => {
  it('sets the caller heading and facts left of the field of sixty, at 5fr / 7fr from lg', () => {
    const { container } = render(
      <LatestDrawFigure
        heading={<h1 id="titulo">Resultado da Mega-Sena 3006</h1>}
        numbers={[2, 10, 18, 26, 34, 52]}
        fieldLabel="Dezenas sorteadas no concurso 3006"
      >
        <p>Sorteio de 12/05/2026.</p>
      </LatestDrawFigure>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Resultado da Mega-Sena 3006'
    );
    expect(screen.getByText('Sorteio de 12/05/2026.')).toBeInTheDocument();
    const field = screen.getByRole('list', { name: 'Dezenas sorteadas no concurso 3006' });
    expect(within(field).getAllByRole('link')).toHaveLength(6);
    expect(container.firstElementChild?.className).toContain(
      'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
    );
  });

  it('without actions it renders exactly the text column and the field', () => {
    const { container } = render(
      <LatestDrawFigure heading={<h2>Concurso 3006</h2>} numbers={[2]} fieldLabel="Campo">
        <p>Fatos</p>
      </LatestDrawFigure>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(
      'grid grid-cols-1 items-start gap-8 border-t-2 border-primary pt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12'
    );
    expect([...root.children].map((child) => child.tagName)).toEqual(['DIV', 'OL']);
    expect(root.lastElementChild?.className).not.toContain('row-span');
  });

  it('puts the actions after the field on phones and under the facts from lg', () => {
    const { container } = render(
      <LatestDrawFigure
        heading={<h1>Título</h1>}
        numbers={[2]}
        fieldLabel="Campo"
        actions={<a href="/dashboard">Acessar Dashboard</a>}
      >
        <p>Fatos</p>
      </LatestDrawFigure>
    );
    const root = container.firstElementChild as HTMLElement;
    expect([...root.children].map((child) => child.tagName)).toEqual(['DIV', 'OL', 'DIV']);
    expect(root.className).toContain('lg:grid-rows-[auto_1fr]');
    expect(screen.getByRole('list', { name: 'Campo' }).className).toContain('lg:row-span-2');
    expect(root.lastElementChild).toContainElement(
      screen.getByRole('link', { name: 'Acessar Dashboard' })
    );
    expect(root.lastElementChild?.className).toContain('lg:self-end');
  });
});

describe('latest-draw block', () => {
  it.each([
    'app/(home)/page.tsx',
    'app/dashboard/page.tsx',
    'app/resultados/page.tsx',
    'app/mega-da-virada/page.tsx',
    'app/concurso/[numero]/page.tsx',
  ])('%s uses the shared figure instead of its own copy', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).toContain('<LatestDrawFigure');
    expect(source).not.toContain('<NumberField');
  });
});

const draw = (contestNumber: number, winners: number) => ({
  contestNumber,
  drawDate: '2026-05-12',
  numbers: [2, 10, 18, 26, 34, 52],
  sena: { winners, prize: winners > 0 ? 1_000_000 : 0 },
  quina: { winners: 10, prize: 1000 },
  quadra: { winners: 100, prize: 100 },
  accumulated: winners === 0,
  accumulatedValue: null,
  nextEstimatedPrize: null,
  totalCollection: null,
});

describe('TableFrame', () => {
  it('is a named, keyboard-reachable scroll region with a visible focus ring', () => {
    render(
      <TableFrame label="Concursos de 2026">
        <table />
      </TableFrame>
    );
    const region = screen.getByRole('region', { name: 'Concursos de 2026' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.className).toMatch(/overflow-x-auto/);
    expect(region.className).toMatch(/\bfocus-ring\b/);
  });

  it('can take its name from a visible heading', () => {
    render(
      <>
        <h3 id="sequencias">Sequências</h3>
        <TableFrame labelledBy="sequencias">
          <table />
        </TableFrame>
      </>
    );
    expect(screen.getByRole('region', { name: 'Sequências' })).toBeInTheDocument();
  });
});

describe('DrawsTable on phones', () => {
  it('keeps contest and dezenas, drops date and sena below sm, and never forces a scroll', () => {
    render(<DrawsTable caption="Concursos" draws={[draw(3006, 0), draw(3005, 2)]} />);
    const table = screen.getByRole('table', { name: 'Concursos' });
    expect(table.className).not.toMatch(/min-w-/);
    const head = within(table).getAllByRole('columnheader');
    expect(head.map((cell) => cell.className.includes('hidden sm:table-cell'))).toEqual([
      false,
      true,
      false,
      true,
    ]);
    const firstRow = within(table).getAllByRole('row')[1]!;
    const cells = within(firstRow).getAllByRole('cell');
    expect(cells[0]?.className).toContain('hidden sm:table-cell');
    expect(cells[1]?.className).toContain('whitespace-nowrap');
    expect(cells[2]?.className).toContain('hidden sm:table-cell');
    expect(cells[2]?.className).toContain('text-right');
  });
});

describe('dense tables', () => {
  it.each([
    'app/_components/archive-ui.tsx',
    'app/mega-da-virada/page.tsx',
    'app/dashboard/statistics/page.tsx',
  ])('%s sets no minimum table width', (file) => {
    expect(readFileSync(path.join(process.cwd(), file), 'utf8')).not.toMatch(/min-w-\[\d+rem\]/);
  });
});
