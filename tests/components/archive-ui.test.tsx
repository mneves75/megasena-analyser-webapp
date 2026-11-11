import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FrequencyGrid, RankedList, rankBy } from '@/app/_components/archive-ui';

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
