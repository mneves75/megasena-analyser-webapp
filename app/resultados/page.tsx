import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { generateResultsDatasetSchema, type BreadcrumbItem } from '@/lib/seo/schemas';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { loadArchiveIndex } from '@/app/_lib/archive';
import { countLabel, dezena, joinPtBr, senaOutcome } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveFreshness,
  ArchiveLink,
  Breadcrumbs,
  DrawsTable,
  FactList,
  NumberBallLink,
  PageTitle,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  cellClass,
  inlineLinkClass,
  tableClass,
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
  absoluteTitle: true,
});

export default async function ResultsHubPage(): Promise<React.JSX.Element> {
  const { archive, recent, years } = await loadArchiveIndex();
  const latest = recent[0] ?? null;
  const oldestYear = years.at(-1);
  const newestYear = years[0];

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageJsonLd
        path={PATH}
        name="Resultados da Mega-Sena"
        description={DESCRIPTION}
        breadcrumbs={BREADCRUMBS}
        type="CollectionPage"
        {...(archive.lastModified ? { dateModified: archive.lastModified } : {})}
        extra={
          oldestYear && newestYear
            ? [
                generateResultsDatasetSchema({
                  path: PATH,
                  totalDraws: archive.totalDraws,
                  firstDrawDate: oldestYear.firstDrawDate,
                  lastDrawDate: newestYear.lastDrawDate,
                  dateModified: archive.lastModified,
                }),
              ]
            : []
        }
      />

      <header className="space-y-5">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageTitle>Resultados da Mega-Sena</PageTitle>
        {latest ? (
          <AnswerSummary>
            O resultado mais recente do arquivo é o do concurso {latest.contestNumber}, sorteado em{' '}
            {formatDate(latest.drawDate)}: {joinPtBr(latest.numbers.map(dezena))}. {senaOutcome(latest)} O
            arquivo reúne {countLabel(archive.totalDraws, 'concurso', 'concursos')}
            {oldestYear ? ` desde ${oldestYear.year}` : ''}, com dados oficiais da CAIXA.
          </AnswerSummary>
        ) : (
          <AnswerSummary>O arquivo de resultados está temporariamente vazio.</AnswerSummary>
        )}
        <ArchiveFreshness archive={archive} />
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

      {latest && latest.nextEstimatedPrize !== null ? (
        <section
          aria-labelledby="proximo"
          className="space-y-3 rounded-2xl border border-border bg-card p-6 sm:p-8"
        >
          <SectionHeading id="proximo">Próximo concurso</SectionHeading>
          <p className="font-title text-2xl font-semibold tabular-nums">
            Concurso {latest.contestNumber + 1}
          </p>
          <FactList
            facts={[
              {
                term: 'Prêmio estimado',
                value: formatCurrency(latest.nextEstimatedPrize),
                hint: `Valor informado pela CAIXA após o concurso ${latest.contestNumber}; o prêmio final depende da arrecadação.`,
              },
              ...(latest.accumulated && latest.accumulatedValue !== null
                ? [
                    {
                      term: 'Acumulado da sena',
                      value: formatCurrency(latest.accumulatedValue),
                      hint: `Ninguém acertou as seis dezenas no concurso ${latest.contestNumber}.`,
                    },
                  ]
                : []),
            ]}
          />
          <p className="text-sm text-muted-foreground">
            O prêmio estimado é uma estimativa da CAIXA, não uma previsão deste site. O acumulado é
            o valor que a CAIXA informou após o concurso {latest.contestNumber}.
          </p>
        </section>
      ) : null}

      {recent.length > 1 ? (
        <section aria-labelledby="recentes" className="space-y-4">
          <SectionHeading id="recentes">Últimos concursos</SectionHeading>
          <DrawsTable caption="Últimos concursos da Mega-Sena" draws={recent} />
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
                    <th scope="row" className={cellClass}>
                      <ArchiveLink href={`/resultados/${summary.year}`} className={inlineLinkClass}>
                        {summary.year}
                      </ArchiveLink>
                    </th>
                    <td className={cellClass}>{formatNumber(summary.drawCount)}</td>
                    <td className={cellClass}>{summary.firstContest}</td>
                    <td className={cellClass}>{summary.lastContest}</td>
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
