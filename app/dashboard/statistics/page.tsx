import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LotteryBall } from '@/components/lottery-ball';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, BarChart2, Link2, PieChart, Hash, Sigma, Flame, Trophy, Snowflake, Info } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { STATISTICS_DISPLAY } from '@/lib/constants';
import type { NumberFrequency, Pattern } from '@/lib/analytics/statistics';
import type { DelayStats } from '@/lib/analytics/delay-analysis';
import type { DecadeStats } from '@/lib/analytics/decade-analysis';
import type { PairStats } from '@/lib/analytics/pair-analysis';
import type { ParityStats } from '@/lib/analytics/parity-analysis';
import type { PrimeStats } from '@/lib/analytics/prime-analysis';
import type { SumStats } from '@/lib/analytics/sum-analysis';
import type { StreakStats } from '@/lib/analytics/streak-analysis';
import type { PrizeCorrelation } from '@/lib/analytics/prize-correlation';
import { ThemeToggle } from '@/components/theme-toggle';
import { BarChart, DonutChart } from '@/components/charts';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://megasena-analyzer.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.statistics.title,
  description: pt.meta.statistics.description,
  alternates: {
    canonical: '/dashboard/statistics',
  },
  openGraph: {
    title: `${pt.meta.statistics.title} | ${pt.app.name}`,
    description: pt.meta.statistics.openGraphDescription,
    url: '/dashboard/statistics',
  },
};

// Force dynamic rendering to fetch fresh data
export const dynamic = 'force-dynamic';

interface StatisticsApiResponse {
  frequencies: NumberFrequency[];
  patterns: Pattern[];
  delays?: DelayStats[];
  delayDistribution?: Array<{ category: string; count: number }>;
  decades?: DecadeStats[];
  pairs?: PairStats[];
  parity?: ParityStats[];
  parityStats?: {
    mostCommon: ParityStats;
    leastCommon: ParityStats;
    balancedPercentage: number;
  };
  primes?: PrimeStats;
  sumStats?: SumStats;
  hotNumbers?: StreakStats[];
  coldNumbers?: StreakStats[];
  luckyNumbers?: PrizeCorrelation[];
  unluckyNumbers?: PrizeCorrelation[];
}

const STATISTICS_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedStatistics: { data: StatisticsApiResponse; fetchedAt: number } | null = null;

async function getStatisticsData(): Promise<StatisticsApiResponse> {
  // Build query string with all required parameters
  const params = new URLSearchParams({
    delays: 'true',
    decades: 'true',
    pairs: 'true',
    parity: 'true',
    primes: 'true',
    sum: 'true',
    streaks: 'true',
    prize: 'true',
  });
  
  const url = buildApiUrl(`/api/statistics?${params}`);
  let responseErrorLogged = false;

  try {
    const response = await fetchApi(`/api/statistics?${params}`, {
      cache: 'no-store', // Force fresh data
      timeoutMs: 15000,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('statistics.api_response_error', new Error('Statistics API error'), {
        statusCode: response.status,
        statusText: response.statusText,
        route: '/api/statistics',
        responseBodyLength: text.length,
        responseBodySnippet: text.slice(0, 120),
      });
      responseErrorLogged = true;
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    const data = (await response.json()) as StatisticsApiResponse;
    cachedStatistics = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    const cached = cachedStatistics;
    const now = Date.now();
    if (cached && now - cached.fetchedAt <= STATISTICS_CACHE_TTL_MS) {
      logger.warn('statistics.fetch_fallback_cache', {
        route: '/api/statistics',
        targetUrl: url,
        cacheAgeMs: now - cached.fetchedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return cached.data;
    }

    if (!responseErrorLogged) {
      logger.error('statistics.fetch_failed', error, {
        route: '/api/statistics',
        targetUrl: url,
      });
    }
    throw error;
  }
}

export default async function StatisticsPage() {
  const { frequencies, patterns, delays, delayDistribution, decades, pairs, parity, parityStats, primes, sumStats, hotNumbers, coldNumbers, luckyNumbers, unluckyNumbers } = await getStatisticsData();

  const topHot = frequencies.slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);
  const topCold = [...frequencies].reverse().slice(0, STATISTICS_DISPLAY.TOP_NUMBERS_COUNT);
  
  // Get delay category color helper
  const getDelayColor = (category: DelayStats['delayCategory']) => {
    switch (category) {
      case 'recent':
        return 'bg-primary/10 text-primary';
      case 'normal':
        return 'bg-secondary/50 text-secondary-foreground';
      case 'overdue':
        return 'bg-accent/40 text-accent-foreground';
      case 'critical':
        return 'bg-destructive/15 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const patternDescriptions = pt.statistics.patterns.descriptions;
  const getPatternDescription = (pattern: Pattern) => {
    const key = pattern.type as keyof typeof patternDescriptions;
    return patternDescriptions[key] ?? pattern.description;
  };

  const getDelayCategoryLabel = (category: DelayStats['delayCategory']) =>
    pt.statistics.delayCategories[category] ?? category;

  const decadeOccurrencesKey = pt.statistics.decades.occurrencesLabel;
  const decadePercentageKey = pt.statistics.decades.percentageLabel;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-2xl font-bold font-title">
              {pt.app.name}
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="ghost">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {pt.nav.back}
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{pt.statistics.title}</h1>
          <p className="text-muted-foreground">
            {pt.statistics.subtitle}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {pt.statistics.hotNumbersTitle}
              </CardTitle>
              <CardDescription>{pt.statistics.hotNumbersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {topHot.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-primary">#{index + 1}</div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground">
                          #{num.lastDrawnContest}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
                {pt.statistics.coldNumbersTitle}
              </CardTitle>
              <CardDescription>{pt.statistics.coldNumbersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {topCold.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      #{index + 1}
                    </div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground">
                          #{num.lastDrawnContest}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{pt.statistics.patterns.title}</CardTitle>
            <CardDescription>{pt.statistics.patterns.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.map((pattern: Pattern, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                >
                  <div>
                    <div className="font-semibold mb-1">{getPatternDescription(pattern)}</div>
                    <div className="text-sm text-muted-foreground">
                      {pt.statistics.patterns.typeLabel}: {pattern.type}
                      {pattern.lastSeen &&
                        ` | ${pt.statistics.patterns.lastSeenLabel}: ${pattern.lastSeen}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{pattern.occurrences}</div>
                    <div className="text-xs text-muted-foreground">
                      {pt.statistics.patterns.occurrencesLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {delays && delays.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {pt.statistics.delays.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.delays.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 md:grid-cols-10 gap-3 mb-6">
                {delays.slice(0, 30).map((delay) => (
                  <div key={delay.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={delay.number} size="sm" />
                    <div className="text-xs text-center">
                      <div className={`font-medium px-1.5 py-0.5 rounded text-xs ${getDelayColor(delay.delayCategory)}`}>
                        {delay.delayDraws}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        {pt.statistics.delays.drawsLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {delayDistribution && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-3">
                    {pt.statistics.delays.distributionTitle}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {delayDistribution.map((dist) => (
                      <div key={dist.category} className="p-3 rounded-lg border bg-card/50">
                        <div className="text-2xl font-bold">{dist.count}</div>
                        <div className="text-xs text-muted-foreground">
                          {getDelayCategoryLabel(dist.category as DelayStats['delayCategory'])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {decades && decades.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                {pt.statistics.decades.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.decades.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={decades.map(d => ({
                  decade: d.decade,
                  [decadeOccurrencesKey]: d.totalOccurrences,
                  [decadePercentageKey]: d.percentage,
                }))}
                xKey="decade"
                yKey={decadeOccurrencesKey}
                color="hsl(var(--primary))"
              />
              
              <div className="mt-6 space-y-3">
                {decades.map((decade) => (
                  <div key={decade.decade} className="p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{decade.decade}</span>
                      <div className="text-right">
                        <span className="text-lg font-bold">{decade.percentage}%</span>
                        <span
                          className={`ml-2 text-sm ${decade.deviation > 0 ? 'text-primary' : 'text-destructive'}`}
                        >
                          {decade.deviation > 0 ? '+' : ''}{decade.deviation}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pt.statistics.decades.topNumbersLabel}:
                      </span>
                      {decade.topNumbers.slice(0, 3).map((n) => (
                        <div key={n.number} className="flex items-center gap-1">
                          <LotteryBall number={n.number} size="xs" />
                          <span className="text-xs">({n.frequency})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pairs && pairs.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                {pt.statistics.pairs.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.pairs.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {pairs.slice(0, 20).map((pair, index) => (
                  <div key={`${pair.pair[0]}-${pair.pair[1]}`} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <LotteryBall number={pair.pair[0]} size="sm" />
                        <span className="text-muted-foreground">+</span>
                        <LotteryBall number={pair.pair[1]} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{pair.frequency}x</div>
                      <div className="text-xs text-muted-foreground">
                        {pt.statistics.pairs.correlationLabel}: {pair.correlation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {parity && parity.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                {pt.statistics.parity.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.parity.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <DonutChart
                  data={parity.filter(p => p.occurrences > 0).map((p) => ({
                    name: `${p.evenCount} ${pt.statistics.parity.evenLabel}`,
                    value: p.occurrences,
                    color: p.isBalanced ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-3))',
                  }))}
                />
                <div className="space-y-3">
                  {parityStats && (
                    <>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          {pt.statistics.parity.mostCommonLabel}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold">
                            {parityStats.mostCommon.evenCount} {pt.statistics.parity.evenLabel} /{' '}
                            {parityStats.mostCommon.oddCount} {pt.statistics.parity.oddLabel}
                          </span>
                          <span className="text-2xl font-bold text-primary">
                            {parityStats.mostCommon.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          {pt.statistics.parity.balancedLabel}
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {parityStats.balancedPercentage}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {pt.statistics.parity.drawsLabel}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {primes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-primary" />
                {pt.statistics.primes.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.primes.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.totalLabel}</div>
                  <div className="text-3xl font-bold">{primes.totalPrimes}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.totalSuffix}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.averageLabel}</div>
                  <div className="text-3xl font-bold">{primes.averagePrimesPerDraw.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.averageSuffix}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.mostCommonLabel}</div>
                  <div className="text-3xl font-bold">{primes.mostCommonCount}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.mostCommonSuffix}</div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold mb-3">{pt.statistics.primes.distributionTitle}</h4>
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {primes.distribution.map((dist) => (
                    <div key={dist.primeCount} className="p-2 rounded-lg border bg-card/50 text-center">
                      <div className="text-lg font-bold">{dist.primeCount}</div>
                      <div className="text-xs text-muted-foreground">{dist.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">{pt.statistics.primes.topTitle}</h4>
                <div className="flex flex-wrap gap-3">
                  {primes.primeFrequencies.map((prime) => (
                    <div key={prime.number} className="flex flex-col items-center gap-1">
                      <LotteryBall number={prime.number} size="md" />
                      <span className="text-xs text-muted-foreground">{prime.frequency}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sumStats && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma className="h-5 w-5 text-primary" />
                {pt.statistics.sum.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.sum.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-4 mb-6">
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.meanLabel}</div>
                  <div className="text-3xl font-bold">{sumStats.mean}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.medianLabel}</div>
                  <div className="text-3xl font-bold">{sumStats.median}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.modeLabel}</div>
                  <div className="text-3xl font-bold">{sumStats.mode}</div>
                </div>
                <div className="p-4 rounded-lg border bg-card/50">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.stdDevLabel}</div>
                  <div className="text-3xl font-bold">{sumStats.stdDev}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-5 mb-4">
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">5o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p5}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">25o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p25}</div>
                </div>
                <div className="p-3 rounded-lg border bg-primary/20 text-center">
                  <div className="text-xs text-muted-foreground">50o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p50}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">75o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p75}</div>
                </div>
                <div className="p-3 rounded-lg border bg-card/50 text-center">
                  <div className="text-xs text-muted-foreground">95o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold">{sumStats.percentiles.p95}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                {pt.statistics.sum.rangeLabel}: {sumStats.minSum} - {sumStats.maxSum}
              </div>
            </CardContent>
          </Card>
        )}

        {hotNumbers && hotNumbers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-primary" />
                {pt.statistics.streaks.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.streaks.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Statistical disclaimer: Gambler's Fallacy warning */}
              <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-accent-foreground shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">{pt.statistics.streaks.disclaimerTitle}:</strong>{' '}
                  {pt.statistics.streaks.disclaimerBody}
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {pt.statistics.streaks.hotTitle}
                  </h4>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                    {hotNumbers.map((hot) => (
                      <div key={hot.number} className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <LotteryBall number={hot.number} size="sm" />
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                            <Flame className="h-2.5 w-2.5" aria-hidden />
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
                </div>

                {coldNumbers && coldNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-secondary-foreground" />
                      {pt.statistics.streaks.coldTitle}
                    </h4>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                      {coldNumbers.map((cold) => (
                        <div key={cold.number} className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <LotteryBall number={cold.number} size="sm" />
                            <div className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                              <Snowflake className="h-2.5 w-2.5" aria-hidden />
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium">{cold.recentOccurrences}x</div>
                            <div className="text-xs text-muted-foreground">
                              {cold.streakIntensity}x
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {luckyNumbers && luckyNumbers.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                {pt.statistics.prizeCorrelation.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.prizeCorrelation.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Statistical disclaimer: Correlation vs Causation */}
              <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-accent/30 border border-accent/50 text-xs text-muted-foreground">
                <Info className="h-4 w-4 text-accent-foreground shrink-0 mt-0.5" />
                <p>
                  <strong className="text-foreground">{pt.statistics.prizeCorrelation.disclaimerTitle}:</strong>{' '}
                  {pt.statistics.prizeCorrelation.disclaimerBody}
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    {pt.statistics.prizeCorrelation.luckyTitle}
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {luckyNumbers.slice(0, 10).map((lucky) => (
                      <div key={lucky.number} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                        <div className="flex items-center gap-3">
                          <LotteryBall number={lucky.number} size="sm" />
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {pt.statistics.prizeCorrelation.averagePrizeLabel}
                            </div>
                            <div className="font-semibold">R$ {(lucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {pt.statistics.prizeCorrelation.correlationLabel}
                          </div>
                          <div className="text-lg font-bold text-primary">{lucky.correlationScore}x</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {unluckyNumbers && unluckyNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">
                      {pt.statistics.prizeCorrelation.unluckyTitle}
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {unluckyNumbers.slice(0, 10).map((unlucky) => (
                        <div key={unlucky.number} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                          <div className="flex items-center gap-3">
                            <LotteryBall number={unlucky.number} size="sm" />
                            <div>
                              <div className="text-xs text-muted-foreground">
                                {pt.statistics.prizeCorrelation.averagePrizeLabel}
                              </div>
                              <div className="font-semibold">R$ {(unlucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {pt.statistics.prizeCorrelation.correlationLabel}
                            </div>
                            <div className="text-lg font-bold text-destructive">{unlucky.correlationScore}x</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{pt.statistics.allNumbers.title}</CardTitle>
            <CardDescription>{pt.statistics.allNumbers.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 md:grid-cols-10 gap-3">
              {frequencies.map((num: NumberFrequency) => (
                <div key={num.number} className="flex flex-col items-center gap-1">
                  <LotteryBall number={num.number} size="sm" />
                  <div className="text-xs text-center">
                    <div className="font-medium">{num.frequency}x</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
