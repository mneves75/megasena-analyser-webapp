import type { Metadata } from 'next';
import Link from 'next/link';
import { StatsCard } from '@/components/stats-card';
import { formatCurrency, formatDate, formatNumber, formatPercentage } from '@/lib/utils';
import type { DrawStatistics, NumberFrequency } from '@/lib/analytics/statistics';
import {
  BarChart3,
  TrendingUp,
  Flame,
  Trophy,
  Calculator,
  Database,
  Calendar,
  Activity,
} from 'lucide-react';
import { LotteryBall } from '@/components/lottery-ball';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';

import { BASE_URL } from '@/lib/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: pt.meta.dashboard.title,
  description: pt.meta.dashboard.description,
  alternates: {
    canonical: '/dashboard',
  },
  openGraph: {
    title: `${pt.meta.dashboard.title} | ${pt.app.name}`,
    description: pt.meta.dashboard.openGraphDescription,
    url: '/dashboard',
  },
};

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic';

interface RecentDraw {
  contestNumber: number;
  drawDate: string;
  numbers: number[];
  prizeSena: number;
  accumulated: boolean;
}

interface HotNumber {
  number: number;
  recentOccurrences: number;
  trend: 'hot' | 'normal' | 'cold';
  streakIntensity: number;
}

interface DashboardApiResponse {
  statistics: DrawStatistics;
  recentDraws: RecentDraw[];
  hotNumbers?: HotNumber[];
}

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedDashboard: { data: DashboardApiResponse; fetchedAt: number } | null = null;

async function getDashboardData(): Promise<DashboardApiResponse> {
  const url = buildApiUrl('/api/dashboard');
  let responseErrorLogged = false;

  try {
    const response = await fetchApi('/api/dashboard', {
      cache: 'no-store',
      next: { revalidate: 0 },
      timeoutMs: 12000,
    });
    
    if (!response.ok) {
      const text = await response.text();
      logger.error('dashboard.api_response_error', new Error('Dashboard API error'), {
        statusCode: response.status,
        statusText: response.statusText,
        route: '/api/dashboard',
        responseBodyLength: text.length,
        responseBodySnippet: text.slice(0, 120),
      });
      responseErrorLogged = true;
      throw new Error(`Não foi possível carregar os dados do painel: ${response.status} ${response.statusText}`);
    }
    
    const data = (await response.json()) as DashboardApiResponse;
    cachedDashboard = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    const cached = cachedDashboard;
    const now = Date.now();
    if (cached && now - cached.fetchedAt <= DASHBOARD_CACHE_TTL_MS) {
      logger.warn('dashboard.fetch_fallback_cache', {
        route: '/api/dashboard',
        targetUrl: url,
        cacheAgeMs: now - cached.fetchedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return cached.data;
    }

    if (!responseErrorLogged) {
      logger.error('dashboard.fetch_failed', error, {
        route: '/api/dashboard',
        targetUrl: url,
      });
    }
    throw error;
  }
}

export default async function DashboardPage() {
  const { statistics, recentDraws, hotNumbers } = await getDashboardData();
  const lastDraw = recentDraws[0];

  return (
    <div className="container mx-auto px-4 py-8">
      <JsonLd data={generateBreadcrumbSchema([
        { name: 'Início', url: '/' },
        { name: 'Dashboard', url: '/dashboard' },
      ])} />

      <div className="space-y-8">
        <header>
          <h1 className="mb-1.5 text-3xl font-bold tracking-tight sm:text-4xl">{pt.dashboard.title}</h1>
          <p className="text-muted-foreground">{pt.dashboard.subtitle}</p>
        </header>

        {/* KPI: primary last-draw panel + three compact secondary metrics */}
        <section className="grid gap-4 lg:grid-cols-3">
          {lastDraw ? (
            <Card className="hover-lift flex flex-col lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {pt.dashboard.stats.lastDraw}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-3xl font-bold tabular-nums sm:text-4xl">#{lastDraw.contestNumber}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{formatDate(lastDraw.drawDate)}</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {lastDraw.numbers.map((num: number) => (
                    <LotteryBall key={num} number={num} size="lg" />
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">{pt.dashboard.sections.prizeLabel}:</span>
                  {lastDraw.accumulated ? (
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {pt.dashboard.sections.accumulated}
                    </span>
                  ) : (
                    <span className="font-semibold tabular-nums">{formatCurrency(lastDraw.prizeSena)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.totalDraws}
              value={formatNumber(statistics.totalDraws)}
              icon={<Database className="h-4 w-4" />}
              description={pt.dashboard.stats.totalDrawsDescription}
            />
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.accumulationRate}
              value={formatPercentage(statistics.accumulationRate)}
              icon={<TrendingUp className="h-4 w-4" />}
              description={`${formatNumber(statistics.accumulatedCount)} ${pt.dashboard.stats.accumulationDescriptionSuffix}`}
            />
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.averagePrizeSena}
              value={formatCurrency(statistics.averagePrizeSena)}
              icon={<Trophy className="h-4 w-4" />}
              description={pt.dashboard.stats.averagePrizeDescription}
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {pt.dashboard.sections.mostFrequent}
              </CardTitle>
              <CardDescription>{pt.dashboard.sections.mostFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.mostFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground tabular-nums">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {pt.dashboard.sections.leastFrequent}
              </CardTitle>
              <CardDescription>{pt.dashboard.sections.leastFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.leastFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground tabular-nums">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{pt.dashboard.sections.recentDraws}</CardTitle>
            <CardDescription>{pt.dashboard.sections.recentDrawsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDraws.map((draw: RecentDraw) => (
                <div
                  key={draw.contestNumber}
                  className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4 transition-smooth hover:bg-card sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-semibold tabular-nums">
                        {pt.dashboard.sections.contestLabel} #{draw.contestNumber}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">{formatDate(draw.drawDate)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {draw.numbers.map((num: number) => (
                        <LotteryBall key={num} number={num} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 text-left sm:text-right">
                    <div className="text-sm text-muted-foreground">{pt.dashboard.sections.prizeLabel}</div>
                    {draw.accumulated ? (
                      <span className="mt-0.5 inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {pt.dashboard.sections.accumulated}
                      </span>
                    ) : (
                      <div className="font-semibold tabular-nums">{formatCurrency(draw.prizeSena)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {hotNumbers && hotNumbers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
                {pt.dashboard.sections.hotNumbersTitle}
              </CardTitle>
              <CardDescription>
                {pt.dashboard.sections.hotNumbersDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
                {hotNumbers.map((hot: HotNumber) => (
                  <div key={hot.number} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <LotteryBall number={hot.number} size="md" />
                      <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                        <Flame aria-hidden className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium tabular-nums">{hot.recentOccurrences}x</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{hot.streakIntensity}x</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/statistics" aria-label={pt.nav.statistics} className="group">
            <Card className="hover-lift h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  {pt.dashboard.actions.statisticsTitle}
                </CardTitle>
                <CardDescription>
                  {pt.dashboard.actions.statisticsDescription}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/generator" aria-label={pt.nav.generator} className="group">
            <Card className="hover-lift h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calculator className="h-4 w-4 text-primary" />
                  {pt.dashboard.actions.generatorTitle}
                </CardTitle>
                <CardDescription>
                  {pt.dashboard.actions.generatorDescription}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
