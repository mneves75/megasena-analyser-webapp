import type { Metadata } from 'next';
import { LotteryBall } from '@/components/lottery-ball';
import type { NumberProfile } from '@/lib/api/archive-contract';
import { buildPageMetadata } from '@/lib/seo/metadata';
import type { BreadcrumbItem } from '@/lib/seo/schemas';
import { formatDate, formatNumber } from '@/lib/utils';
import { loadNumberProfile } from '@/app/_lib/archive';
import {
  countLabel,
  dezena,
  formatDecimal,
  formatPercentPtBr,
  resolveIntegerParam,
} from '@/app/_lib/format';
import {
  AnswerSummary,
  ArchiveLink,
  Breadcrumbs,
  FactList,
  NumberBallLink,
  PageStructuredData,
  Pager,
  RandomnessNote,
  SectionHeading,
  TableFrame,
  inlineLinkClass,
  tableClass,
  tdClass,
  thClass,
  type Fact,
} from '@/app/_components/archive-ui';

interface NumberRouteProps {
  params: Promise<{ numero: string }>;
}

async function getProfile(params: NumberRouteProps['params']): Promise<NumberProfile> {
  const { numero } = await params;
  const number = resolveIntegerParam(numero, 1, 60, (value) => `/numeros/${value}`);
  return loadNumberProfile(number);
}

function breadcrumbsFor(number: number): BreadcrumbItem[] {
  return [
    { name: 'Início', url: '/' },
    { name: 'Números', url: '/numeros' },
    { name: `Número ${number}`, url: `/numeros/${number}` },
  ];
}

export async function generateMetadata({ params }: NumberRouteProps): Promise<Metadata> {
  const profile = await getProfile(params);
  const { number, frequency, totalDraws, rank, currentDelay, lastContestNumber, lastDrawDate } =
    profile;
  const drawn = frequency > 0 && lastContestNumber !== null && lastDrawDate !== null;

  return buildPageMetadata({
    path: `/numeros/${number}`,
    title: !drawn
      ? `Número ${number} da Mega-Sena: ainda não sorteado`
      : currentDelay === 0
        ? `Número ${number} da Mega-Sena: saiu ${countLabel(frequency, 'vez', 'vezes')}, inclusive no último concurso`
        : `Número ${number} da Mega-Sena: saiu ${countLabel(frequency, 'vez', 'vezes')}, atraso de ${countLabel(
            currentDelay ?? 0,
            'concurso',
            'concursos'
          )}`,
    description: drawn
      ? `O número ${number} saiu ${countLabel(frequency, 'vez', 'vezes')} em ${countLabel(
          totalDraws,
          'concurso',
          'concursos'
        )} da Mega-Sena (${formatPercentPtBr(frequency, totalDraws)}), ${rank}º mais sorteado. Última vez no concurso ${lastContestNumber} (${formatDate(
          lastDrawDate
        )}).`
      : `O número ${number} ainda não saiu em nenhum dos ${countLabel(
          totalDraws,
          'concurso',
          'concursos'
        )} da Mega-Sena registrados. Veja a frequência de todos os números de 01 a 60.`,
    absoluteTitle: true,
  });
}

export default async function NumberPage({ params }: NumberRouteProps): Promise<React.JSX.Element> {
  const profile = await getProfile(params);
  const {
    number,
    frequency,
    totalDraws,
    rank,
    currentDelay,
    lastContestNumber,
    lastDrawDate,
    averageInterval,
    longestGap,
    appearances,
    companions,
    lastArchiveDrawDate,
  } = profile;
  const path = `/numeros/${number}`;
  const breadcrumbs = breadcrumbsFor(number);

  const facts: Fact[] = [
    {
      term: 'Vezes sorteado',
      value: formatNumber(frequency),
      hint: `Se todos os números saíssem igualmente: ${formatDecimal(totalDraws / 10)} vezes.`,
    },
    {
      term: 'Posição no ranking',
      value: `${rank}º de 60`,
      hint: '1º é o número que mais saiu.',
    },
    {
      term: 'Atraso atual',
      value: currentDelay === null ? '—' : countLabel(currentDelay, 'concurso', 'concursos'),
      hint: 'Concursos desde a última vez que saiu.',
    },
    {
      term: 'Intervalo médio',
      value: averageInterval === null ? '—' : `${formatDecimal(averageInterval)} concursos`,
      hint: 'Média de concursos entre duas aparições.',
    },
    {
      term: 'Maior sequência sem sair',
      value: longestGap === null ? '—' : countLabel(longestGap, 'concurso', 'concursos'),
    },
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-12 px-4 py-8">
      <PageStructuredData
        path={path}
        name={`Número ${number} na Mega-Sena`}
        description={`Frequência, atraso e histórico do número ${dezena(number)} na Mega-Sena.`}
        breadcrumbs={breadcrumbs}
        {...(lastArchiveDrawDate ? { dateModified: lastArchiveDrawDate } : {})}
      />

      <header className="space-y-5">
        <Breadcrumbs items={breadcrumbs} />
        <div className="flex flex-wrap items-center gap-5">
          <LotteryBall number={number} size="lg" />
          <h1 className="text-balance font-title text-3xl font-bold tracking-tight sm:text-4xl">
            Número {number} na Mega-Sena
          </h1>
        </div>
        <AnswerSummary>
          {frequency > 0 && lastContestNumber !== null && lastDrawDate !== null ? (
            <>
              O número {number} saiu {countLabel(frequency, 'vez', 'vezes')} em{' '}
              {countLabel(totalDraws, 'concurso', 'concursos')} da Mega-Sena, ou seja, em{' '}
              {formatPercentPtBr(frequency, totalDraws)} dos sorteios. A última vez foi no concurso{' '}
              {lastContestNumber}, em {formatDate(lastDrawDate)}
              {currentDelay === 0
                ? ', o sorteio mais recente do arquivo.'
                : `; desde então, passaram-se ${countLabel(currentDelay ?? 0, 'concurso', 'concursos')}.`}
            </>
          ) : (
            <>
              O número {number} ainda não saiu em nenhum dos{' '}
              {countLabel(totalDraws, 'concurso', 'concursos')} registrados.
            </>
          )}
        </AnswerSummary>
      </header>

      <section aria-labelledby="indicadores" className="space-y-4">
        <SectionHeading id="indicadores">Indicadores do número {dezena(number)}</SectionHeading>
        <FactList facts={facts} />
      </section>

      {appearances.length > 0 ? (
        <section aria-labelledby="aparicoes" className="space-y-4">
          <SectionHeading id="aparicoes">Últimas aparições</SectionHeading>
          <TableFrame>
            <table className={tableClass}>
              <caption className="sr-only">Últimas vezes que o {number} saiu</caption>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>Concurso</th>
                  <th scope="col" className={thClass}>Data</th>
                </tr>
              </thead>
              <tbody>
                {appearances.map((appearance) => (
                  <tr key={appearance.contestNumber}>
                    <td className={tdClass}>
                      <ArchiveLink href={`/concurso/${appearance.contestNumber}`} className={inlineLinkClass}>
                        {appearance.contestNumber}
                      </ArchiveLink>
                    </td>
                    <td className={tdClass}>{formatDate(appearance.drawDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </section>
      ) : null}

      {companions.length > 0 ? (
        <section aria-labelledby="parceiras" className="space-y-4">
          <SectionHeading id="parceiras">Dezenas que mais saíram junto com o {dezena(number)}</SectionHeading>
          <ul className="flex flex-wrap gap-4">
            {companions.map((companion) => (
              <li key={companion.number} className="flex flex-col items-center gap-1">
                <NumberBallLink number={companion.number} />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {countLabel(companion.count, 'vez', 'vezes')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Pager
        label="Números vizinhos"
        previous={
          number > 1
            ? { href: `/numeros/${number - 1}`, label: 'Número anterior', detail: `Número ${number - 1}` }
            : null
        }
        next={
          number < 60
            ? { href: `/numeros/${number + 1}`, label: 'Próximo número', detail: `Número ${number + 1}` }
            : null
        }
      />

      <nav aria-label="Mais estatísticas" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <ArchiveLink href="/numeros" className={inlineLinkClass}>
          Todos os números de 01 a 60
        </ArchiveLink>
        <ArchiveLink href="/dashboard/statistics" className={inlineLinkClass}>
          Estatísticas detalhadas
        </ArchiveLink>
        <ArchiveLink href="/resultados" className={inlineLinkClass}>
          Resultados de todos os concursos
        </ArchiveLink>
      </nav>

      <RandomnessNote>
        Cada dezena tem sempre 10% de chance de sair em um concurso (6 de 60), não importa quantas
        vezes saiu antes. Frequência e atraso descrevem o passado.
      </RandomnessNote>
    </div>
  );
}
