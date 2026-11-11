import type { Metadata } from 'next';
import type { NumberSummary } from '@/lib/api/archive-contract';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { cn, formatNumber } from '@/lib/utils';
import { Bar } from '@/components/figures';
import { loadNumbersIndex } from '@/app/_lib/archive';
import { countLabel, dezena, formatPercentPtBr, joinPtBr } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveFreshness,
  ArchiveLink,
  FrequencyGrid,
  Breadcrumbs,
  PageTitle,
  RandomnessNote,
  RankedList,
  rankBy,
  SectionHeading,
  TableFrame,
  cellClass,
  inlineLinkClass,
  tableClass,
  thClass,
  phoneLineClass,
  wideCellClass,
} from '@/app/_components/archive-ui';
import { EdgeCacheable } from '@/app/_components/edge-cacheable';

const PATH = '/numeros';
const TITLE = 'Números da Mega-Sena: frequência e atraso de 1 a 60';
const DESCRIPTION =
  'Frequência, posição no ranking e atraso de cada número da Mega-Sena, de 01 a 60, calculados sobre todos os concursos. Veja os mais e os menos sorteados.';
const BREADCRUMBS: BreadcrumbItem[] = [
  { name: 'Início', url: '/' },
  { name: 'Números', url: PATH },
];
const TIES_LISTED = 5;
const RANKED_SHOWN = 10;

export const metadata: Metadata = buildPageMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  absoluteTitle: true,
});

/** "o mais sorteado é o 10 (356 vezes)" or "os mais sorteados são 04, 10 e 53 (300 vezes cada)" */
function describeExtreme(
  numbers: NumberSummary[],
  frequency: number,
  degree: 'mais' | 'menos'
): string {
  const tied = numbers.filter((summary) => summary.frequency === frequency);
  const times = countLabel(frequency, 'vez', 'vezes');
  const first = tied[0];
  if (tied.length === 1 && first) {
    return `o ${degree} sorteado é o ${dezena(first.number)} (${times})`;
  }
  const listed = tied.slice(0, TIES_LISTED).map((summary) => dezena(summary.number));
  const remainder = tied.length - listed.length;
  const list = remainder > 0 ? `${listed.join(', ')} e mais ${remainder}` : joinPtBr(listed);
  return `os ${degree} sorteados são ${list} (${times} cada)`;
}

export default async function NumbersHubPage(): Promise<React.JSX.Element> {
  const { archive, numbers } = await loadNumbersIndex();
  const frequencies = numbers.map((summary) => summary.frequency);
  const maxFrequency = Math.max(...frequencies);
  const minFrequency = Math.min(...frequencies);

  return (
    <div className="space-y-16 lg:space-y-20">
      <PageJsonLd
        path={PATH}
        name="Números da Mega-Sena de 1 a 60"
        description={DESCRIPTION}
        breadcrumbs={BREADCRUMBS}
        type="CollectionPage"
        {...(archive.lastModified ? { dateModified: archive.lastModified } : {})}
      />
      <EdgeCacheable />

      <header className="space-y-5">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageTitle>Números da Mega-Sena de 1 a 60</PageTitle>
        <AnswerSummary>
          Em {countLabel(archive.totalDraws, 'concurso', 'concursos')},{' '}
          {describeExtreme(numbers, maxFrequency, 'mais')} e{' '}
          {describeExtreme(numbers, minFrequency, 'menos')}.
        </AnswerSummary>
        <ArchiveFreshness archive={archive} />
      </header>

      <section aria-labelledby="rankings" className="space-y-4">
        <SectionHeading id="rankings">Mais sorteados e mais atrasados</SectionHeading>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 id="mais-sorteados" className="text-lg font-semibold">
              Números mais sorteados
            </h3>
            <RankedList
              labelId="mais-sorteados"
              entries={rankBy(
                RANKED_SHOWN,
                numbers,
                (summary) => summary.frequency,
                (summary) => countLabel(summary.frequency, 'vez', 'vezes')
              )}
            />
          </div>
          <div className="space-y-2">
            <h3 id="mais-atrasados" className="text-lg font-semibold">
              Números mais atrasados
            </h3>
            <RankedList
              labelId="mais-atrasados"
              entries={rankBy(
                RANKED_SHOWN,
                numbers,
                // A number never drawn has been absent for the whole archive.
                (summary) => summary.lastAppearance?.drawsSince ?? archive.totalDraws + 1,
                (summary) =>
                  summary.lastAppearance
                    ? `sem sair há ${countLabel(summary.lastAppearance.drawsSince, 'concurso', 'concursos')}`
                    : 'nunca sorteado'
              )}
            />
          </div>
        </div>
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          O atraso não muda a chance do próximo sorteio: em todo concurso, cada dezena tem 10% de
          chance de sair. As listas descrevem o histórico; não são palpites.
        </p>
      </section>

      <section aria-labelledby="grade" className="space-y-4">
        <SectionHeading id="grade">Escolha um número</SectionHeading>
        <FrequencyGrid entries={numbers} label="Frequência de cada número de 01 a 60" />
      </section>

      <section aria-labelledby="tabela" className="space-y-4">
        <SectionHeading id="tabela">Frequência e atraso de cada número</SectionHeading>
        <TableFrame label="Frequência e atraso dos números de 1 a 60">
          <table className={tableClass}>
            <caption className="sr-only">Frequência e atraso dos números de 1 a 60</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  Número
                </th>
                <th scope="col" className={cn(thClass, 'w-2/5 text-right')}>
                  Vezes
                </th>
                <th scope="col" className={cn(thClass, wideCellClass, 'text-right')}>
                  % dos concursos
                </th>
                <th scope="col" className={cn(thClass, wideCellClass, 'text-right')}>
                  Ranking
                </th>
                <th scope="col" className={cn(thClass, 'text-right')}>
                  Atraso
                </th>
                <th scope="col" className={cn(thClass, wideCellClass, 'text-right')}>
                  Última vez
                </th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((summary) => (
                <tr key={summary.number}>
                  <th scope="row" className={cellClass}>
                    <ArchiveLink href={`/numeros/${summary.number}`} className={inlineLinkClass}>
                      {dezena(summary.number)}
                    </ArchiveLink>
                  </th>
                  <td className={cellClass}>
                    <span className="grid grid-cols-[minmax(2rem,1fr)_4ch] items-center gap-3">
                      <Bar value={summary.frequency} max={maxFrequency} />
                      <span className="text-right">{formatNumber(summary.frequency)}</span>
                    </span>
                    <span className={cn(phoneLineClass, 'mt-0.5 text-right')}>
                      {formatPercentPtBr(summary.frequency, archive.totalDraws)} · {summary.rank}º
                      lugar
                    </span>
                  </td>
                  <td className={cn(cellClass, wideCellClass, 'text-right')}>
                    {formatPercentPtBr(summary.frequency, archive.totalDraws)}
                  </td>
                  <td className={cn(cellClass, wideCellClass, 'text-right')}>{summary.rank}º</td>
                  <td className={cn(cellClass, 'text-right')}>
                    {summary.lastAppearance ? formatNumber(summary.lastAppearance.drawsSince) : '—'}
                    {summary.lastAppearance ? (
                      <span className={phoneLineClass}>
                        último no{' '}
                        <ArchiveLink
                          href={`/concurso/${summary.lastAppearance.contestNumber}`}
                          className={inlineLinkClass}
                        >
                          {summary.lastAppearance.contestNumber}
                        </ArchiveLink>
                      </span>
                    ) : null}
                  </td>
                  <td className={cn(cellClass, wideCellClass, 'text-right')}>
                    {summary.lastAppearance ? (
                      <ArchiveLink
                        href={`/concurso/${summary.lastAppearance.contestNumber}`}
                        className={inlineLinkClass}
                      >
                        {summary.lastAppearance.contestNumber}
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
      </section>

      <RandomnessNote>
        Cada dezena tem sempre 10% de chance de sair em um concurso (6 de 60). Diferenças de
        frequência entre os números são esperadas em sorteios aleatórios e não indicam tendência.
      </RandomnessNote>
    </div>
  );
}
