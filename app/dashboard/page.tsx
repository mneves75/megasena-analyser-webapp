import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/stats-card';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils';
import type { DrawStatistics, NumberFrequency } from '@/lib/analytics/statistics';
import {
  BarChart3,
  TrendingUp,
  Flame,
  Trophy,
  Calculator,
  Database,
  Calendar,
  Sparkles,
  Activity,
} from 'lucide-react';
import { LotteryBall } from '@/components/lottery-ball';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';

const metadataBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
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
      throw new Error(`Failed to fetch dashboard data: ${response.status} ${response.statusText}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold font-title">
              {pt.app.name}
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/statistics">
                <Button variant="ghost">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  {pt.nav.statistics}
                </Button>
              </Link>
              <Link href="/dashboard/generator">
                <Button variant="default">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {pt.nav.generator}
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{pt.dashboard.title}</h1>
          <p className="text-muted-foreground">{pt.dashboard.subtitle}</p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatsCard
            title={pt.dashboard.stats.totalDraws}
            value={formatNumber(statistics.totalDraws)}
            icon={<Database className="h-4 w-4" />}
            description={pt.dashboard.stats.totalDrawsDescription}
          />
          <StatsCard
            title={pt.dashboard.stats.lastDraw}
            value={`#${statistics.lastContestNumber || '-'}`}
            icon={<Calendar className="h-4 w-4" />}
            description={statistics.lastDrawDate || '-'}
          />
          <StatsCard
            title={pt.dashboard.stats.accumulationRate}
            value={formatPercentage(statistics.accumulationRate)}
            icon={<TrendingUp className="h-4 w-4" />}
            description={`${statistics.accumulatedCount} ${pt.dashboard.stats.accumulationDescriptionSuffix}`}
          />
          <StatsCard
            title={pt.dashboard.stats.averagePrizeSena}
            value={formatCurrency(statistics.averagePrizeSena)}
            icon={<Trophy className="h-4 w-4" />}
            description={pt.dashboard.stats.averagePrizeDescription}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {pt.dashboard.sections.mostFrequent}
              </CardTitle>
              <CardDescription>{pt.dashboard.sections.mostFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.mostFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {pt.dashboard.sections.leastFrequent}
              </CardTitle>
              <CardDescription>{pt.dashboard.sections.leastFrequentDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {statistics.leastFrequentNumbers.slice(0, 10).map((num: NumberFrequency) => (
                  <div key={num.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={num.number} size="md" />
                    <span className="text-xs text-muted-foreground">{num.frequency}x</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{pt.dashboard.sections.recentDraws}</CardTitle>
            <CardDescription>{pt.dashboard.sections.recentDrawsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDraws.map((draw: RecentDraw) => (
                <div
                  key={draw.contestNumber}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-smooth"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">
                        {pt.dashboard.sections.contestLabel} #{draw.contestNumber}
                      </span>
                      <span className="text-sm text-muted-foreground">{draw.drawDate}</span>
                      {draw.accumulated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {pt.dashboard.sections.accumulated}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {draw.numbers.map((num: number) => (
                        <LotteryBall key={num} number={num} size="sm" />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">{pt.dashboard.sections.prizeLabel}</div>
                    <div className="font-semibold">{formatCurrency(draw.prizeSena)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {hotNumbers && hotNumbers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {pt.dashboard.sections.hotNumbersTitle}
              </CardTitle>
              <CardDescription>
                {pt.dashboard.sections.hotNumbersDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                {hotNumbers.map((hot: HotNumber) => (
                  <div key={hot.number} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <LotteryBall number={hot.number} size="md" />
                      <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        <Flame aria-hidden className="h-3 w-3" />
                      </div>
                    </div>
                      <div className="text-center">
                        <div className="text-xs font-medium">{hot.recentOccurrences}x</div>
                        <div className="text-xs text-muted-foreground">
                        {hot.streakIntensity}x
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/dashboard/statistics">
            <Card className="cursor-pointer hover:shadow-glow transition-smooth h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {pt.dashboard.actions.statisticsTitle}
                </CardTitle>
                <CardDescription>
                  {pt.dashboard.actions.statisticsDescription}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/generator">
            <Card className="cursor-pointer hover:shadow-glow transition-smooth h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  {pt.dashboard.actions.generatorTitle}
                </CardTitle>
                <CardDescription>
                  {pt.dashboard.actions.generatorDescription}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
