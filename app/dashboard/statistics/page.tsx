import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { cn, formatCurrency, formatDate, formatDecimal, formatNumber } from '@/lib/utils';
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
import { countLabel, dezena, formatDecimal as fixedDecimal } from '@/app/_lib/format';
import {
  ArchiveLink,
  FrequencyGrid,
  FactList,
  RandomnessNote,
  RankedList,
  SectionHeading,
  SourceLine,
  TableFrame,
  cellClass,
  inlineLinkClass,
  rankBy,
  tableClass,
  thClass,
} from '@/app/_components/archive-ui';
import { logger } from '@/lib/logger';
import { pt } from '@/lib/i18n';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { buildApiUrl, fetchApi } from '@/lib/api/api-fetch';
import { forwardedClientIpHeaders } from '@/lib/api/forwarded-client-ip';

export const metadata: Metadata = buildPageMetadata({
  path: '/dashboard/statistics',
  title: pt.meta.statistics.title,
  description: pt.meta.statistics.description,
  socialDescription: pt.meta.statistics.openGraphDescription,
});

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
      headers: await forwardedClientIpHeaders(),
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

// Clears the sticky site header plus the section nav when jumping to a section.
const SECTION_SCROLL_MARGIN = 'scroll-mt-[calc(var(--app-header-height,4rem)_+_3.5rem)]';

function StatSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={cn(SECTION_SCROLL_MARGIN, 'space-y-4')}
    >
      <SectionHeading id={`${id}-titulo`}>{title}</SectionHeading>
      {children}
    </section>
  );
}

function SubHeading({ id, children }: { id: string; children: ReactNode }): React.JSX.Element {
  return (
    <h3 id={id} className="font-medium">
      {children}
    </h3>
  );
}

function DezenaLink({ number }: { number: number }): React.JSX.Element {
  return (
    <ArchiveLink
      href={`/numeros/${number}`}
      className={cn(inlineLinkClass, 'font-condensed text-base font-semibold')}
    >
      {dezena(number)}
    </ArchiveLink>
  );
}

function StreakTable({
  labelId,
  streaks,
}: {
  labelId: string;
  streaks: readonly StreakStats[];
}): React.JSX.Element {
  return (
    <TableFrame>
      <table aria-labelledby={labelId} className={tableClass}>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Dezena
            </th>
            <th scope="col" className={thClass}>
              Saídas nos últimos 10
            </th>
            <th scope="col" className={thClass}>
              Em relação à média
            </th>
            <th scope="col" className={thClass}>
              Última vez
            </th>
          </tr>
        </thead>
        <tbody>
          {streaks.map((streak) => (
            <tr key={streak.number}>
              <th scope="row" className={cellClass}>
                <DezenaLink number={streak.number} />
              </th>
              <td className={cellClass}>{streak.recentOccurrences}</td>
              <td className={cellClass}>{fixedDecimal(streak.streakIntensity, 2)}×</td>
              <td className={cellClass}>
                {streak.lastDrawnContest ? (
                  <ArchiveLink
                    href={`/concurso/${streak.lastDrawnContest}`}
                    className={inlineLinkClass}
                  >
                    {streak.lastDrawnContest}
                  </ArchiveLink>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

function PrizeTable({
  labelId,
  rows,
}: {
  labelId: string;
  rows: readonly PrizeCorrelation[];
}): React.JSX.Element {
  return (
    <TableFrame>
      <table aria-labelledby={labelId} className={tableClass}>
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Dezena
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              {pt.statistics.prizeCorrelation.averagePrizeLabel}
            </th>
            <th scope="col" className={cn(thClass, 'text-right')}>
              {pt.statistics.prizeCorrelation.correlationLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.number}>
              <th scope="row" className={cellClass}>
                <DezenaLink number={row.number} />
              </th>
              <td className={cn(cellClass, 'text-right')}>
                {formatCurrency(row.averagePrizeSena)}
              </td>
              <td className={cn(cellClass, 'text-right')}>
                {fixedDecimal(row.correlationScore, 2)}×
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

/** Signed with a true minus: the deviation reads by its mark, not by a hue. */
function signedPoints(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${fixedDecimal(Math.abs(value), 2)} p.p.`;
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

  const through = summary.lastContestNumber;
  const topCount = STATISTICS_DISPLAY.TOP_NUMBERS_COUNT;
  const frequencyDetail = (entry: NumberFrequency): string =>
    entry.lastDrawnContest
      ? `${countLabel(entry.frequency, 'vez', 'vezes')} · último no ${entry.lastDrawnContest}`
      : countLabel(entry.frequency, 'vez', 'vezes');
  const byNumber = [...frequencies].sort((a, b) => a.number - b.number);

  const patternDescriptions = pt.statistics.patterns.descriptions;
  const getPatternDescription = (pattern: Pattern) => {
    const key = pattern.type as keyof typeof patternDescriptions;
    return patternDescriptions[key] ?? pattern.description;
  };

  const getDelayCategoryLabel = (category: DelayStats['delayCategory']) =>
    pt.statistics.delayCategories[category] ?? category;

  const sections: StatisticsSection[] = [
    { id: 'frequencia', label: 'Frequência' },
    { id: 'padroes', label: 'Padrões' },
    ...(delays && delays.length > 0 ? [{ id: 'atraso', label: 'Atraso' }] : []),
    ...(decades && decades.length > 0 ? [{ id: 'dezenas', label: 'Dezenas' }] : []),
    ...(pairs && pairs.length > 0 ? [{ id: 'pares', label: 'Pares' }] : []),
    ...(parity && parity.length > 0 ? [{ id: 'paridade', label: 'Par/Ímpar' }] : []),
    ...(primes ? [{ id: 'primos', label: 'Primos' }] : []),
    ...(sumStats ? [{ id: 'soma', label: 'Soma' }] : []),
    ...(hotNumbers?.length || coldNumbers?.length
      ? [{ id: 'sequencias', label: 'Sequências' }]
      : []),
    ...(luckyNumbers && luckyNumbers.length > 0 ? [{ id: 'premios', label: 'Prêmios' }] : []),
    { id: 'todos', label: 'Todos' },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageJsonLd
        path="/dashboard/statistics"
        name={pt.meta.statistics.title}
        description={pt.meta.statistics.description}
        breadcrumbs={[
          { name: 'Início', url: '/' },
          { name: 'Dashboard', url: '/dashboard' },
          { name: 'Estatísticas', url: '/dashboard/statistics' },
        ]}
      />

      <header className="mb-6 space-y-3">
        <h1 className="text-4xl font-semibold sm:text-5xl">{pt.statistics.title}</h1>
        {through ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {pt.statistics.freshness.descriptionPrefix} {through}
            {summary.lastDrawDate ? ` (${formatDate(summary.lastDrawDate)})` : ''},{' '}
            {countLabel(summary.totalDraws, 'concurso processado', 'concursos processados')}.
          </p>
        ) : null}
      </header>

      <SectionNav sections={sections} />

      <div className="mt-10 space-y-14">
        <StatSection id="frequencia" title="Análise de Frequência">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <SubHeading id="frequencia-mais">{pt.statistics.hotNumbersTitle}</SubHeading>
              <RankedList
                labelId="frequencia-mais"
                entries={rankBy(topCount, frequencies, (entry) => entry.frequency, frequencyDetail)}
              />
            </div>
            <div className="space-y-2">
              <SubHeading id="frequencia-menos">{pt.statistics.coldNumbersTitle}</SubHeading>
              <RankedList
                labelId="frequencia-menos"
                entries={rankBy(
                  topCount,
                  frequencies,
                  (entry) => -entry.frequency,
                  frequencyDetail
                )}
              />
            </div>
          </div>
          <SourceLine through={through} />
        </StatSection>

        <StatSection id="padroes" title={pt.statistics.patterns.title}>
          <TableFrame>
            <table className={tableClass}>
              <caption className="sr-only">{pt.statistics.patterns.title}</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Padrão
                  </th>
                  <th scope="col" className={cn(thClass, 'text-right')}>
                    Concursos
                  </th>
                  <th scope="col" className={thClass}>
                    {pt.statistics.patterns.lastSeenLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((pattern) => (
                  <tr key={pattern.type}>
                    <th scope="row" className={cn(cellClass, 'font-medium')}>
                      {getPatternDescription(pattern)}
                    </th>
                    <td className={cn(cellClass, 'text-right')}>
                      {formatNumber(pattern.occurrences)}
                    </td>
                    <td className={cellClass}>
                      {pattern.lastSeen ? formatDate(pattern.lastSeen) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          <SourceLine through={through} />
        </StatSection>

        {delays && delays.length > 0 && (
          <StatSection id="atraso" title={pt.statistics.delays.title}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-2">
                <SubHeading id="atraso-maiores">Números mais atrasados</SubHeading>
                <RankedList
                  labelId="atraso-maiores"
                  entries={rankBy(
                    topCount,
                    delays,
                    (delay) => delay.delayDraws,
                    (delay) =>
                      `${countLabel(delay.delayDraws, 'concurso', 'concursos')} · ${getDelayCategoryLabel(delay.delayCategory)}`
                  )}
                />
              </div>
              {delayDistribution && delayDistribution.length > 0 && (
                <div className="space-y-2">
                  <SubHeading id="atraso-distribuicao">
                    {pt.statistics.delays.distributionTitle}
                  </SubHeading>
                  <TableFrame>
                    <table aria-labelledby="atraso-distribuicao" className={tableClass}>
                      <thead>
                        <tr>
                          <th scope="col" className={thClass}>
                            Situação
                          </th>
                          <th scope="col" className={cn(thClass, 'text-right')}>
                            Números
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {delayDistribution.map((dist) => (
                          <tr key={dist.category}>
                            <th scope="row" className={cn(cellClass, 'font-medium')}>
                              {dist.category}
                            </th>
                            <td className={cn(cellClass, 'text-right')}>{dist.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                </div>
              )}
            </div>
            <SourceLine through={through} />
          </StatSection>
        )}

        {decades && decades.length > 0 && (
          <StatSection id="dezenas" title={pt.statistics.decades.title}>
            <TableFrame>
              <table className={tableClass}>
                <caption className="sr-only">{pt.statistics.decades.title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Faixa
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Ocorrências
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      % das dezenas
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Desvio
                    </th>
                    <th scope="col" className={thClass}>
                      Mais sorteadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {decades.map((decade) => (
                    <tr key={decade.decade}>
                      <th scope="row" className={cn(cellClass, 'font-medium')}>
                        {decade.decade}
                      </th>
                      <td className={cn(cellClass, 'text-right')}>
                        {formatNumber(decade.totalOccurrences)}
                      </td>
                      <td className={cn(cellClass, 'text-right')}>
                        {fixedDecimal(decade.percentage, 2)}%
                      </td>
                      <td className={cn(cellClass, 'text-right')}>
                        {signedPoints(decade.deviation)}
                      </td>
                      <td className={cellClass}>
                        <span className="flex flex-wrap gap-x-3 gap-y-1">
                          {decade.topNumbers.slice(0, 3).map((top) => (
                            <span key={top.number} className="whitespace-nowrap">
                              <DezenaLink number={top.number} />{' '}
                              <span className="text-muted-foreground">({top.frequency})</span>
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <SourceLine through={through} />
          </StatSection>
        )}

        {pairs && pairs.length > 0 && (
          <StatSection id="pares" title={pt.statistics.pairs.title}>
            <TableFrame>
              <table className={tableClass}>
                <caption className="sr-only">{pt.statistics.pairs.title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Posição
                    </th>
                    <th scope="col" className={thClass}>
                      Par
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Vezes juntos
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      {pt.statistics.pairs.correlationLabel}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.slice(0, 20).map((pair, index) => (
                    <tr key={`${pair.pair[0]}-${pair.pair[1]}`}>
                      <td className={cn(cellClass, 'text-muted-foreground')}>{index + 1}º</td>
                      <th scope="row" className={cellClass}>
                        <DezenaLink number={pair.pair[0]} />
                        <span className="text-muted-foreground"> e </span>
                        <DezenaLink number={pair.pair[1]} />
                      </th>
                      <td className={cn(cellClass, 'text-right')}>
                        {formatNumber(pair.frequency)}
                      </td>
                      <td className={cn(cellClass, 'text-right')}>
                        {fixedDecimal(pair.correlation, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <SourceLine through={through} />
          </StatSection>
        )}

        {parity && parity.length > 0 && (
          <StatSection id="paridade" title={pt.statistics.parity.title}>
            {parityStats && (
              <FactList
                facts={[
                  {
                    term: pt.statistics.parity.mostCommonLabel,
                    value: `${parityStats.mostCommon.evenCount} pares / ${parityStats.mostCommon.oddCount} ímpares`,
                    hint: `${formatDecimal(parityStats.mostCommon.percentage, 2)}% dos concursos`,
                  },
                  {
                    term: pt.statistics.parity.balancedLabel,
                    value: `${formatDecimal(parityStats.balancedPercentage, 2)}%`,
                    hint: pt.statistics.parity.drawsLabel,
                  },
                ]}
              />
            )}
            <TableFrame>
              <table className={tableClass}>
                <caption className="sr-only">{pt.statistics.parity.title}</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Pares / ímpares
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Concursos
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      % dos concursos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parity.map((row) => (
                    <tr key={row.evenCount}>
                      <th scope="row" className={cn(cellClass, 'font-medium')}>
                        {row.evenCount} / {row.oddCount}
                      </th>
                      <td className={cn(cellClass, 'text-right')}>
                        {formatNumber(row.occurrences)}
                      </td>
                      <td className={cn(cellClass, 'text-right')}>
                        {fixedDecimal(row.percentage, 2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <SourceLine through={through} />
          </StatSection>
        )}

        {primes && (
          <StatSection id="primos" title={pt.statistics.primes.title}>
            <FactList
              facts={[
                {
                  term: pt.statistics.primes.totalLabel,
                  value: primes.totalPrimes,
                  hint: pt.statistics.primes.totalSuffix,
                },
                {
                  term: pt.statistics.primes.averageLabel,
                  value: formatDecimal(primes.averagePrimesPerDraw, 2),
                  hint: pt.statistics.primes.averageSuffix,
                },
                {
                  term: pt.statistics.primes.mostCommonLabel,
                  value: primes.mostCommonCount,
                  hint: pt.statistics.primes.mostCommonSuffix,
                },
              ]}
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-2">
                <SubHeading id="primos-distribuicao">
                  {pt.statistics.primes.distributionTitle}
                </SubHeading>
                <TableFrame>
                  <table aria-labelledby="primos-distribuicao" className={tableClass}>
                    <thead>
                      <tr>
                        <th scope="col" className={thClass}>
                          Primos no sorteio
                        </th>
                        <th scope="col" className={cn(thClass, 'text-right')}>
                          Concursos
                        </th>
                        <th scope="col" className={cn(thClass, 'text-right')}>
                          % dos concursos
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {primes.distribution.map((dist) => (
                        <tr key={dist.primeCount}>
                          <th scope="row" className={cn(cellClass, 'font-medium')}>
                            {dist.primeCount}
                          </th>
                          <td className={cn(cellClass, 'text-right')}>
                            {formatNumber(dist.occurrences)}
                          </td>
                          <td className={cn(cellClass, 'text-right')}>
                            {fixedDecimal(dist.percentage, 2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableFrame>
              </div>
              <div className="space-y-2">
                <SubHeading id="primos-mais">{pt.statistics.primes.topTitle}</SubHeading>
                <RankedList
                  labelId="primos-mais"
                  entries={rankBy(
                    10,
                    primes.primeFrequencies,
                    (prime) => prime.frequency,
                    (prime) => countLabel(prime.frequency, 'vez', 'vezes')
                  )}
                />
              </div>
            </div>
            <SourceLine through={through} />
          </StatSection>
        )}

        {sumStats && (
          <StatSection id="soma" title={pt.statistics.sum.title}>
            <FactList
              facts={[
                { term: pt.statistics.sum.meanLabel, value: formatDecimal(sumStats.mean) },
                { term: pt.statistics.sum.medianLabel, value: formatDecimal(sumStats.median) },
                { term: pt.statistics.sum.modeLabel, value: formatDecimal(sumStats.mode) },
                { term: pt.statistics.sum.stdDevLabel, value: formatDecimal(sumStats.stdDev) },
              ]}
            />
            <TableFrame>
              <table className={tableClass}>
                <caption className="sr-only">Percentis da soma das seis dezenas</caption>
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Medida
                    </th>
                    <th scope="col" className={cn(thClass, 'text-right')}>
                      Soma das seis dezenas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Mínima', formatNumber(sumStats.minSum)],
                    ['5º percentil', formatDecimal(sumStats.percentiles.p5)],
                    ['25º percentil', formatDecimal(sumStats.percentiles.p25)],
                    ['50º percentil', formatDecimal(sumStats.percentiles.p50)],
                    ['75º percentil', formatDecimal(sumStats.percentiles.p75)],
                    ['95º percentil', formatDecimal(sumStats.percentiles.p95)],
                    ['Máxima', formatNumber(sumStats.maxSum)],
                  ].map(([measure, value]) => (
                    <tr key={measure}>
                      <th scope="row" className={cn(cellClass, 'font-medium')}>
                        {measure}
                      </th>
                      <td className={cn(cellClass, 'text-right')}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <SourceLine through={through} />
          </StatSection>
        )}

        {Boolean(hotNumbers?.length || coldNumbers?.length) && (
          <StatSection id="sequencias" title={pt.statistics.streaks.title}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {hotNumbers && hotNumbers.length > 0 && (
                <div className="space-y-2">
                  <SubHeading id="sequencias-quentes">{pt.statistics.streaks.hotTitle}</SubHeading>
                  <StreakTable labelId="sequencias-quentes" streaks={hotNumbers} />
                </div>
              )}
              {coldNumbers && coldNumbers.length > 0 && (
                <div className="space-y-2">
                  <SubHeading id="sequencias-frias">{pt.statistics.streaks.coldTitle}</SubHeading>
                  <StreakTable labelId="sequencias-frias" streaks={coldNumbers} />
                </div>
              )}
            </div>
            <SourceLine through={through} />
            <RandomnessNote>{pt.statistics.streaks.disclaimerBody}</RandomnessNote>
          </StatSection>
        )}

        {luckyNumbers && luckyNumbers.length > 0 && (
          <StatSection id="premios" title={pt.statistics.prizeCorrelation.title}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-2">
                <SubHeading id="premios-acima">
                  {pt.statistics.prizeCorrelation.luckyTitle}
                </SubHeading>
                <PrizeTable labelId="premios-acima" rows={luckyNumbers.slice(0, 10)} />
              </div>
              {unluckyNumbers && unluckyNumbers.length > 0 && (
                <div className="space-y-2">
                  <SubHeading id="premios-abaixo">
                    {pt.statistics.prizeCorrelation.unluckyTitle}
                  </SubHeading>
                  <PrizeTable labelId="premios-abaixo" rows={unluckyNumbers.slice(0, 10)} />
                </div>
              )}
            </div>
            <SourceLine through={through} />
            <RandomnessNote>{pt.statistics.prizeCorrelation.disclaimerBody}</RandomnessNote>
          </StatSection>
        )}

        <StatSection id="todos" title={pt.statistics.allNumbers.title}>
          <FrequencyGrid
            entries={byNumber}
            label="Frequência de cada número de 01 a 60"
            through={through}
          />
        </StatSection>
      </div>
    </div>
  );
}
