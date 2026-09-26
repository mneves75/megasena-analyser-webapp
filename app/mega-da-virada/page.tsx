import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import { countNumbers, groupByCount } from '@/lib/analytics/mega-da-virada';
import type { MegaDaViradaArchive } from '@/lib/api/archive-contract';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { loadMegaDaVirada } from '@/app/_lib/archive';
import { countLabel, dezena, joinPtBr, senaOutcome } from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  Breadcrumbs,
  DezenaChips,
  FactList,
  NumberBallLink,
  PageTitle,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  cellClass,
  inlineLinkClass,
  tableClass,
  textLinkClass,
  thClass,
  type Fact,
} from '@/app/_components/archive-ui';

const PATH = '/mega-da-virada';
const HEADING = 'Mega da Virada: todos os resultados';
const DESCRIPTION =
  'Resultados de todas as edições da Mega da Virada: dezenas, apostas ganhadoras e prêmio de cada edição, as dezenas que mais saíram e as regras oficiais da CAIXA.';
const CAIXA_RULES_URL = 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx';
const BREADCRUMBS: BreadcrumbItem[] = [
  { name: 'Início', url: '/' },
  { name: 'Resultados', url: '/resultados' },
  { name: 'Mega da Virada', url: PATH },
];

type Edition = MegaDaViradaArchive['editions'][number];

export async function generateMetadata(): Promise<Metadata> {
  const { editions } = await loadMegaDaVirada();
  const first = editions.at(-1);
  return buildPageMetadata({
    path: PATH,
    title: first
      ? `Mega da Virada: resultados de todas as edições desde ${first.edition}`
      : 'Mega da Virada: resultados de todas as edições',
    description: DESCRIPTION,
    absoluteTitle: true,
  });
}

/** The edition with the highest value; the newest one wins a tie. */
function highest(editions: readonly Edition[], value: (edition: Edition) => number): Edition | undefined {
  return editions.reduce<Edition | undefined>(
    (best, edition) => (best === undefined || value(edition) > value(best) ? edition : best),
    undefined
  );
}

const senaTotal = (edition: Edition): number => edition.draw.sena.prize * edition.draw.sena.winners;

const timesLabel = (count: number): string => countLabel(count, 'vez', 'vezes');

/**
 * "As dezenas 10 e 33 saíram 5 vezes cada; a dezena 05 saiu 4 vezes. Nunca
 * saíram na Virada as dezenas …". Null while no number has come up twice.
 */
function frequencySentence(
  groups: ReturnType<typeof groupByCount>,
  neverDrawn: readonly number[]
): string | null {
  const repeated = groups.filter((group) => group.count > 1).slice(0, 2);
  if (repeated.length === 0) {
    return null;
  }
  const clauses = repeated.map(({ count, numbers }) =>
    numbers.length === 1
      ? `a dezena ${dezena(numbers[0] ?? 0)} saiu ${timesLabel(count)}`
      : `as dezenas ${joinPtBr(numbers.map(dezena))} saíram ${timesLabel(count)} cada`
  );
  const sentence = clauses.join('; ');
  const never =
    neverDrawn.length === 0 || neverDrawn.length > 12
      ? ''
      : neverDrawn.length === 1
        ? ` Nunca saiu na Virada a dezena ${dezena(neverDrawn[0] ?? 0)}.`
        : ` Nunca saíram na Virada as dezenas ${joinPtBr(neverDrawn.map(dezena))}.`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${never}`;
}

function recordFacts(editions: readonly Edition[]): Fact[] {
  const first = editions.at(-1);
  const latest = editions[0];
  const topPrize = highest(editions, (edition) => edition.draw.sena.prize);
  const topTotal = highest(editions, senaTotal);
  const mostWinners = highest(editions, (edition) => edition.draw.sena.winners);
  if (!first || !latest || !topPrize || !topTotal || !mostWinners) {
    return [];
  }
  return [
    {
      term: 'Edições no arquivo',
      value: formatNumber(editions.length),
      hint: `De ${first.edition} a ${latest.edition}.`,
    },
    {
      term: 'Maior prêmio por aposta',
      value: formatCurrency(topPrize.draw.sena.prize),
      hint: `Edição de ${topPrize.edition}, com ${countLabel(topPrize.draw.sena.winners, 'aposta ganhadora', 'apostas ganhadoras')}.`,
    },
    {
      term: 'Maior prêmio total da sena',
      value: formatCurrency(senaTotal(topTotal)),
      hint: `Edição de ${topTotal.edition}: prêmio por aposta vezes as apostas ganhadoras.`,
    },
    {
      term: 'Mais apostas ganhadoras',
      value: formatNumber(mostWinners.draw.sena.winners),
      hint: `Edição de ${mostWinners.edition}, com ${formatCurrency(mostWinners.draw.sena.prize)} para cada aposta.`,
    },
  ];
}

export default async function MegaDaViradaPage(): Promise<React.JSX.Element> {
  const { editions, lastModified } = await loadMegaDaVirada();
  const latest = editions[0] ?? null;
  const first = editions.at(-1) ?? null;
  const everyEditionHadWinners = editions.every((edition) => edition.draw.sena.winners > 0);
  const counts = countNumbers(editions.map((edition) => edition.draw));
  const mostDrawn = frequencySentence(
    groupByCount(counts),
    counts.filter((entry) => entry.count === 0).map((entry) => entry.number)
  );
  const postponed = editions.filter((edition) => edition.draw.drawDate.slice(0, 4) !== String(edition.edition));

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageJsonLd
        path={PATH}
        name={HEADING}
        description={DESCRIPTION}
        breadcrumbs={BREADCRUMBS}
        type="CollectionPage"
        {...(lastModified ? { dateModified: lastModified } : {})}
      />

      <header className="space-y-5">
        <Breadcrumbs items={BREADCRUMBS} />
        <PageTitle>{HEADING}</PageTitle>
        {latest ? (
          <AnswerSummary>
            A Mega da Virada mais recente do arquivo é a de {latest.edition}: concurso{' '}
            {latest.draw.contestNumber}, sorteado em {formatDate(latest.draw.drawDate)}, com as dezenas{' '}
            {joinPtBr(latest.draw.numbers.map(dezena))}. {senaOutcome(latest.draw)}
            {first && editions.length > 1
              ? ` O arquivo reúne ${editions.length} edições, de ${first.edition} a ${latest.edition}${
                  everyEditionHadWinners ? ', e todas tiveram apostas que acertaram as seis dezenas' : ''
                }.`
              : ''}
          </AnswerSummary>
        ) : (
          <AnswerSummary>Nenhuma edição da Mega da Virada está no arquivo no momento.</AnswerSummary>
        )}
        <p className="text-sm text-muted-foreground">Resultados oficiais publicados pela CAIXA.</p>
      </header>

      {latest ? (
        <section
          aria-labelledby="ultima"
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeading id="ultima">Mega da Virada {latest.edition}</SectionHeading>
            <span className="text-sm tabular-nums text-muted-foreground">
              Concurso {latest.draw.contestNumber} · {formatDate(latest.draw.drawDate)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {latest.draw.numbers.map((number) => (
              <NumberBallLink key={number} number={number} size="md" />
            ))}
          </div>
          <ArchiveLink href={`/concurso/${latest.draw.contestNumber}`} className={inlineLinkClass}>
            Ver prêmios e análise do concurso {latest.draw.contestNumber}
          </ArchiveLink>
        </section>
      ) : null}

      {editions.length > 1 ? <FactList facts={recordFacts(editions)} /> : null}

      {editions.length > 0 ? (
        <section aria-labelledby="edicoes" className="space-y-4">
          <SectionHeading id="edicoes">Resultados de todas as edições</SectionHeading>
          <TableFrame>
            <table className={cn(tableClass, 'min-w-[46rem]')}>
              <caption className="sr-only">Resultados de todas as edições da Mega da Virada</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Edição</th>
                  <th scope="col" className={thClass}>Concurso</th>
                  <th scope="col" className={thClass}>Data</th>
                  <th scope="col" className={thClass}>Dezenas</th>
                  <th scope="col" className={thClass}>Apostas ganhadoras</th>
                  <th scope="col" className={thClass}>Prêmio por aposta</th>
                </tr>
              </thead>
              <tbody>
                {editions.map(({ edition, draw }) => (
                  <tr key={draw.contestNumber}>
                    <th scope="row" className={`${cellClass} font-medium`}>{edition}</th>
                    <td className={cellClass}>
                      <ArchiveLink href={`/concurso/${draw.contestNumber}`} className={inlineLinkClass}>
                        {draw.contestNumber}
                      </ArchiveLink>
                    </td>
                    <td className={cellClass}>{formatDate(draw.drawDate)}</td>
                    <td className={cn(cellClass, 'min-w-[14rem]')}>
                      <DezenaChips numbers={draw.numbers} />
                    </td>
                    <td className={cellClass}>
                      {draw.sena.winners === 0 ? 'Nenhuma' : formatNumber(draw.sena.winners)}
                    </td>
                    <td className={cellClass}>
                      {draw.sena.winners > 0 ? formatCurrency(draw.sena.prize) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </section>
      ) : null}

      {editions.length > 0 ? (
        <section aria-labelledby="dezenas" className="space-y-4">
          <SectionHeading id="dezenas">Dezenas que mais saíram na Mega da Virada</SectionHeading>
          {mostDrawn ? <p className="max-w-[70ch]">{mostDrawn}</p> : null}
          <ul
            aria-label="Vezes que cada dezena saiu na Mega da Virada"
            className="grid grid-cols-5 gap-2 sm:grid-cols-10"
          >
            {counts.map(({ number, count }) => (
              <li
                key={number}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-2"
              >
                <ArchiveLink
                  href={`/numeros/${number}`}
                  className="font-semibold tabular-nums text-foreground underline-offset-4 hover:underline"
                  aria-label={`Dezena ${dezena(number)}: saiu ${timesLabel(count)} na Mega da Virada`}
                >
                  {dezena(number)}
                </ArchiveLink>
                <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
                  {count}×
                </span>
              </li>
            ))}
          </ul>
          <RandomnessNote>
            São só {countLabel(editions.length, 'sorteio', 'sorteios')}: uma dezena que saiu mais vezes na
            Virada não tem mais chance na próxima edição, e cada sorteio é independente.
          </RandomnessNote>
        </section>
      ) : null}

      <section aria-labelledby="regras" className="max-w-[75ch] space-y-3">
        <SectionHeading id="regras">Como funciona a Mega da Virada</SectionHeading>
        <p>
          Pelas regras da CAIXA, a Mega da Virada é o último concurso do ano com final 0 ou 5, sorteado
          em 31 de dezembro, com apostas próprias vendidas em novembro e dezembro. O prêmio principal
          não acumula: se ninguém acertar as seis dezenas, ele é dividido entre as apostas que
          acertaram cinco; sem quina, vai para a quadra.
        </p>
        <p>
          A sena da Virada recebe 90% do prêmio do próprio concurso e uma reserva formada ao longo do
          ano com 10% do prêmio bruto de cada concurso regular (
          <a href={CAIXA_RULES_URL} target="_blank" rel="noopener noreferrer" className={textLinkClass}>
            regras da Mega-Sena na CAIXA
          </a>
          ).
        </p>
        {postponed.map(({ edition, draw }) => (
          <p key={draw.contestNumber}>
            A edição de {edition} foi sorteada em {formatDate(draw.drawDate)}, e não em 31 de dezembro.
          </p>
        ))}
        <p>
          O último concurso de 2008 (
          <ArchiveLink href="/concurso/1035" className={inlineLinkClass}>
            concurso 1035
          </ArchiveLink>
          , em 31/12/2008) não entra nesta lista: ninguém acertou as seis dezenas e o prêmio acumulou
          para o concurso 1036, como em um concurso comum.
        </p>
      </section>

      <nav aria-label="Mais resultados" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <ArchiveLink href="/resultados" className={inlineLinkClass}>
          Arquivo de resultados
        </ArchiveLink>
        <ArchiveLink href="/numeros" className={inlineLinkClass}>
          Frequência de todos os números
        </ArchiveLink>
      </nav>
    </div>
  );
}
