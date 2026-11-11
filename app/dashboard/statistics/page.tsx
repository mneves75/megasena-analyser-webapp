import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Bar, Columns } from '@/components/figures';
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
import { countLabel, dezena, formatDecimal as fixedDecimal, joinPtBr } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  FrequencyGrid,
  FactList,
  RandomnessNote,
  RankedList,
  SectionHeading,
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
    <h3 id={id} className="text-lg font-semibold">
      {children}
    </h3>
  );
}

/** A closed ruled row that opens on the full table; the same disclosure as the home FAQ. */
function Disclosure({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <details className="group border-y border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out-quint group-open:rotate-180"
        />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
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

/** "a dezena mais sorteada é a 10 (361 vezes)", "as menos sorteadas são 26 e 33 (250 vezes cada)" */
const TIES_LISTED = 5;
function describeExtreme(
  byNumber: readonly NumberFrequency[],
  frequency: number,
  degree: 'mais' | 'menos',
  named: boolean
): string {
  const tied = byNumber.filter((entry) => entry.frequency === frequency);
  const times = countLabel(frequency, 'vez', 'vezes');
  const first = tied[0];
  if (tied.length === 1 && first) {
    return `a ${named ? 'dezena ' : ''}${degree} sorteada é a ${dezena(first.number)} (${times})`;
  }
  const listed = tied.slice(0, TIES_LISTED).map((entry) => dezena(entry.number));
  const remainder = tied.length - listed.length;
  const list = remainder > 0 ? `${listed.join(', ')} e mais ${remainder}` : joinPtBr(listed);
  return `as ${named ? 'dezenas ' : ''}${degree} sorteadas são ${list} (${times} cada)`;
}

function PairsTable({
  caption,
  pairs,
  firstPosition,
  max,
}: {
  caption: string;
  pairs: readonly PairStats[];
  firstPosition: number;
  max: number;
}): React.JSX.Element {
  return (
    <TableFrame>
      <table className={tableClass}>
        <caption className="sr-only">{caption}</caption>
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
            <td aria-hidden className={thClass} />
            <th scope="col" className={cn(thClass, 'text-right')}>
              {pt.statistics.pairs.correlationLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair, index) => (
            <tr key={`${pair.pair[0]}-${pair.pair[1]}`}>
              <td className={cn(cellClass, 'text-muted-foreground')}>{firstPosition + index}º</td>
              <th scope="row" className={cellClass}>
                <DezenaLink number={pair.pair[0]} />
                <span className="text-muted-foreground"> e </span>
                <DezenaLink number={pair.pair[1]} />
              </th>
              <td className={cn(cellClass, 'text-right')}>{formatNumber(pair.frequency)}</td>
              <td aria-hidden className={cn(cellClass, 'w-1/3')}>
                <Bar value={pair.frequency} max={max} />
              </td>
              <td className={cn(cellClass, 'text-right')}>{fixedDecimal(pair.correlation, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

// The smallest and largest possible sums of six distinct numbers from 1 to 60.
const SUM_FLOOR = 1 + 2 + 3 + 4 + 5 + 6;
const SUM_CEILING = 55 + 56 + 57 + 58 + 59 + 60;

/** Range strip: hairline min–max, ink line P5–P95, ink box P25–P75, foreground tick at the median. */
function SumStrip({ stats }: { stats: SumStats }): React.JSX.Element {
  const { minSum, maxSum, percentiles } = stats;
  return (
    <figure className="max-w-3xl space-y-1">
      <svg
        role="img"
        aria-label={pt.statistics.sum.figureLabel(
          formatNumber(minSum),
          formatDecimal(stats.median),
          formatNumber(maxSum)
        )}
        viewBox={`${SUM_FLOOR} 0 ${SUM_CEILING - SUM_FLOOR} 12`}
        preserveAspectRatio="none"
        className="block h-8 w-full"
      >
        <line
          x1={SUM_FLOOR}
          x2={SUM_CEILING}
          y1="6"
          y2="6"
          vectorEffect="non-scaling-stroke"
          className="stroke-border stroke-1"
        />
        <line
          x1={minSum}
          x2={maxSum}
          y1="6"
          y2="6"
          vectorEffect="non-scaling-stroke"
          className="stroke-muted-foreground stroke-1"
        />
        <rect
          x={percentiles.p5}
          width={percentiles.p95 - percentiles.p5}
          y="5"
          height="2"
          className="fill-primary"
        />
        <rect
          x={percentiles.p25}
          width={percentiles.p75 - percentiles.p25}
          y="2"
          height="8"
          className="fill-primary"
        />
        <line
          x1={percentiles.p50}
          x2={percentiles.p50}
          y1="0"
          y2="12"
          vectorEffect="non-scaling-stroke"
          className="stroke-foreground stroke-2"
        />
      </svg>
      <p aria-hidden className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{SUM_FLOOR}</span>
        <span>{SUM_CEILING}</span>
      </p>
    </figure>
  );
}

/** Share of draws whose sum falls in [low, high], measured, not assumed from the percentile names. */
function shareOfDraws(stats: SumStats, low: number, high: number): string {
  let total = 0;
  let inside = 0;
  for (const { sum, count } of stats.distribution) {
    total += count;
    if (sum >= low && sum <= high) inside += count;
  }
  return `${fixedDecimal(total > 0 ? (inside / total) * 100 : 0, 1)}%`;
}

const percentText = (value: number): string => `${fixedDecimal(value, 2)}%`;

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
  const hasFrequencies = byNumber.length > 0 && summary.totalDraws > 0;
  const maxFrequency = hasFrequencies ? Math.max(...byNumber.map((entry) => entry.frequency)) : 0;
  const minFrequency = hasFrequencies ? Math.min(...byNumber.map((entry) => entry.frequency)) : 0;
  // Six numbers per draw spread evenly over sixty.
  const equalShare = (summary.totalDraws * 6) / 60;
  const equalShareText = fixedDecimal(equalShare, 1);

  const patternDescriptions = pt.statistics.patterns.descriptions;
  const getPatternDescription = (pattern: Pattern) => {
    const key = pattern.type as keyof typeof patternDescriptions;
    return patternDescriptions[key] ?? pattern.description;
  };

  const getDelayCategoryLabel = (category: DelayStats['delayCategory']) =>
    pt.statistics.delayCategories[category] ?? category;

  const sections: StatisticsSection[] = [
    { id: 'frequencia', label: 'Frequência' },
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
    { id: 'padroes', label: 'Padrões' },
  ];

  const topPairs = pairs?.slice(0, 10) ?? [];
  const morePairs = pairs?.slice(10, 20) ?? [];
  const pairMax = Math.max(0, ...topPairs.map((pair) => pair.frequency));

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
        {hasFrequencies ? (
          <AnswerSummary>
            {pt.statistics.lead(
              countLabel(summary.totalDraws, 'concurso', 'concursos'),
              describeExtreme(byNumber, maxFrequency, 'mais', true),
              describeExtreme(byNumber, minFrequency, 'menos', false),
              equalShareText
            )}
          </AnswerSummary>
        ) : null}
        <p className="text-sm text-muted-foreground tabular-nums">
          {through
            ? `${pt.statistics.source} ${pt.statistics.freshness(
                through,
                summary.lastDrawDate ? formatDate(summary.lastDrawDate) : null,
                countLabel(summary.totalDraws, 'concurso processado', 'concursos processados')
              )}`
            : pt.statistics.source}
        </p>
      </header>

      <SectionNav sections={sections} />

      <div className="mt-10 space-y-14">
        <StatSection id="frequencia" title="Análise de Frequência">
          {hasFrequencies ? (
            <Columns
              columns={byNumber.map((entry) => ({
                label: entry.number === 1 || entry.number % 10 === 0 ? dezena(entry.number) : '',
                value: entry.frequency,
              }))}
              reference={{
                value: equalShare,
                label: pt.statistics.frequencyReference(equalShareText),
              }}
              label={pt.statistics.frequencyFigureLabel(
                formatNumber(minFrequency),
                formatNumber(maxFrequency)
              )}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <SubHeading id="frequencia-mais">{pt.statistics.hotNumbersTitle}</SubHeading>
              <RankedList
                labelId="frequencia-mais"
                entries={rankBy(topCount, frequencies, (entry) => entry.frequency, frequencyDetail)}
                barMax={maxFrequency}
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
                  frequencyDetail,
                  (entry) => entry.frequency
                )}
                barMax={maxFrequency}
              />
            </div>
          </div>
          <div id="todos" className={cn(SECTION_SCROLL_MARGIN, 'space-y-2')}>
            <SubHeading id="todos-titulo">{pt.statistics.allNumbers.title}</SubHeading>
            <FrequencyGrid entries={byNumber} label="Frequência de cada número de 01 a 60" />
          </div>
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
                  barMax={Math.max(...delays.map((delay) => delay.delayDraws))}
                />
              </div>
              {delayDistribution && delayDistribution.length > 0 && (
                <div className="space-y-2">
                  <SubHeading id="atraso-distribuicao">
                    {pt.statistics.delays.distributionTitle}
                  </SubHeading>
                  <Columns
                    columns={delayDistribution.map((dist) => ({
                      label: dist.category,
                      value: dist.count,
                      detail: countLabel(dist.count, 'dezena', 'dezenas'),
                    }))}
                    label={`${pt.statistics.delays.distributionFigureLabel}: ${delayDistribution
                      .map(
                        (dist) => `${dist.category}, ${countLabel(dist.count, 'dezena', 'dezenas')}`
                      )
                      .join('; ')}`}
                  />
                </div>
              )}
            </div>
          </StatSection>
        )}

        {decades && decades.length > 0 && (
          <StatSection id="dezenas" title={pt.statistics.decades.title}>
            <Columns
              columns={decades.map((decade) => ({
                label: decade.decade,
                value: decade.percentage,
                detail: percentText(decade.percentage),
              }))}
              reference={{
                value: 100 / 6,
                label: pt.statistics.decades.reference(fixedDecimal(100 / 6, 2)),
              }}
              label={pt.statistics.decades.figureLabel}
              className="max-w-3xl"
            />
            <Disclosure label={pt.statistics.fullTable}>
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
                          {percentText(decade.percentage)}
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
            </Disclosure>
          </StatSection>
        )}

        {pairs && pairs.length > 0 && (
          <StatSection id="pares" title={pt.statistics.pairs.title}>
            <PairsTable
              caption={pt.statistics.pairs.title}
              pairs={topPairs}
              firstPosition={1}
              max={pairMax}
            />
            {morePairs.length > 0 ? (
              <Disclosure label={pt.statistics.pairs.moreLabel(11, 10 + morePairs.length)}>
                <PairsTable
                  caption={pt.statistics.pairs.moreLabel(11, 10 + morePairs.length)}
                  pairs={morePairs}
                  firstPosition={11}
                  max={pairMax}
                />
              </Disclosure>
            ) : null}
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
            <Columns
              columns={[...parity]
                .sort((a, b) => a.evenCount - b.evenCount)
                .map((row) => ({
                  label: `${row.evenCount} / ${row.oddCount}`,
                  value: row.percentage,
                  detail: percentText(row.percentage),
                }))}
              label={pt.statistics.parity.figureLabel}
              className="max-w-3xl"
            />
            <Disclosure label={pt.statistics.fullTable}>
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
                          {percentText(row.percentage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
            </Disclosure>
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
                <Columns
                  columns={[...primes.distribution]
                    .sort((a, b) => a.primeCount - b.primeCount)
                    .map((dist) => ({
                      label: String(dist.primeCount),
                      value: dist.percentage,
                      detail: percentText(dist.percentage),
                    }))}
                  label={pt.statistics.primes.figureLabel}
                />
              </div>
              <div className="space-y-2">
                <SubHeading id="primos-mais">{pt.statistics.primes.topTitle}</SubHeading>
                <RankedList
                  labelId="primos-mais"
                  entries={rankBy(
                    topCount,
                    primes.primeFrequencies,
                    (prime) => prime.frequency,
                    (prime) => countLabel(prime.frequency, 'vez', 'vezes')
                  )}
                  barMax={Math.max(0, ...primes.primeFrequencies.map((prime) => prime.frequency))}
                />
              </div>
            </div>
            <Disclosure label={pt.statistics.fullTable}>
              <TableFrame>
                <table className={tableClass}>
                  <caption className="sr-only">{pt.statistics.primes.distributionTitle}</caption>
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
                          {percentText(dist.percentage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
            </Disclosure>
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
            <SumStrip stats={sumStats} />
            <p className="max-w-[68ch] text-sm text-muted-foreground tabular-nums">
              {pt.statistics.sum.spread(
                shareOfDraws(sumStats, sumStats.percentiles.p25, sumStats.percentiles.p75),
                formatDecimal(sumStats.percentiles.p25),
                formatDecimal(sumStats.percentiles.p75),
                shareOfDraws(sumStats, sumStats.percentiles.p5, sumStats.percentiles.p95),
                formatDecimal(sumStats.percentiles.p5),
                formatDecimal(sumStats.percentiles.p95)
              )}
            </p>
            <Disclosure label={pt.statistics.fullTable}>
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
            </Disclosure>
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
            <RandomnessNote>{pt.statistics.prizeCorrelation.disclaimerBody}</RandomnessNote>
          </StatSection>
        )}

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
        </StatSection>

        <RandomnessNote />
      </div>
    </div>
  );
}
