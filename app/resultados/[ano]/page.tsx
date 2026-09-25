import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  FIRST_DRAW_YEAR,
  LAST_ACCEPTED_YEAR,
  type DrawRecord,
  type YearArchive,
} from '@/lib/api/archive-contract';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { loadYearArchive } from '@/app/_lib/archive';
import { countLabel, dezena, joinPtBr, resolveIntegerParam } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  Breadcrumbs,
  DezenaChips,
  PageStructuredData,
  Pager,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  inlineLinkClass,
  tableClass,
  tdClass,
  thClass,
} from '@/app/_components/archive-ui';

interface YearRouteProps {
  params: Promise<{ ano: string }>;
}

const TOP_NUMBERS_LISTED = 6;

async function getYearArchive(params: YearRouteProps['params']): Promise<YearArchive> {
  const { ano } = await params;
  const year = resolveIntegerParam(ano, FIRST_DRAW_YEAR, LAST_ACCEPTED_YEAR, (value) => `/resultados/${value}`);
  const archive = await loadYearArchive(year);
  if (!archive) {
    notFound();
  }
  return archive;
}

function breadcrumbsFor(year: number): BreadcrumbItem[] {
  return [
    { name: 'Início', url: '/' },
    { name: 'Resultados', url: '/resultados' },
    { name: String(year), url: `/resultados/${year}` },
  ];
}

/** Draws are ordered newest first. */
function yearBounds(draws: DrawRecord[]): { first: DrawRecord; last: DrawRecord } {
  const last = draws[0];
  const first = draws.at(-1);
  if (!first || !last) {
    throw new Error('Year archive without draws');
  }
  return { first, last };
}

function mostDrawnThisYear(draws: DrawRecord[]): { numbers: number[]; times: number } {
  const counts = new Map<number, number>();
  for (const draw of draws) {
    for (const number of draw.numbers) {
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
  }
  const times = Math.max(...counts.values());
  const numbers = [...counts.entries()]
    .filter(([, count]) => count === times)
    .map(([number]) => number)
    .sort((a, b) => a - b);
  return { numbers, times };
}

export async function generateMetadata({ params }: YearRouteProps): Promise<Metadata> {
  const { year, draws } = await getYearArchive(params);
  const { first, last } = yearBounds(draws);
  const accumulated = draws.filter((draw) => draw.sena.winners === 0).length;

  return buildPageMetadata({
    path: `/resultados/${year}`,
    title:
      draws.length === 1
        ? `Resultado da Mega-Sena ${year}: o único concurso do ano`
        : `Resultados da Mega-Sena ${year}: todos os ${formatNumber(draws.length)} concursos`,
    description: `${countLabel(draws.length, 'concurso', 'concursos')} da Mega-Sena em ${year}, do ${first.contestNumber} ao ${last.contestNumber}: dezenas, ganhadores e prêmios de cada sorteio. ${formatNumber(accumulated)} ${accumulated === 1 ? 'acumulou' : 'acumularam'}.`,
    absoluteTitle: true,
  });
}

export default async function YearResultsPage({ params }: YearRouteProps): Promise<React.JSX.Element> {
  const { year, draws, previousYear, nextYear } = await getYearArchive(params);
  const { first, last } = yearBounds(draws);
  const path = `/resultados/${year}`;
  const breadcrumbs = breadcrumbsFor(year);
  const withWinner = draws.filter((draw) => draw.sena.winners > 0);
  const accumulated = draws.length - withWinner.length;
  const biggest = withWinner.reduce<DrawRecord | null>(
    (best, draw) => (best === null || draw.sena.prize > best.sena.prize ? draw : best),
    null
  );
  const top = mostDrawnThisYear(draws);
  const topListed = top.numbers.slice(0, TOP_NUMBERS_LISTED).map(dezena);

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageStructuredData
        path={path}
        name={`Resultados da Mega-Sena em ${year}`}
        description={`Todos os concursos da Mega-Sena realizados em ${year}.`}
        breadcrumbs={breadcrumbs}
        type="CollectionPage"
        dateModified={nextYear?.firstDrawDate ?? last.drawDate}
      />

      <header className="space-y-5">
        <Breadcrumbs items={breadcrumbs} />
        <h1 className="text-balance font-title text-3xl font-bold tracking-tight sm:text-4xl">
          Resultados da Mega-Sena em {year}
        </h1>
        <AnswerSummary>
          Em {year}, a Mega-Sena teve {countLabel(draws.length, 'concurso', 'concursos')}, do{' '}
          {first.contestNumber} ({formatDate(first.drawDate)}) ao {last.contestNumber} (
          {formatDate(last.drawDate)}). {countLabel(withWinner.length, 'concurso teve', 'concursos tiveram')}{' '}
          ganhador na sena e {formatNumber(accumulated)} {accumulated === 1 ? 'acumulou' : 'acumularam'}.
          {biggest
            ? ` O maior prêmio por aposta foi de ${formatCurrency(biggest.sena.prize)}, no concurso ${biggest.contestNumber}.`
            : ''}{' '}
          {top.numbers.length === 1
            ? `A dezena que mais saiu no ano foi ${topListed[0]} (${countLabel(top.times, 'vez', 'vezes')}).`
            : `As dezenas que mais saíram no ano foram ${joinPtBr(topListed)}${
                top.numbers.length > topListed.length ? ' e outras' : ''
              } (${countLabel(top.times, 'vez', 'vezes')} cada).`}
        </AnswerSummary>
      </header>

      <section aria-labelledby="concursos" className="space-y-4">
        <SectionHeading id="concursos">Concursos de {year}</SectionHeading>
        <TableFrame>
          <table className={tableClass}>
            <caption className="sr-only">Concursos de {year}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Concurso</th>
                <th scope="col" className={thClass}>Data</th>
                <th scope="col" className={thClass}>Dezenas</th>
                <th scope="col" className={thClass}>Sena</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((draw) => (
                <tr key={draw.contestNumber}>
                  <th scope="row" className={tdClass}>
                    <ArchiveLink href={`/concurso/${draw.contestNumber}`} className={inlineLinkClass}>
                      {draw.contestNumber}
                    </ArchiveLink>
                  </th>
                  <td className={tdClass}>{formatDate(draw.drawDate)}</td>
                  <td className={tdClass}>
                    <DezenaChips numbers={draw.numbers} />
                  </td>
                  <td className={tdClass}>
                    {draw.sena.winners === 0
                      ? 'Acumulou'
                      : countLabel(draw.sena.winners, 'ganhador', 'ganhadores')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </section>

      <Pager
        label="Outros anos"
        previous={
          previousYear !== null
            ? { href: `/resultados/${previousYear}`, label: 'Ano anterior', detail: String(previousYear) }
            : null
        }
        next={
          nextYear !== null
            ? { href: `/resultados/${nextYear.year}`, label: 'Próximo ano', detail: String(nextYear.year) }
            : null
        }
      />

      <RandomnessNote />
    </div>
  );
}
