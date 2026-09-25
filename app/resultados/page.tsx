import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { generateResultsDatasetSchema, type BreadcrumbItem } from '@/lib/seo/schemas';
import { formatDate, formatNumber } from '@/lib/utils';
import { loadArchiveIndex } from '@/app/_lib/archive';
import { countLabel, dezena, joinPtBr, senaOutcome } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  Breadcrumbs,
  DezenaChips,
  NumberBallLink,
  PageStructuredData,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  inlineLinkClass,
  tableClass,
  tdClass,
  thClass,
} from '@/app/_components/archive-ui';

const PATH = '/resultados';
const DESCRIPTION =
  'Resultado do último concurso da Mega-Sena e o arquivo completo de sorteios desde 1996, com dezenas, ganhadores e prêmios de cada concurso, organizado por ano.';
const BREADCRUMBS: BreadcrumbItem[] = [
  { name: 'Início', url: '/' },
  { name: 'Resultados', url: PATH },
];

export const metadata: Metadata = buildPageMetadata({
  path: PATH,
  title: 'Resultados da Mega-Sena: último concurso e histórico',
  description: DESCRIPTION,
});

export default async function ResultsHubPage(): Promise<React.JSX.Element> {
  const { totalDraws, recent, years } = await loadArchiveIndex();
  const latest = recent[0] ?? null;
  const oldestYear = years.at(-1);
  const newestYear = years[0];

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageStructuredData
        path={PATH}
        name="Resultados da Mega-Sena"
        description={DESCRIPTION}
        breadcrumbs={BREADCRUMBS}
        type="CollectionPage"
        {...(latest ? { dateModified: latest.drawDate } : {})}
        extra={
          oldestYear && newestYear
            ? [
                generateResultsDatasetSchema({
                  path: PATH,
                  totalDraws,
                  firstDrawDate: oldestYear.firstDrawDate,
                  lastDrawDate: newestYear.lastDrawDate,
                }),
              ]
            : []
        }
      />

      <header className="space-y-5">
        <Breadcrumbs items={BREADCRUMBS} />
        <h1 className="text-balance font-title text-3xl font-bold tracking-tight sm:text-4xl">
          Resultados da Mega-Sena
        </h1>
        {latest ? (
          <AnswerSummary>
            O resultado mais recente do arquivo é o do concurso {latest.contestNumber}, sorteado em{' '}
            {formatDate(latest.drawDate)}: {joinPtBr(latest.numbers.map(dezena))}. {senaOutcome(latest)} O
            arquivo reúne {countLabel(totalDraws, 'concurso', 'concursos')}
            {oldestYear ? ` desde ${oldestYear.year}` : ''}, com dados oficiais da CAIXA.
          </AnswerSummary>
        ) : (
          <AnswerSummary>O arquivo de resultados está temporariamente vazio.</AnswerSummary>
        )}
      </header>

      {latest ? (
        <section
          aria-labelledby="ultimo"
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeading id="ultimo">Concurso {latest.contestNumber}</SectionHeading>
            <span className="text-sm tabular-nums text-muted-foreground">{formatDate(latest.drawDate)}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {latest.numbers.map((number) => (
              <NumberBallLink key={number} number={number} size="md" />
            ))}
          </div>
          <ArchiveLink href={`/concurso/${latest.contestNumber}`} className={inlineLinkClass}>
            Ver prêmios e análise do concurso {latest.contestNumber}
          </ArchiveLink>
        </section>
      ) : null}

      {recent.length > 1 ? (
        <section aria-labelledby="recentes" className="space-y-4">
          <SectionHeading id="recentes">Últimos concursos</SectionHeading>
          <TableFrame>
            <table className={tableClass}>
              <caption className="sr-only">Últimos concursos da Mega-Sena</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Concurso</th>
                  <th scope="col" className={thClass}>Data</th>
                  <th scope="col" className={thClass}>Dezenas</th>
                  <th scope="col" className={thClass}>Sena</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((draw) => (
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
      ) : null}

      {years.length > 0 ? (
        <section aria-labelledby="anos" className="space-y-4">
          <SectionHeading id="anos">Resultados por ano</SectionHeading>
          <TableFrame>
            <table className={tableClass}>
              <caption className="sr-only">Resultados da Mega-Sena por ano</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Ano</th>
                  <th scope="col" className={thClass}>Concursos</th>
                  <th scope="col" className={thClass}>Primeiro</th>
                  <th scope="col" className={thClass}>Último</th>
                </tr>
              </thead>
              <tbody>
                {years.map((summary) => (
                  <tr key={summary.year}>
                    <th scope="row" className={tdClass}>
                      <ArchiveLink href={`/resultados/${summary.year}`} className={inlineLinkClass}>
                        {summary.year}
                      </ArchiveLink>
                    </th>
                    <td className={tdClass}>{formatNumber(summary.drawCount)}</td>
                    <td className={tdClass}>{summary.firstContest}</td>
                    <td className={tdClass}>{summary.lastContest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </section>
      ) : null}

      <nav aria-label="Mais estatísticas" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <ArchiveLink href="/numeros" className={inlineLinkClass}>
          Frequência de cada número
        </ArchiveLink>
        <ArchiveLink href="/dashboard/statistics" className={inlineLinkClass}>
          Estatísticas detalhadas
        </ArchiveLink>
      </nav>

      <RandomnessNote />
    </div>
  );
}
