import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StatisticsPage from '@/app/dashboard/statistics/page';
import { pt } from '@/lib/i18n';

const api = vi.hoisted(() => ({ payload: {} as Record<string, unknown> }));

vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/lib/api/forwarded-client-ip', () => ({ forwardedClientIpHeaders: async () => ({}) }));
vi.mock('@/lib/api/api-fetch', () => ({
  buildApiUrl: (path: string) => `http://localhost${path}`,
  fetchApi: async () => Response.json(api.payload),
}));

const numbers = Array.from({ length: 60 }, (_, index) => index + 1);
const frequencyOf = (number: number): number =>
  number === 10 ? 15 : number === 26 || number === 33 ? 5 : 10;

// 100 draws: 10 is the most drawn, 26 and 33 tie as the least drawn.
const fullPayload = {
  summary: { totalDraws: 100, lastContestNumber: 100, lastDrawDate: '2026-09-29' },
  frequencies: numbers.map((number) => ({
    number,
    frequency: frequencyOf(number),
    lastDrawnContest: 90,
    lastDrawnDate: '2026-09-01',
  })),
  patterns: [{ type: 'consecutive', description: 'x', occurrences: 40, lastSeen: '2026-09-29' }],
  delays: numbers.map((number) => ({
    number,
    delayDraws: number % 13,
    lastDrawnContest: 90,
    lastDrawnDate: '2026-09-01',
    averageDelay: 10,
    delayCategory: 'normal',
  })),
  delayDistribution: [
    { category: 'Recente (≤5)', count: 30 },
    { category: 'Normal', count: 20 },
    { category: 'Atrasado', count: 8 },
    { category: 'Crítico', count: 2 },
  ],
  decades: ['01-10', '11-20', '21-30', '31-40', '41-50', '51-60'].map((decade, index) => ({
    decade,
    totalOccurrences: 100,
    percentage: 15 + index,
    expectedPercentage: 16.67,
    deviation: index - 1.67,
    topNumbers: [{ number: index * 10 + 1, frequency: 12 }],
  })),
  pairs: Array.from({ length: 20 }, (_, index) => ({
    pair: [index + 1, index + 21],
    frequency: 40 - index,
    expectedFrequency: 30,
    correlation: 1.1,
    lastSeenContest: 99,
    lastSeenDate: '2026-09-28',
  })),
  parity: [3, 2, 4, 1, 5, 0, 6].map((evenCount) => ({
    evenCount,
    oddCount: 6 - evenCount,
    occurrences: 10,
    percentage: 10,
    isBalanced: evenCount >= 2 && evenCount <= 4,
  })),
  parityStats: {
    mostCommon: { evenCount: 3, oddCount: 3, occurrences: 31, percentage: 31, isBalanced: true },
    leastCommon: { evenCount: 6, oddCount: 0, occurrences: 1, percentage: 1, isBalanced: false },
    balancedPercentage: 76,
  },
  primes: {
    totalPrimes: 17,
    averagePrimesPerDraw: 1.7,
    distribution: [1, 2, 0, 3, 4, 5, 6].map((primeCount) => ({
      primeCount,
      occurrences: 10,
      percentage: 10,
    })),
    mostCommonCount: 1,
    primeFrequencies: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37].map((number) => ({
      number,
      frequency: 10,
      isPrime: true,
    })),
  },
  // Sums 100 (x10), 150 (x80), 200 (x10): P25..P75 holds 80% of the draws.
  sumStats: {
    distribution: [
      { sum: 100, count: 10 },
      { sum: 150, count: 80 },
      { sum: 200, count: 10 },
    ],
    mean: 150,
    median: 150,
    mode: 150,
    stdDev: 22.4,
    percentiles: { p5: 100, p25: 150, p50: 150, p75: 150, p95: 200 },
    minSum: 100,
    maxSum: 200,
  },
  hotNumbers: [{ number: 10, recentOccurrences: 3, streakIntensity: 1.5, lastDrawnContest: 99 }],
  coldNumbers: [{ number: 7, recentOccurrences: 0, streakIntensity: 0 }],
  luckyNumbers: [{ number: 4, averagePrizeSena: 1000, correlationScore: 1.2 }],
  unluckyNumbers: [{ number: 5, averagePrizeSena: 800, correlationScore: 0.8 }],
};

describe('StatisticsPage', () => {
  beforeEach(() => {
    api.payload = fullPayload;
  });

  it('shows cold streaks and their navigation when no hot streaks exist', async () => {
    api.payload = {
      summary: { totalDraws: 1, lastContestNumber: 1, lastDrawDate: '2026-09-29' },
      frequencies: [],
      patterns: [],
      hotNumbers: [],
      coldNumbers: [{ number: 7, recentOccurrences: 0, streakIntensity: 0 }],
    };
    render(await StatisticsPage());
    expect(
      screen.getByRole('heading', { name: pt.statistics.streaks.coldTitle })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sequências' })).toHaveAttribute('href', '#sequencias');
    expect(
      screen.getByRole('table', { name: pt.statistics.streaks.coldTitle })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '07' })).toHaveAttribute('href', '/numeros/7');
    expect(
      screen.queryByRole('heading', { name: pt.statistics.streaks.hotTitle })
    ).not.toBeInTheDocument();
  });

  it('states the source once, in the page header', async () => {
    const { container } = render(await StatisticsPage());
    expect(container.textContent?.match(/Fonte: CAIXA/g)).toHaveLength(1);
    expect(
      screen.getByText(
        'Fonte: CAIXA Econômica Federal. Dados até o concurso 100 (29/09/2026), 100 concursos processados.'
      )
    ).toBeInTheDocument();
  });

  it('leads with the most and least drawn numbers and the equal-share average', async () => {
    render(await StatisticsPage());
    expect(screen.getByTestId('answer-summary')).toHaveTextContent(
      'Em 100 concursos, a dezena mais sorteada é a 10 (15 vezes) e as menos sorteadas são 26 e 33 (5 vezes cada). Se todas saíssem igualmente, cada uma teria saído 10,0 vezes.'
    );
  });

  it('draws the frequency of all sixty numbers as one named figure', async () => {
    render(await StatisticsPage());
    const figure = screen.getByRole('img', {
      name: 'Vezes que cada dezena de 01 a 60 foi sorteada: de 5 a 15 vezes',
    });
    expect(figure.querySelectorAll('rect')).toHaveLength(60);
    expect(
      screen.getByText('Média se todas as dezenas saíssem igualmente: 10,0 vezes')
    ).toBeInTheDocument();
  });

  it('ranks ten most and ten least drawn numbers with comparable bars', async () => {
    render(await StatisticsPage());
    for (const name of [pt.statistics.hotNumbersTitle, pt.statistics.coldNumbersTitle]) {
      const list = screen.getByRole('list', { name });
      expect(within(list).getAllByRole('listitem')).toHaveLength(10);
      expect(list.querySelectorAll('svg')).toHaveLength(10);
    }
    const least = screen.getByRole('list', { name: pt.statistics.coldNumbersTitle });
    // 26 drew 5 of the maximum 15: a third of the shared track.
    expect(least.querySelector('svg rect + rect')?.getAttribute('width')).toBe(
      String((5 / 15) * 100)
    );
  });

  it('keeps every existing section anchor', async () => {
    const { container } = render(await StatisticsPage());
    for (const id of [
      'frequencia',
      'padroes',
      'atraso',
      'dezenas',
      'pares',
      'paridade',
      'primos',
      'soma',
      'sequencias',
      'premios',
      'todos',
    ]) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
    expect(screen.queryByRole('link', { name: 'Todos' })).not.toBeInTheDocument();
  });

  it('shows ten pairs and keeps the next ten in a disclosure', async () => {
    render(await StatisticsPage());
    const top = screen.getByRole('table', { name: pt.statistics.pairs.title });
    expect(within(top).getAllByRole('row')).toHaveLength(11);
    const rest = screen.getByText('Do 11º ao 20º par', { selector: 'summary' }).closest('details');
    expect(rest).not.toBeNull();
    expect(within(rest as HTMLElement).getAllByRole('row')).toHaveLength(11);
  });

  it('orders parity and prime figures by their category, not by frequency', async () => {
    render(await StatisticsPage());
    const parity = screen.getByRole('img', { name: /^Concursos por quantidade de pares/ });
    const parityLabels = within(parity.closest('figure') as HTMLElement)
      .getAllByRole('listitem', { hidden: true })
      .map((item) => item.firstChild?.textContent);
    expect(parityLabels).toEqual(['0 / 6', '1 / 5', '2 / 4', '3 / 3', '4 / 2', '5 / 1', '6 / 0']);
    const primes = screen.getByRole('img', { name: /^Concursos por quantidade de primos/ });
    const primeLabels = within(primes.closest('figure') as HTMLElement)
      .getAllByRole('listitem', { hidden: true })
      .map((item) => item.firstChild?.textContent);
    expect(primeLabels).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });

  it('measures the share of draws inside the sum percentiles instead of assuming it', async () => {
    render(await StatisticsPage());
    expect(
      screen.getByRole('img', {
        name: 'Soma das seis dezenas: mínima 100, mediana 150, máxima 200',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText('80,0% dos concursos somaram entre 150 e 150; 100,0% entre 100 e 200.')
    ).toBeInTheDocument();
  });

  it('renders no style attribute anywhere (the CSP has no style-src-attr exception)', async () => {
    const { container } = render(await StatisticsPage());
    expect(container.querySelector('[style]')).toBeNull();
  });
});
