import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatisticsPage from '@/app/dashboard/statistics/page';
import { pt } from '@/lib/i18n';

// An empty hot group must not hide a populated cold group or its navigation.
vi.mock('@/components/seo/page-json-ld', () => ({ PageJsonLd: () => null }));
vi.mock('@/lib/api/forwarded-client-ip', () => ({ forwardedClientIpHeaders: async () => ({}) }));
vi.mock('@/lib/api/api-fetch', () => ({
  buildApiUrl: (path: string) => `http://localhost${path}`,
  fetchApi: async () => Response.json({
    summary: { totalDraws: 1, lastContestNumber: 1, lastDrawDate: '2026-09-29' },
    frequencies: [],
    patterns: [],
    hotNumbers: [],
    coldNumbers: [{ number: 7, recentOccurrences: 0, streakIntensity: 0 }],
  }),
}));

describe('StatisticsPage', () => {
  it('shows cold streaks and their navigation when no hot streaks exist', async () => {
    render(await StatisticsPage());
    expect(screen.getByRole('heading', { name: pt.statistics.streaks.coldTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sequências' })).toHaveAttribute('href', '#sequencias');
    expect(screen.queryByRole('heading', { name: pt.statistics.streaks.hotTitle })).not.toBeInTheDocument();
  });
});
