import type { Metadata } from 'next';
import { PageJsonLd } from '@/components/seo/page-json-ld';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api/api-fetch';
import { forwardedClientIpHeaders } from '@/lib/api/forwarded-client-ip';
import { logger } from '@/lib/logger';
import { formatCurrency, formatDate } from '@/lib/utils';
import { pt } from '@/lib/i18n';
import { generateFAQSchema } from '@/lib/seo/schemas';
import { buildPageMetadata } from '@/lib/seo/metadata';
import {
  ArchiveLink,
  RandomnessNote,
  SourceLine,
  textLinkClass,
} from '@/app/_components/archive-ui';
import { NumberField } from '@/components/number-field';

const homeFaqs = [
  {
    question: 'O que é o Mega-Sena Analyzer?',
    answer:
      'É uma ferramenta gratuita de análise estatística dos sorteios da Mega-Sena. Utiliza dados oficiais da API pública da CAIXA Econômica Federal para oferecer visualizações de frequência, padrões históricos e um gerador inteligente de apostas.',
  },
  {
    question: 'O Mega-Sena Analyzer aumenta minhas chances de ganhar?',
    answer:
      'Não. A Mega-Sena é puramente aleatória e cada sorteio é independente. Nenhuma análise estatística pode prever resultados futuros. A ferramenta é educacional e recreativa.',
  },
  {
    question: 'De onde vêm os dados dos sorteios?',
    answer:
      'Todos os dados são obtidos da API pública oficial da CAIXA Econômica Federal, que é a fonte autorizada dos resultados das loterias brasileiras.',
  },
  {
    question: 'Onde vejo o resultado de um concurso da Mega-Sena?',
    answer:
      'Na página Resultados, que mostra o concurso mais recente do arquivo e todos os anteriores, organizados por ano. Cada concurso tem uma página própria com as dezenas sorteadas, os ganhadores e o prêmio de cada faixa. A base é atualizada periodicamente com os dados oficiais da CAIXA.',
  },
  {
    question: 'Qual número mais saiu na Mega-Sena?',
    answer:
      'A página Números mostra quantas vezes cada número de 1 a 60 foi sorteado, sua posição no ranking e há quantos concursos ele não sai. As diferenças de frequência são esperadas em sorteios aleatórios e não indicam que um número tem mais chance no próximo concurso.',
  },
  {
    question: 'O serviço é gratuito?',
    answer:
      'Sim, totalmente gratuito. Não cobramos por nenhuma funcionalidade nem exigimos cadastro.',
  },
  {
    question: 'Como funciona o gerador de apostas?',
    answer:
      'O gerador utiliza um algoritmo de programação dinâmica que otimiza a alocação do seu orçamento entre apostas simples (6 números) e múltiplas (7-20 números), minimizando o desperdício de recursos.',
  },
] as const;

export const metadata: Metadata = buildPageMetadata({
  path: '/',
  title: pt.meta.home.title,
  description: pt.meta.home.description,
  socialDescription: pt.meta.home.openGraphDescription,
  absoluteTitle: true,
});

// Fetch the latest draw at request time so the hero reflects live data.
export const dynamic = 'force-dynamic';

interface LatestDraw {
  contestNumber: number;
  drawDate: string;
  numbers: number[];
  prizeSena: number;
  accumulated: boolean;
}

interface HomeSnapshot {
  latestDraw: LatestDraw | null;
  lastContestNumber: number | null;
}

async function getHomeSnapshot(): Promise<HomeSnapshot> {
  try {
    const response = await fetchApi('/api/dashboard', {
      headers: await forwardedClientIpHeaders(),
      cache: 'no-store',
      next: { revalidate: 0 },
      timeoutMs: 8000,
    });

    if (!response.ok) {
      throw new Error(`Home snapshot request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      statistics?: { lastContestNumber?: number };
      recentDraws?: LatestDraw[];
    };

    const latestDraw = data.recentDraws?.[0] ?? null;
    return {
      latestDraw,
      lastContestNumber: data.statistics?.lastContestNumber ?? latestDraw?.contestNumber ?? null,
    };
  } catch (error) {
    logger.warn('home.snapshot_fallback', {
      route: '/api/dashboard',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { latestDraw: null, lastContestNumber: null };
  }
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const { latestDraw, lastContestNumber } = await getHomeSnapshot();

  return (
    <>
      <PageJsonLd
        path="/"
        name={pt.meta.home.title}
        description={pt.meta.home.description}
        extra={[generateFAQSchema(homeFaqs)]}
      />
      <div className="container mx-auto px-4 pb-20 pt-10 sm:pt-14">
        {/* DOM order is the phone reading order (title, field, actions, note); the
            grid places the field beside them on wide screens. */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-16 lg:gap-y-8">
          <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1 lg:pt-4">
            <h1 className="text-4xl font-semibold sm:text-6xl">{pt.home.heroTitle}</h1>
            <p className="max-w-[44ch] text-lg text-muted-foreground">{pt.home.heroSubtitle}</p>
          </div>

          <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <LatestDrawFigure draw={latestDraw} contestNumber={lastContestNumber} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex lg:col-start-1 lg:row-start-2">
            <Button asChild size="lg">
              <Link href="/dashboard">{pt.nav.accessDashboard}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard/generator">Gerar apostas</Link>
            </Button>
          </div>

          <div className="lg:col-start-1 lg:row-start-3">
            <RandomnessNote>{pt.home.disclaimer.text}</RandomnessNote>
          </div>
        </section>

        <section aria-labelledby="home-contents" className="mt-20">
          <h2 id="home-contents" className="text-3xl font-semibold">
            {pt.home.contentsTitle}
          </h2>
          <ol className="mt-6 border-t-2 border-primary">
            {pt.home.contents.map((entry) => {
              const LinkComponent = entry.archive ? ArchiveLink : Link;
              return (
                <li
                  key={entry.href}
                  className="grid gap-1 border-b border-border py-5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-8"
                >
                  <LinkComponent
                    href={entry.href}
                    className="w-fit rounded-sm font-title text-xl font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [font-stretch:88%]"
                  >
                    {entry.title}
                  </LinkComponent>
                  <p className="max-w-[60ch] text-muted-foreground">{entry.description}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="home-about"
          className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
        >
          <div>
            <h2 id="home-about" className="text-3xl font-semibold">
              O que é o Mega-Sena Analyzer?
            </h2>
            <p className="mt-4 max-w-[60ch] text-muted-foreground">
              O Mega-Sena Analyzer é uma ferramenta gratuita que analisa todos os sorteios
              históricos da Mega-Sena utilizando dados oficiais da API pública da CAIXA Econômica
              Federal. A plataforma oferece estatísticas de frequência, análise de padrões,
              distribuições numéricas e um gerador de apostas baseado em programação dinâmica.
            </p>
            <p className="mt-4 max-w-[60ch] text-muted-foreground">
              Desenvolvido para fins educacionais e recreativos, o sistema não possui nenhuma
              capacidade preditiva. A Mega-Sena é um jogo puramente aleatório onde cada sorteio é um
              evento independente.{' '}
              <Link href="/terms" className={textLinkClass}>
                {pt.home.disclaimer.termsLinkLabel}
              </Link>
            </p>
          </div>

          <div>
            <h2 className="text-3xl font-semibold">Perguntas frequentes</h2>
            <div className="mt-6 border-t-2 border-primary">
              {homeFaqs.map((faq) => (
                <details key={faq.question} className="group border-b border-border">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    {faq.question}
                    <ChevronDown
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out-quint group-open:rotate-180"
                    />
                  </summary>
                  <p className="max-w-[65ch] pb-5 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function LatestDrawFigure({
  draw,
  contestNumber,
}: {
  draw: LatestDraw | null;
  contestNumber: number | null;
}): React.JSX.Element {
  if (!draw) {
    return (
      <figure className="border-t-2 border-primary pt-5">
        <figcaption className="font-title text-3xl font-semibold [font-stretch:88%]">
          Último concurso
        </figcaption>
        <NumberField struck={[]} label="Dezenas de 01 a 60" className="mt-5" />
        <p className="mt-4 text-muted-foreground">
          Os dados do último sorteio estão temporariamente indisponíveis. Os resultados de todos os
          concursos continuam em{' '}
          <ArchiveLink href="/resultados" className={textLinkClass}>
            Resultados
          </ArchiveLink>
          .
        </p>
      </figure>
    );
  }

  const prize =
    draw.accumulated || draw.prizeSena <= 0 ? 'Acumulou' : formatCurrency(draw.prizeSena);

  return (
    <figure className="border-t-2 border-primary pt-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-condensed text-4xl font-semibold tabular-nums sm:text-5xl">
          Concurso {draw.contestNumber}
        </span>
        <span className="text-muted-foreground tabular-nums">
          Sorteio de {formatDate(draw.drawDate)}
        </span>
      </figcaption>
      <NumberField
        struck={draw.numbers}
        linked
        size="lg"
        label={`Dezenas sorteadas no concurso ${draw.contestNumber}`}
        className="mt-5"
      />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <dl className="flex items-baseline gap-3">
          <dt className="text-muted-foreground">Prêmio da sena</dt>
          <dd className="font-condensed text-2xl font-semibold tabular-nums">{prize}</dd>
        </dl>
        <ArchiveLink href={`/concurso/${draw.contestNumber}`} className={textLinkClass}>
          Ganhadores e rateio do concurso {draw.contestNumber}
        </ArchiveLink>
      </div>
      <div className="mt-3">
        <SourceLine through={contestNumber} />
      </div>
    </figure>
  );
}
