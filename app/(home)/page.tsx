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
  PageTitle,
  RandomnessNote,
  SectionHeading,
  SourceLine,
  textLinkClass,
} from '@/app/_components/archive-ui';
import { LatestDrawFigure } from '@/app/_components/latest-draw-figure';

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
      <div className="space-y-16 lg:space-y-20">
        <header className="space-y-6">
          <HomeLatestDraw draw={latestDraw} lastContestNumber={lastContestNumber} />
          <RandomnessNote>{pt.home.disclaimer.text}</RandomnessNote>
        </header>

        <section
          aria-labelledby="home-about"
          className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
        >
          <div>
            <SectionHeading id="home-about">O que é o Mega-Sena Analyzer?</SectionHeading>
            <p className="mt-4 max-w-[68ch] text-muted-foreground">
              O Mega-Sena Analyzer é uma ferramenta gratuita que analisa todos os sorteios
              históricos da Mega-Sena utilizando dados oficiais da API pública da CAIXA Econômica
              Federal. A plataforma oferece estatísticas de frequência, análise de padrões,
              distribuições numéricas e um gerador de apostas baseado em programação dinâmica.
            </p>
            <p className="mt-4 max-w-[68ch] text-muted-foreground">
              Desenvolvido para fins educacionais e recreativos, o sistema não possui nenhuma
              capacidade preditiva. A Mega-Sena é um jogo puramente aleatório onde cada sorteio é um
              evento independente.{' '}
              <Link href="/terms" className={textLinkClass}>
                {pt.home.disclaimer.termsLinkLabel}
              </Link>
            </p>
          </div>

          <div>
            <SectionHeading id="home-faq">Perguntas frequentes</SectionHeading>
            <div className="mt-6 border-t-2 border-primary">
              {homeFaqs.map((faq) => (
                <details key={faq.question} className="group border-b border-border">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold focus-ring-inset">
                    {faq.question}
                    <ChevronDown
                      aria-hidden
                      className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 ease-out-quint group-open:rotate-180"
                    />
                  </summary>
                  <p className="max-w-[68ch] pb-5 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function HomeActions(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 sm:flex">
      <Button asChild size="lg">
        <Link href="/dashboard">{pt.nav.accessDashboard}</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/dashboard/generator">Gerar apostas</Link>
      </Button>
    </div>
  );
}

/** The home hero: the page title over the latest draw, data before any prose. */
function HomeLatestDraw({
  draw,
  lastContestNumber,
}: {
  draw: LatestDraw | null;
  lastContestNumber: number | null;
}): React.JSX.Element {
  const facts = draw ? (
    <>
      <p className="text-lg tabular-nums">
        Concurso {draw.contestNumber}, sorteado em {formatDate(draw.drawDate)}
      </p>
      <dl className="border-t border-border pt-4">
        <dt className="text-sm text-muted-foreground">Prêmio da sena</dt>
        <dd className="font-condensed text-2xl font-semibold tabular-nums">
          {draw.accumulated || draw.prizeSena <= 0 ? 'Acumulou' : formatCurrency(draw.prizeSena)}
        </dd>
      </dl>
      <p>
        <ArchiveLink href={`/concurso/${draw.contestNumber}`} className={textLinkClass}>
          Ganhadores e rateio do concurso {draw.contestNumber}
        </ArchiveLink>
      </p>
    </>
  ) : (
    <p className="text-muted-foreground">
      Os dados do último sorteio estão temporariamente indisponíveis. Os resultados de todos os
      concursos continuam em{' '}
      <ArchiveLink href="/resultados" className={textLinkClass}>
        Resultados
      </ArchiveLink>
      .
    </p>
  );

  // The game's name stays whole when the title wraps: a line never ends in "Mega-".
  const [beforeName, afterName] = pt.home.heroTitle.split('Mega-Sena');

  return (
    <LatestDrawFigure
      heading={
        <PageTitle>
          {beforeName}
          <span className="whitespace-nowrap">Mega-Sena</span>
          {afterName}
        </PageTitle>
      }
      numbers={draw?.numbers ?? []}
      fieldLabel={
        draw ? `Dezenas sorteadas no concurso ${draw.contestNumber}` : 'Dezenas de 01 a 60'
      }
      actions={<HomeActions />}
    >
      {facts}
      <SourceLine through={lastContestNumber} />
    </LatestDrawFigure>
  );
}
