import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MAX_CONTEST_NUMBER, type DrawPage } from '@/lib/api/archive-contract';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { loadDrawPage } from '@/app/_lib/archive';
import {
  countLabel,
  describeDraw,
  dezena,
  formatPercentPtBr,
  joinPtBr,
  longestComeback,
  resolveIntegerParam,
  senaOutcome,
  weekdayPtBr,
} from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  Breadcrumbs,
  FactList,
  NumberBallLink,
  PageTitle,
  Pager,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  inlineLinkClass,
  tableClass,
  cellClass,
  thClass,
  type Fact,
} from '@/app/_components/archive-ui';

interface DrawRouteProps {
  params: Promise<{ numero: string }>;
}

async function getDrawPage(params: DrawRouteProps['params']): Promise<DrawPage> {
  const { numero } = await params;
  const contest = resolveIntegerParam(numero, 1, MAX_CONTEST_NUMBER, (value) => `/concurso/${value}`);
  const page = await loadDrawPage(contest);
  if (!page) {
    notFound();
  }
  return page;
}

function breadcrumbsFor({ draw }: DrawPage): BreadcrumbItem[] {
  const year = draw.drawDate.slice(0, 4);
  return [
    { name: 'Início', url: '/' },
    { name: 'Resultados', url: '/resultados' },
    { name: year, url: `/resultados/${year}` },
    { name: `Concurso ${draw.contestNumber}`, url: `/concurso/${draw.contestNumber}` },
  ];
}

export async function generateMetadata({ params }: DrawRouteProps): Promise<Metadata> {
  const page = await getDrawPage(params);
  const { draw } = page;
  const date = formatDate(draw.drawDate);
  const dezenas = draw.numbers.map(dezena);

  return buildPageMetadata({
    path: `/concurso/${draw.contestNumber}`,
    title: `Resultado da Mega-Sena ${draw.contestNumber} (${date}): ${dezenas.join('-')}`,
    description: `Resultado do concurso ${draw.contestNumber} da Mega-Sena (${date}): ${joinPtBr(
      dezenas
    )}. ${senaOutcome(draw)}`,
    absoluteTitle: true,
    socialImages: {
      openGraph: `/concurso/${draw.contestNumber}/opengraph-image`,
      twitter: `/concurso/${draw.contestNumber}/twitter-image`,
      alt: `Dezenas sorteadas no concurso ${draw.contestNumber} da Mega-Sena: ${joinPtBr(dezenas)}`,
    },
  });
}

export default async function DrawResultPage({ params }: DrawRouteProps): Promise<React.JSX.Element> {
  const page = await getDrawPage(params);
  const { draw, previous, next, numberHistory, sumContext } = page;
  const contest = draw.contestNumber;
  const path = `/concurso/${contest}`;
  const year = draw.drawDate.slice(0, 4);
  const date = formatDate(draw.drawDate);
  const dezenas = draw.numbers.map(dezena);
  const insights = describeDraw(draw.numbers, previous?.numbers ?? null);
  const breadcrumbs = breadcrumbsFor(page);
  const estimateVerb = next ? 'era' : 'é';
  const comeback = longestComeback(numberHistory);

  const prizeFacts: Fact[] = [
    ...(draw.totalCollection !== null
      ? [{ term: 'Arrecadação total', value: formatCurrency(draw.totalCollection) }]
      : []),
    ...(draw.accumulated && draw.accumulatedValue !== null
      ? [{ term: `Acumulado para o concurso ${contest + 1}`, value: formatCurrency(draw.accumulatedValue) }]
      : []),
    ...(draw.nextEstimatedPrize !== null
      ? [{ term: `Estimativa para o concurso ${contest + 1}`, value: formatCurrency(draw.nextEstimatedPrize) }]
      : []),
  ];

  const analysisFacts: Fact[] = [
    {
      term: 'Soma das dezenas',
      value: formatNumber(insights.sum),
      ...(sumContext.earlierDraws > 0
        ? {
            hint: `Maior que a soma de ${formatPercentPtBr(
              sumContext.lowerSum,
              sumContext.earlierDraws,
              0
            )} dos ${formatNumber(sumContext.earlierDraws)} concursos anteriores.`,
          }
        : {}),
    },
    {
      term: 'Pares e ímpares',
      value: `${countLabel(insights.even, 'par', 'pares')} · ${countLabel(insights.odd, 'ímpar', 'ímpares')}`,
    },
    {
      term: 'Baixas e altas',
      value: `${countLabel(insights.low, 'baixa', 'baixas')} · ${countLabel(insights.high, 'alta', 'altas')}`,
      hint: 'Baixas vão de 01 a 30; altas, de 31 a 60.',
    },
    {
      term: 'Números primos',
      value:
        insights.primes.length === 0
          ? 'Nenhum'
          : `${insights.primes.length} (${joinPtBr(insights.primes.map(dezena))})`,
    },
    {
      term: 'Repetidas do concurso anterior',
      value:
        insights.repeatedFromPrevious === null
          ? '—'
          : insights.repeatedFromPrevious.length === 0
            ? 'Nenhuma'
            : joinPtBr(insights.repeatedFromPrevious.map(dezena)),
      ...(insights.repeatedFromPrevious === null ? { hint: 'Este é o primeiro concurso do arquivo.' } : {}),
    },
    {
      term: 'Dezenas consecutivas',
      value:
        insights.consecutivePairs.length === 0
          ? 'Nenhuma'
          : joinPtBr(insights.consecutivePairs.map(([a, b]) => `${dezena(a)}–${dezena(b)}`)),
    },
  ];

  const prizeRows = [
    { label: 'Sena', hits: 6, tier: draw.sena },
    { label: 'Quina', hits: 5, tier: draw.quina },
    { label: 'Quadra', hits: 4, tier: draw.quadra },
  ] as const;

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageJsonLd
        path={path}
        name={`Resultado da Mega-Sena ${contest}`}
        description={`Dezenas, ganhadores e prêmios do concurso ${contest} da Mega-Sena, sorteado em ${date}.`}
        breadcrumbs={breadcrumbs}
        datePublished={draw.drawDate}
        dateModified={page.lastModified}
      />

      <header className="space-y-5">
        <Breadcrumbs items={breadcrumbs} />
        <div className="space-y-2">
          <PageTitle>Resultado da Mega-Sena {contest}</PageTitle>
          <p className="text-muted-foreground">
            Sorteio de {weekdayPtBr(draw.drawDate)}, <span className="tabular-nums">{date}</span> ·
            resultado oficial publicado pela CAIXA
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {draw.numbers.map((number) => (
            <NumberBallLink key={number} number={number} size="lg" />
          ))}
        </div>
        <AnswerSummary>
          O concurso {contest} da Mega-Sena foi sorteado em {date}. As dezenas sorteadas foram{' '}
          {joinPtBr(dezenas)}. {senaOutcome(draw)}
          {comeback
            ? ` A dezena ${dezena(comeback.number)} voltou depois de ${countLabel(comeback.gap, 'concurso', 'concursos')} sem sair.`
            : ''}
          {draw.nextEstimatedPrize !== null
            ? ` A estimativa de prêmio para o concurso ${contest + 1} ${estimateVerb} de ${formatCurrency(
                draw.nextEstimatedPrize
              )}.`
            : ''}
        </AnswerSummary>
      </header>

      <section aria-labelledby="premiacao" className="space-y-4">
        <SectionHeading id="premiacao">Premiação</SectionHeading>
        <TableFrame>
          <table className={tableClass}>
            <caption className="sr-only">Premiação do concurso {contest}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Faixa</th>
                <th scope="col" className={thClass}>Apostas ganhadoras</th>
                <th scope="col" className={thClass}>Prêmio por aposta</th>
              </tr>
            </thead>
            <tbody>
              {prizeRows.map(({ label, hits, tier }) => (
                <tr key={label}>
                  <th scope="row" className={`${cellClass} font-medium`}>
                    {label} <span className="font-normal text-muted-foreground">({hits} acertos)</span>
                  </th>
                  <td className={cellClass}>{tier.winners === 0 ? 'Nenhuma' : formatNumber(tier.winners)}</td>
                  <td className={cellClass}>
                    {tier.winners > 0
                      ? formatCurrency(tier.prize)
                      : label === 'Sena'
                        ? 'Acumulou'
                        : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
        {prizeFacts.length > 0 ? <FactList facts={prizeFacts} /> : null}
      </section>

      <section aria-labelledby="analise" className="space-y-4">
        <SectionHeading id="analise">Análise do sorteio</SectionHeading>
        <FactList facts={analysisFacts} />
      </section>

      <section aria-labelledby="historico" className="space-y-4">
        <SectionHeading id="historico">As dezenas no histórico até este concurso</SectionHeading>
        <p className="max-w-[70ch] text-muted-foreground">
          Quantas vezes cada dezena tinha saído até o concurso {contest}, e há quantos concursos ela
          não aparecia antes deste sorteio.
        </p>
        <TableFrame>
          <table className={tableClass}>
            <caption className="sr-only">Histórico das dezenas até o concurso {contest}</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Dezena</th>
                <th scope="col" className={thClass}>Vezes sorteada</th>
                <th scope="col" className={thClass}>Aparição anterior</th>
                <th scope="col" className={thClass}>Concursos sem sair</th>
              </tr>
            </thead>
            <tbody>
              {numberHistory.map((entry) => (
                <tr key={entry.number}>
                  <th scope="row" className={cellClass}>
                    <ArchiveLink href={`/numeros/${entry.number}`} className={inlineLinkClass}>
                      {dezena(entry.number)}
                    </ArchiveLink>
                  </th>
                  <td className={cellClass}>{formatNumber(entry.timesDrawn)}</td>
                  <td className={cellClass}>
                    {entry.previous ? (
                      <>
                        <ArchiveLink
                          href={`/concurso/${entry.previous.contestNumber}`}
                          className={inlineLinkClass}
                        >
                          {entry.previous.contestNumber}
                        </ArchiveLink>{' '}
                        <span className="text-muted-foreground">
                          ({formatDate(entry.previous.drawDate)})
                        </span>
                      </>
                    ) : (
                      'Primeira vez'
                    )}
                  </td>
                  <td className={cellClass}>
                    {entry.previous ? formatNumber(entry.previous.drawsBetween) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
      </section>

      <Pager
        label="Concursos vizinhos"
        previous={
          previous
            ? { href: `/concurso/${previous.contestNumber}`, label: 'Concurso anterior', detail: `#${previous.contestNumber}` }
            : null
        }
        next={
          next
            ? { href: `/concurso/${next.contestNumber}`, label: 'Próximo concurso', detail: `#${next.contestNumber}` }
            : null
        }
      />

      <nav aria-label="Mais resultados" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <ArchiveLink href={`/resultados/${year}`} className={inlineLinkClass}>
          Todos os concursos de {year}
        </ArchiveLink>
        <ArchiveLink href="/resultados" className={inlineLinkClass}>
          Arquivo de resultados
        </ArchiveLink>
        <ArchiveLink href="/numeros" className={inlineLinkClass}>
          Frequência de todos os números
        </ArchiveLink>
      </nav>

      <RandomnessNote />
    </div>
  );
}
