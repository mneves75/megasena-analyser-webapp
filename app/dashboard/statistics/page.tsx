import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LotteryBall } from '@/components/lottery-ball';
import { TrendingUp, TrendingDown, Clock, BarChart2, Link2, PieChart, Hash, Sigma, Flame, Trophy, Snowflake, Info } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import { SectionNav, type StatisticsSection } from '@/components/statistics/section-nav';
import { STATISTICS_DISPLAY } from '@/lib/constants';
import type { DrawStatistics, NumberFrequency, Pattern } from '@/lib/analytics/statistics';
import type { DelayStats } from '@/lib/analytics/delay-analysis';
import type { DecadeStats } from '@/lib/analytics/decade-analysis';
import type { PairStats } from '@/lib/analytics/pair-analysis';
import type { ParityStats } from '@/lib/analytics/parity-analysis';
import type { PrimeStats } from '@/lib/analytics/prime-analysis';
import type { SumStats } from '@/lib/analytics/sum-analysis';
import type { StreakStats } from '@/lib/analytics/streak-analysis';
import type { PrizeCorrelation } from '@/lib/analytics/prize-correlation';
import { BarChart, DonutChart } from '@/components/charts';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';
import { BASE_URL as baseUrl } from '@/lib/constants';
import { JsonLd } from '@/components/seo/json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo/schemas';

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
  summary: DrawStatistics;
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
      throw new Error(`Não foi possível carregar as estatísticas: ${response.statusText}`);
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
  const {
    summary,
    frequencies,
    patterns,
    delays,
    delayDistribution,
    decades,
    pairs,
    parity,
    parityStats,
    primes,
    sumStats,
    hotNumbers,
    coldNumbers,
    luckyNumbers,
    unluckyNumbers,
  } = await getStatisticsData();

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

  const sections: StatisticsSection[] = [
    { id: 'frequencia', label: 'Frequência' },
    { id: 'padroes', label: 'Padrões' },
    ...(delays && delays.length > 0 ? [{ id: 'atraso', label: 'Atraso' }] : []),
    ...(decades && decades.length > 0 ? [{ id: 'dezenas', label: 'Dezenas' }] : []),
    ...(pairs && pairs.length > 0 ? [{ id: 'pares', label: 'Pares' }] : []),
    ...(parity && parity.length > 0 ? [{ id: 'paridade', label: 'Par/Ímpar' }] : []),
    ...(primes ? [{ id: 'primos', label: 'Primos' }] : []),
    ...(sumStats ? [{ id: 'soma', label: 'Soma' }] : []),
    ...(hotNumbers && hotNumbers.length > 0 ? [{ id: 'sequencias', label: 'Sequências' }] : []),
    ...(luckyNumbers && luckyNumbers.length > 0 ? [{ id: 'premios', label: 'Prêmios' }] : []),
    { id: 'todos', label: 'Todos' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <JsonLd data={generateBreadcrumbSchema([
        { name: 'Início', url: '/' },
        { name: 'Dashboard', url: '/dashboard' },
        { name: 'Estatísticas', url: '/dashboard/statistics' },
      ])} />

      <header className="mb-3">
        <h1 className="mb-1.5 text-3xl font-bold tracking-tight sm:text-4xl">{pt.statistics.title}</h1>
        <p className="text-muted-foreground">{pt.statistics.subtitle}</p>
      </header>

      {/* Base de referência: linha discreta obrigatória (concurso/data da análise) */}
      <p className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{pt.statistics.freshness.title}:</span>
        <span className="tabular-nums">
          {pt.statistics.freshness.descriptionPrefix} #{summary.lastContestNumber}{' '}
          {pt.statistics.freshness.onDatePrefix}{' '}
          {summary.lastDrawDate ? formatDate(summary.lastDrawDate) : '-'}
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">
          {pt.statistics.freshness.totalDrawsLabel}: {formatNumber(summary.totalDraws)}
        </span>
      </p>

      <SectionNav sections={sections} />

      <div className="mt-8 space-y-8">
        <section className="space-y-6">
          <h2 id="frequencia" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)] text-xl font-bold sm:text-2xl">Análise de Frequência</h2>

          <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
                {pt.statistics.hotNumbersTitle}
              </CardTitle>
              <CardDescription>{pt.statistics.hotNumbersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 sm:gap-4">
                {topHot.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-1.5">
                    <div className="text-xs font-semibold text-primary tabular-nums">#{index + 1}</div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium tabular-nums">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground tabular-nums">
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
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                {pt.statistics.coldNumbersTitle}
              </CardTitle>
              <CardDescription>{pt.statistics.coldNumbersDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 sm:gap-4">
                {topCold.map((num: NumberFrequency, index: number) => (
                  <div key={num.number} className="flex flex-col items-center gap-1.5">
                    <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                      #{index + 1}
                    </div>
                    <LotteryBall number={num.number} size="md" />
                    <div className="text-center">
                      <div className="text-xs font-medium tabular-nums">{formatNumber(num.frequency)}x</div>
                      {num.lastDrawnContest && (
                        <div className="text-xs text-muted-foreground tabular-nums">
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
        </section>

        <section className="space-y-6">
          <h2 id="padroes" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)] text-xl font-bold sm:text-2xl">Padrões e Tendências</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{pt.statistics.patterns.title}</CardTitle>
              <CardDescription>{pt.statistics.patterns.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patterns.map((pattern: Pattern, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-4"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 font-semibold">{getPatternDescription(pattern)}</div>
                      <div className="text-sm text-muted-foreground">
                        {pt.statistics.patterns.typeLabel}: {pattern.type}
                        {pattern.lastSeen &&
                          ` | ${pt.statistics.patterns.lastSeenLabel}: ${formatDate(pattern.lastSeen)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums">{pattern.occurrences}</div>
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
          <Card id="atraso" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4 text-primary" />
                {pt.statistics.delays.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.delays.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
                {delays.slice(0, 30).map((delay) => (
                  <div key={delay.number} className="flex flex-col items-center gap-1">
                    <LotteryBall number={delay.number} size="sm" />
                    <div className="text-center text-xs">
                      <div className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${getDelayColor(delay.delayCategory)}`}>
                        {delay.delayDraws}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        {pt.statistics.delays.drawsLabel}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {delayDistribution && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="text-sm font-semibold mb-3">
                    {pt.statistics.delays.distributionTitle}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {delayDistribution.map((dist) => (
                      <div key={dist.category} className="rounded-lg border bg-card/50 p-3">
                        <div className="text-2xl font-bold tabular-nums">{dist.count}</div>
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
          <Card id="dezenas" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart2 className="h-4 w-4 text-primary" />
                {pt.statistics.decades.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.decades.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                title={pt.statistics.decades.title}
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
                  <div key={decade.decade} className="rounded-lg border bg-card/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold tabular-nums">{decade.decade}</span>
                      <div className="text-right tabular-nums">
                        <span className="text-lg font-bold">{decade.percentage}%</span>
                        <span
                          className={`ml-2 text-sm ${decade.deviation > 0 ? 'text-primary' : 'text-destructive'}`}
                        >
                          {decade.deviation > 0 ? '+' : ''}{decade.deviation}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pt.statistics.decades.topNumbersLabel}:
                      </span>
                      {decade.topNumbers.slice(0, 3).map((n) => (
                        <div key={n.number} className="flex items-center gap-1">
                          <LotteryBall number={n.number} size="xs" />
                          <span className="text-xs tabular-nums">({n.frequency})</span>
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
          <Card id="pares" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-4 w-4 text-primary" />
                {pt.statistics.pairs.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.pairs.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {pairs.slice(0, 20).map((pair, index) => (
                  <div key={`${pair.pair[0]}-${pair.pair[1]}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">#{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <LotteryBall number={pair.pair[0]} size="sm" />
                        <span className="text-muted-foreground">+</span>
                        <LotteryBall number={pair.pair[1]} size="sm" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">{pair.frequency}x</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {pt.statistics.pairs.correlationLabel}: {pair.correlation}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold sm:text-2xl">Distribuições Numéricas</h2>

        {parity && parity.length > 0 && (
          <Card id="paridade" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChart className="h-4 w-4 text-primary" />
                {pt.statistics.parity.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.parity.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <DonutChart
                  title={pt.statistics.parity.title}
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-lg font-bold tabular-nums">
                            {parityStats.mostCommon.evenCount} {pt.statistics.parity.evenLabel} /{' '}
                            {parityStats.mostCommon.oddCount} {pt.statistics.parity.oddLabel}
                          </span>
                          <span className="text-2xl font-bold text-primary tabular-nums">
                            {parityStats.mostCommon.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border bg-card/50">
                        <div className="text-sm font-semibold text-muted-foreground mb-2">
                          {pt.statistics.parity.balancedLabel}
                        </div>
                        <div className="text-2xl font-bold text-primary tabular-nums">
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
          <Card id="primos" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Hash className="h-4 w-4 text-primary" />
                {pt.statistics.primes.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.primes.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.totalLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{primes.totalPrimes}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.totalSuffix}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.averageLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{primes.averagePrimesPerDraw.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.averageSuffix}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.primes.mostCommonLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{primes.mostCommonCount}</div>
                  <div className="text-xs text-muted-foreground">{pt.statistics.primes.mostCommonSuffix}</div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold">{pt.statistics.primes.distributionTitle}</h3>
                <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
                  {primes.distribution.map((dist) => (
                    <div key={dist.primeCount} className="rounded-lg border bg-card/50 p-2 text-center">
                      <div className="text-lg font-bold tabular-nums">{dist.primeCount}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{dist.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">{pt.statistics.primes.topTitle}</h3>
                <div className="flex flex-wrap gap-3">
                  {primes.primeFrequencies.map((prime) => (
                    <div key={prime.number} className="flex flex-col items-center gap-1">
                      <LotteryBall number={prime.number} size="md" />
                      <span className="text-xs text-muted-foreground tabular-nums">{prime.frequency}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {sumStats && (
          <Card id="soma" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sigma className="h-4 w-4 text-primary" />
                {pt.statistics.sum.title}
              </CardTitle>
              <CardDescription>
                {pt.statistics.sum.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.meanLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{sumStats.mean}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.medianLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{sumStats.median}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.modeLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{sumStats.mode}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-4">
                  <div className="text-sm text-muted-foreground">{pt.statistics.sum.stdDevLabel}</div>
                  <div className="text-3xl font-bold tabular-nums">{sumStats.stdDev}</div>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                <div className="rounded-lg border bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground tabular-nums">5o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold tabular-nums">{sumStats.percentiles.p5}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground tabular-nums">25o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold tabular-nums">{sumStats.percentiles.p25}</div>
                </div>
                <div className="rounded-lg border bg-primary/15 p-3 text-center">
                  <div className="text-xs text-muted-foreground tabular-nums">50o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold tabular-nums">{sumStats.percentiles.p50}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground tabular-nums">75o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold tabular-nums">{sumStats.percentiles.p75}</div>
                </div>
                <div className="rounded-lg border bg-card/50 p-3 text-center">
                  <div className="text-xs text-muted-foreground tabular-nums">95o {pt.statistics.sum.percentileLabel}</div>
                  <div className="text-xl font-bold tabular-nums">{sumStats.percentiles.p95}</div>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground tabular-nums">
                {pt.statistics.sum.rangeLabel}: {sumStats.minSum} - {sumStats.maxSum}
              </div>
            </CardContent>
          </Card>
        )}
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold sm:text-2xl">Análise Temporal</h2>

        {hotNumbers && hotNumbers.length > 0 && (
          <Card id="sequencias" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Flame className="h-4 w-4 text-primary" />
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
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    {pt.statistics.streaks.hotTitle}
                  </h3>
                  <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-10">
                    {hotNumbers.map((hot) => (
                      <div key={hot.number} className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <LotteryBall number={hot.number} size="sm" />
                          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Flame className="h-2.5 w-2.5" aria-hidden />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-medium tabular-nums">{hot.recentOccurrences}x</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {hot.streakIntensity}x
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {coldNumbers && coldNumbers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-secondary-foreground" />
                      {pt.statistics.streaks.coldTitle}
                    </h3>
                    <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-10">
                      {coldNumbers.map((cold) => (
                        <div key={cold.number} className="flex flex-col items-center gap-1">
                          <div className="relative">
                            <LotteryBall number={cold.number} size="sm" />
                            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                              <Snowflake className="h-2.5 w-2.5" aria-hidden />
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium tabular-nums">{cold.recentOccurrences}x</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
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
          <Card id="premios" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-4 w-4 text-primary" />
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
                  <h3 className="text-sm font-semibold mb-3">
                    {pt.statistics.prizeCorrelation.luckyTitle}
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {luckyNumbers.slice(0, 10).map((lucky) => (
                      <div key={lucky.number} className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-3">
                        <div className="flex items-center gap-3">
                          <LotteryBall number={lucky.number} size="sm" />
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {pt.statistics.prizeCorrelation.averagePrizeLabel}
                            </div>
                            <div className="font-semibold tabular-nums">R$ {(lucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {pt.statistics.prizeCorrelation.correlationLabel}
                          </div>
                          <div className="text-lg font-bold text-primary tabular-nums">{lucky.correlationScore}x</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {unluckyNumbers && unluckyNumbers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">
                      {pt.statistics.prizeCorrelation.unluckyTitle}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {unluckyNumbers.slice(0, 10).map((unlucky) => (
                        <div key={unlucky.number} className="flex items-center justify-between gap-3 rounded-lg border bg-card/50 p-3">
                          <div className="flex items-center gap-3">
                            <LotteryBall number={unlucky.number} size="sm" />
                            <div>
                              <div className="text-xs text-muted-foreground">
                                {pt.statistics.prizeCorrelation.averagePrizeLabel}
                              </div>
                              <div className="font-semibold tabular-nums">R$ {(unlucky.averagePrizeSena / 1_000_000).toFixed(2)}M</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {pt.statistics.prizeCorrelation.correlationLabel}
                            </div>
                            <div className="text-lg font-bold text-destructive tabular-nums">{unlucky.correlationScore}x</div>
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
        </section>

        <Card id="todos" className="scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]">
          <CardHeader>
            <CardTitle className="text-lg">{pt.statistics.allNumbers.title}</CardTitle>
            <CardDescription>{pt.statistics.allNumbers.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
              {frequencies.map((num: NumberFrequency) => (
                <div key={num.number} className="flex flex-col items-center gap-1">
                  <LotteryBall number={num.number} size="sm" />
                  <div className="text-center text-xs">
                    <div className="font-medium tabular-nums">{num.frequency}x</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
