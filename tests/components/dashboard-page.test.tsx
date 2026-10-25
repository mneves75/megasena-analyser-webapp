import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { pt } from '@/lib/i18n';

vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/lib/api/forwarded-client-ip', () => ({ forwardedClientIpHeaders: async () => ({}) }));
vi.mock('@/lib/api/api-fetch', () => ({
  buildApiUrl: (path: string) => `http://localhost${path}`,
  fetchApi: async () =>
    Response.json({
      statistics: {
        totalDraws: 3006,
        lastDrawDate: '2026-05-12',
        lastContestNumber: 3006,
        mostFrequentNumbers: [
          { number: 10, frequency: 356, lastDrawnContest: 3000, lastDrawnDate: null },
          { number: 53, frequency: 356, lastDrawnContest: 2990, lastDrawnDate: null },
          { number: 5, frequency: 340, lastDrawnContest: 2980, lastDrawnDate: null },
        ],
        leastFrequentNumbers: [
          { number: 26, frequency: 250, lastDrawnContest: 2900, lastDrawnDate: null },
          { number: 21, frequency: 260, lastDrawnContest: 2800, lastDrawnDate: null },
        ],
        averagePrizeSena: 12345678.9,
        averagePrizeQuina: 0,
        accumulatedCount: 2104,
        accumulationRate: 70,
      },
      recentDraws: [
        {
          contestNumber: 3006,
          drawDate: '2026-05-12',
          numbers: [4, 15, 23, 42, 51, 60],
          prizeSena: 0,
          accumulated: true,
        },
        {
          contestNumber: 3005,
          drawDate: '2026-05-09',
          numbers: [1, 2, 3, 4, 5, 6],
          prizeSena: 50000000,
          accumulated: false,
        },
      ],
      hotNumbers: [{ number: 42, recentOccurrences: 4, trend: 'hot', streakIntensity: 2.5 }],
    }),
}));

describe('DashboardPage', () => {
  it('keeps a strict heading outline: one h1, then h2 sections, no level skipped', async () => {
    render(await DashboardPage());
    const levels = screen
      .getAllByRole('heading')
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `jump before heading #${i}`).toBeLessThanOrEqual(1);
    }
  });

  it('shows the latest draw with its six numbers, prize state and contest link', async () => {
    render(await DashboardPage());
    const field = screen.getByRole('list', { name: 'Dezenas sorteadas no concurso 3006' });
    expect(within(field).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/numeros/4',
      '/numeros/15',
      '/numeros/23',
      '/numeros/42',
      '/numeros/51',
      '/numeros/60',
    ]);
    expect(screen.getAllByText('Acumulou').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole('link', { name: 'Ganhadores e rateio do concurso 3006' })
    ).toHaveAttribute('href', '/concurso/3006');
  });

  it('keeps the archive facts: total draws, accumulation rate with count, average prize', async () => {
    render(await DashboardPage());
    expect(screen.getByText(pt.dashboard.totalDraws).parentElement).toHaveTextContent('3.006');
    expect(screen.getByText(pt.dashboard.accumulationRate).parentElement).toHaveTextContent(
      /2\.104 concursos/
    );
    expect(screen.getByText(pt.dashboard.averagePrizeSena).parentElement).toHaveTextContent(
      'R$ 12.345.678,90'
    );
  });

  it('ranks ties with a shared position and links each number', async () => {
    render(await DashboardPage());
    const most = screen.getByRole('list', { name: pt.dashboard.mostFrequent });
    const rows = within(most).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(/^1º10356 vezes$/);
    expect(rows[1]).toHaveTextContent(/^1º53356 vezes$/);
    expect(rows[2]).toHaveTextContent(/^3º05340 vezes$/);
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute('href', '/numeros/10');

    const least = screen.getByRole('list', { name: pt.dashboard.leastFrequent });
    expect(within(least).getAllByRole('listitem')[0]).toHaveTextContent(/^1º26250 vezes$/);
  });

  it('renders the recent draws table with a paid prize and the hot numbers table', async () => {
    render(await DashboardPage());
    const recent = screen.getByRole('table', { name: pt.dashboard.recentDraws });
    expect(within(recent).getByRole('link', { name: '3005' })).toHaveAttribute('href', '/concurso/3005');
    expect(within(recent).getByText('R$ 50.000.000,00')).toBeInTheDocument();

    const hot = screen.getByRole('table', { name: pt.dashboard.hotNumbersCaption });
    expect(within(hot).getByRole('link', { name: '42' })).toHaveAttribute('href', '/numeros/42');
    expect(within(hot).getByText('2,5×')).toBeInTheDocument();
  });

  it('links both tools', async () => {
    render(await DashboardPage());
    expect(screen.getByRole('link', { name: 'Estatísticas' })).toHaveAttribute('href', '/dashboard/statistics');
    expect(screen.getByRole('link', { name: 'Gerador de apostas' })).toHaveAttribute('href', '/dashboard/generator');
  });
});
