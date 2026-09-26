import type { Metadata } from 'next';
import type { NumberSummary } from '@/lib/api/archive-contract';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { formatNumber } from '@/lib/utils';
import { loadNumbersIndex } from '@/app/_lib/archive';
import { countLabel, dezena, formatPercentPtBr, joinPtBr } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveFreshness,
  ArchiveLink,
  Breadcrumbs,
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

interface RankedEntry {
  number: number;
  detail: string;
}

function RankedList({ label, entries }: { label: string; entries: RankedEntry[] }): React.JSX.Element {
  return (
    <ol aria-label={label} className="divide-y divide-border rounded-xl border border-border bg-card">
      {entries.map((entry, index) => (
        <li key={entry.number} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-6 text-right tabular-nums text-muted-foreground">{index + 1}º</span>
          <ArchiveLink href={`/numeros/${entry.number}`} className={inlineLinkClass}>
            {dezena(entry.number)}
          </ArchiveLink>
          <span className="ml-auto tabular-nums text-muted-foreground">{entry.detail}</span>
        </li>
      ))}
    </ol>
  );
}

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
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageJsonLd
        path={PATH}
        name="Números da Mega-Sena de 1 a 60"
        description={DESCRIPTION}
        breadcrumbs={BREADCRUMBS}
        type="CollectionPage"
        {...(archive.lastModified ? { dateModified: archive.lastModified } : {})}
      />

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
            <h3 className="font-medium">Números mais sorteados</h3>
            <RankedList
              label="Números mais sorteados"
              entries={[...numbers]
                .sort((a, b) => b.frequency - a.frequency || a.number - b.number)
                .slice(0, RANKED_SHOWN)
                .map((summary) => ({
                  number: summary.number,
                  detail: countLabel(summary.frequency, 'vez', 'vezes'),
                }))}
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Números mais atrasados</h3>
            <RankedList
              label="Números mais atrasados"
              entries={numbers
                .flatMap((summary) =>
                  summary.lastAppearance
                    ? [{ number: summary.number, drawsSince: summary.lastAppearance.drawsSince }]
                    : []
                )
                .sort((a, b) => b.drawsSince - a.drawsSince || a.number - b.number)
                .slice(0, RANKED_SHOWN)
                .map((entry) => ({
                  number: entry.number,
                  detail: countLabel(entry.drawsSince, 'concurso', 'concursos'),
                }))}
            />
          </div>
        </div>
        <p className="max-w-[70ch] text-sm text-muted-foreground">
          O atraso não muda a chance do próximo sorteio: em todo concurso, cada dezena tem 10% de
          chance de sair. As listas descrevem o histórico; não são palpites.
        </p>
      </section>

      <section aria-labelledby="grade" className="space-y-4">
        <SectionHeading id="grade">Escolha um número</SectionHeading>
        <ul className="grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-10">
          {numbers.map((summary) => (
            <li key={summary.number} className="flex flex-col items-center gap-1">
              <NumberBallLink number={summary.number} size="sm" />
              <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(summary.frequency)}x
              </span>
              <span className="sr-only">{countLabel(summary.frequency, 'vez', 'vezes')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tabela" className="space-y-4">
        <SectionHeading id="tabela">Frequência e atraso de cada número</SectionHeading>
        <TableFrame>
          <table className={tableClass}>
            <caption className="sr-only">Frequência e atraso dos números de 1 a 60</caption>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Número</th>
                <th scope="col" className={thClass}>Vezes</th>
                <th scope="col" className={thClass}>% dos concursos</th>
                <th scope="col" className={thClass}>Ranking</th>
                <th scope="col" className={thClass}>Atraso</th>
                <th scope="col" className={thClass}>Última vez</th>
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
                  <td className={cellClass}>{formatNumber(summary.frequency)}</td>
                  <td className={cellClass}>{formatPercentPtBr(summary.frequency, archive.totalDraws)}</td>
                  <td className={cellClass}>{summary.rank}º</td>
                  <td className={cellClass}>
                    {summary.lastAppearance ? formatNumber(summary.lastAppearance.drawsSince) : '—'}
                  </td>
                  <td className={cellClass}>
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
