import type { Metadata } from 'next';
import Link from 'next/link';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { NumberField } from '@/components/number-field';
import {
  cn,
  formatCurrency,
  formatDate,
  formatDecimal,
  formatNumber,
  formatPercentage,
} from '@/lib/utils';
import type { DrawStatistics, NumberFrequency } from '@/lib/analytics/statistics';
import { countLabel, dezena } from '@/app/_lib/format';
import {
  ArchiveLink,
  DezenaChips,
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
  type Fact,
} from '@/app/_components/archive-ui';
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
  const through = statistics.lastContestNumber;
  const times = (entry: NumberFrequency): string => countLabel(entry.frequency, 'vez', 'vezes');
  const facts: Fact[] = [
    { term: pt.dashboard.totalDraws, value: formatNumber(statistics.totalDraws) },
    {
      term: pt.dashboard.accumulationRate,
      value: formatPercentage(statistics.accumulationRate),
      hint: `${formatNumber(statistics.accumulatedCount)} concursos.`,
    },
    {
      term: pt.dashboard.averagePrizeSena,
      value: formatCurrency(statistics.averagePrizeSena),
      hint: pt.dashboard.averagePrizeHint,
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <PageJsonLd
        path="/dashboard"
        name={pt.meta.dashboard.title}
        description={pt.meta.dashboard.description}
        breadcrumbs={[
          { name: 'Início', url: '/' },
          { name: 'Dashboard', url: '/dashboard' },
        ]}
      />

      <div className="space-y-14">
        <h1 className="text-4xl font-semibold sm:text-5xl">{pt.dashboard.title}</h1>

        {lastDraw ? (
          <section
            aria-labelledby="dashboard-last"
            className="grid gap-8 border-t-2 border-primary pt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{pt.dashboard.lastDraw}</p>
              <h2
                id="dashboard-last"
                className="font-condensed text-4xl font-semibold tabular-nums sm:text-5xl"
              >
                Concurso {lastDraw.contestNumber}
              </h2>
              <p className="text-muted-foreground tabular-nums">
                Sorteio de {formatDate(lastDraw.drawDate)}
              </p>
              <dl className="border-t border-border pt-4">
                <dt className="text-sm text-muted-foreground">Prêmio da sena</dt>
                <dd className="font-condensed text-2xl font-semibold tabular-nums">
                  {lastDraw.accumulated ? 'Acumulou' : formatCurrency(lastDraw.prizeSena)}
                </dd>
              </dl>
              <ArchiveLink
                href={`/concurso/${lastDraw.contestNumber}`}
                className={cn('inline-block', inlineLinkClass)}
              >
                Ganhadores e rateio do concurso {lastDraw.contestNumber}
              </ArchiveLink>
            </div>
            <figure className="space-y-3">
              <NumberField
                struck={lastDraw.numbers}
                linked
                size="lg"
                label={`Dezenas sorteadas no concurso ${lastDraw.contestNumber}`}
              />
              <figcaption>
                <SourceLine through={lastDraw.contestNumber} />
              </figcaption>
            </figure>
          </section>
        ) : null}

        <section aria-labelledby="dashboard-archive" className="space-y-4">
          <SectionHeading id="dashboard-archive">{pt.dashboard.archiveTitle}</SectionHeading>
          <FactList facts={facts} />
          <SourceLine through={through} />
        </section>

        <div className="grid gap-12 lg:grid-cols-2">
          <section aria-labelledby="dashboard-most" className="space-y-4">
            <SectionHeading id="dashboard-most">{pt.dashboard.mostFrequent}</SectionHeading>
            <RankedList
              labelId="dashboard-most"
              entries={rankBy(
                10,
                statistics.mostFrequentNumbers,
                (entry) => entry.frequency,
                times
              )}
            />
          </section>
          <section aria-labelledby="dashboard-least" className="space-y-4">
            <SectionHeading id="dashboard-least">{pt.dashboard.leastFrequent}</SectionHeading>
            <RankedList
              labelId="dashboard-least"
              entries={rankBy(
                10,
                statistics.leastFrequentNumbers,
                (entry) => -entry.frequency,
                times
              )}
            />
          </section>
          <div className="lg:col-span-2">
            <SourceLine through={through} />
          </div>
        </div>

        {hotNumbers && hotNumbers.length > 0 ? (
          <section aria-labelledby="dashboard-hot" className="space-y-4">
            <SectionHeading id="dashboard-hot">{pt.dashboard.hotNumbersTitle}</SectionHeading>
            <TableFrame>
              <table className={tableClass}>
                <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
                  {pt.dashboard.hotNumbersCaption}
                </caption>
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
                  </tr>
                </thead>
                <tbody>
                  {hotNumbers.map((hot: HotNumber) => (
                    <tr key={hot.number}>
                      <th scope="row" className={cellClass}>
                        <ArchiveLink
                          href={`/numeros/${hot.number}`}
                          className={cn(inlineLinkClass, 'font-condensed text-base font-semibold')}
                        >
                          {dezena(hot.number)}
                        </ArchiveLink>
                      </th>
                      <td className={cellClass}>{hot.recentOccurrences}</td>
                      <td className={cellClass}>{formatDecimal(hot.streakIntensity, 1)}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <SourceLine through={through} />
          </section>
        ) : null}

        <section aria-labelledby="dashboard-recent" className="space-y-4">
          <SectionHeading id="dashboard-recent">{pt.dashboard.recentDraws}</SectionHeading>
          <TableFrame>
            <table className={tableClass}>
              <caption className="sr-only">{pt.dashboard.recentDraws}</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Concurso
                  </th>
                  <th scope="col" className={thClass}>
                    Data
                  </th>
                  <th scope="col" className={thClass}>
                    Dezenas
                  </th>
                  <th scope="col" className={cn(thClass, 'text-right')}>
                    Prêmio da sena
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentDraws.map((draw: RecentDraw) => (
                  <tr key={draw.contestNumber}>
                    <th scope="row" className={cellClass}>
                      <ArchiveLink
                        href={`/concurso/${draw.contestNumber}`}
                        className={inlineLinkClass}
                      >
                        {draw.contestNumber}
                      </ArchiveLink>
                    </th>
                    <td className={cellClass}>{formatDate(draw.drawDate)}</td>
                    <td className={cellClass}>
                      <DezenaChips numbers={draw.numbers} />
                    </td>
                    <td className={cn(cellClass, 'text-right')}>
                      {draw.accumulated ? 'Acumulou' : formatCurrency(draw.prizeSena)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          <SourceLine through={through} />
        </section>

        <section aria-labelledby="dashboard-tools">
          <SectionHeading id="dashboard-tools">{pt.dashboard.toolsTitle}</SectionHeading>
          <ul className="mt-6 border-t-2 border-primary">
            {pt.dashboard.tools.map((tool) => (
              <li
                key={tool.href}
                className="grid gap-1 border-b border-border py-5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-8"
              >
                <Link
                  href={tool.href}
                  className="w-fit rounded-sm font-title text-xl font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors [font-stretch:88%] hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {tool.title}
                </Link>
                <p className="max-w-[60ch] text-muted-foreground">{tool.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <RandomnessNote />
      </div>
    </div>
  );
}
