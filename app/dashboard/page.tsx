import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import Link from 'next/link';
import { StatsCard } from '@/components/stats-card';
import {
  cn,
  formatCurrency,
  formatDate,
  formatDecimal,
  formatNumber,
  formatPercentage,
} from '@/lib/utils';
import type { DrawStatistics, NumberFrequency } from '@/lib/analytics/statistics';
import { NumberField } from '@/components/number-field';
import {
  ArchiveLink,
  DezenaChips,
  NumberBallLink,
  inlineLinkClass,
} from '@/app/_components/archive-ui';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';
import { forwardedClientIpHeaders } from '@/lib/api/forwarded-client-ip';

export const metadata: Metadata = buildPageMetadata({
  path: '/dashboard',
  title: pt.meta.dashboard.title,
  description: pt.meta.dashboard.description,
  socialDescription: pt.meta.dashboard.openGraphDescription,
});

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
      headers: await forwardedClientIpHeaders(),
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
      throw new Error(
        `Não foi possível carregar os dados do painel: ${response.status} ${response.statusText}`
      );
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
      <PageJsonLd
        path="/dashboard"
        name={pt.meta.dashboard.title}
        description={pt.meta.dashboard.description}
        breadcrumbs={[
          { name: 'Início', url: '/' },
          { name: 'Dashboard', url: '/dashboard' },
        ]}
      />

      <div className="space-y-8">
        <header>
          <h1 className="mb-2 text-4xl font-semibold sm:text-5xl">{pt.dashboard.title}</h1>
          <p className="text-muted-foreground">{pt.dashboard.subtitle}</p>
        </header>

        {/* KPI: primary last-draw panel + three compact secondary metrics */}
        <section className="grid gap-4 lg:grid-cols-3">
          {lastDraw ? (
            <Card className="flex flex-col lg:col-span-2">
              <CardHeader className="pb-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {pt.dashboard.stats.lastDraw}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-condensed text-4xl font-semibold tabular-nums">
                    Concurso {lastDraw.contestNumber}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(lastDraw.drawDate)}
                  </span>
                </div>
                <NumberField
                  struck={lastDraw.numbers}
                  linked
                  label={`Dezenas sorteadas no concurso ${lastDraw.contestNumber}`}
                />
                <div className="flex items-center gap-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">
                    {pt.dashboard.sections.prizeLabel}:
                  </span>
                  {lastDraw.accumulated ? (
                    <span className="font-semibold">{pt.dashboard.sections.accumulated}</span>
                  ) : (
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(lastDraw.prizeSena)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.totalDraws}
              value={formatNumber(statistics.totalDraws)}
              description={pt.dashboard.stats.totalDrawsDescription}
            />
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.accumulationRate}
              value={formatPercentage(statistics.accumulationRate)}
              description={`${formatNumber(statistics.accumulatedCount)} ${pt.dashboard.stats.accumulationDescriptionSuffix}`}
            />
            <StatsCard
              variant="compact"
              title={pt.dashboard.stats.averagePrizeSena}
              value={formatCurrency(statistics.averagePrizeSena)}
              description={pt.dashboard.stats.averagePrizeDescription}
            />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold leading-tight">
                {pt.dashboard.sections.mostFrequent}
              </h2>
              <CardDescription>{pt.dashboard.sections.mostFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.mostFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <NumberBallLink number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {num.frequency}x
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold leading-tight">
                {pt.dashboard.sections.leastFrequent}
              </h2>
              <CardDescription>{pt.dashboard.sections.leastFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.leastFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <NumberBallLink number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {num.frequency}x
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold leading-tight">
              {pt.dashboard.sections.recentDraws}
            </h2>
            <CardDescription>{pt.dashboard.sections.recentDrawsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {recentDraws.map((draw: RecentDraw) => (
                <div
                  key={draw.contestNumber}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <ArchiveLink
                        href={`/concurso/${draw.contestNumber}`}
                        className={cn('tabular-nums', inlineLinkClass)}
                      >
                        {pt.dashboard.sections.contestLabel} {draw.contestNumber}
                      </ArchiveLink>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {formatDate(draw.drawDate)}
                      </span>
                    </div>
                    <DezenaChips numbers={draw.numbers} />
                  </div>
                  <div className="min-w-0 text-left sm:text-right">
                    <div className="text-sm text-muted-foreground">
                      {pt.dashboard.sections.prizeLabel}
                    </div>
                    {draw.accumulated ? (
                      <div className="font-semibold">{pt.dashboard.sections.accumulated}</div>
                    ) : (
                      <div className="font-semibold tabular-nums">
                        {formatCurrency(draw.prizeSena)}
                      </div>
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
              <h2 className="text-lg font-semibold leading-tight">
                {pt.dashboard.sections.hotNumbersTitle}
              </h2>
              <CardDescription>{pt.dashboard.sections.hotNumbersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
                {hotNumbers.map((hot: HotNumber) => (
                  <div key={hot.number} className="flex flex-col items-center gap-1">
                    <NumberBallLink number={hot.number} size="md" />
                    <div className="text-center">
                      <div className="text-sm font-semibold tabular-nums">
                        {formatDecimal(hot.streakIntensity)}×
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {hot.recentOccurrences} de 10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/statistics" className="group">
            <Card className="h-full">
              <CardHeader>
                <h2 className="text-lg font-semibold leading-tight">
                  {pt.dashboard.actions.statisticsTitle}
                </h2>
                <CardDescription>{pt.dashboard.actions.statisticsDescription}</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/generator" className="group">
            <Card className="h-full">
              <CardHeader>
                <h2 className="text-lg font-semibold leading-tight">
                  {pt.dashboard.actions.generatorTitle}
                </h2>
                <CardDescription>{pt.dashboard.actions.generatorDescription}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
