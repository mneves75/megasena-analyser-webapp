import type { Metadata } from 'next';
import Link from 'next/link';
import type { ElementType } from 'react';
import { Activity, AlertTriangle, BarChart3, Flame, Sparkles } from 'lucide-react';
import { JsonLd } from '@/components/seo/json-ld';
import { Button } from '@/components/ui/button';
import { LotteryBall } from '@/components/lottery-ball';
import { fetchApi } from '@/lib/api/api-fetch';
import { logger } from '@/lib/logger';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BASE_URL as baseUrl } from '@/lib/constants';
import { pt } from '@/lib/i18n';
import { generateFAQSchema } from '@/lib/seo/schemas';

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
      'Todos os dados são obtidos da API pública oficial da CAIXA Econômica Federal (servicebus2.caixa.gov.br), que é a fonte autorizada dos resultados das loterias brasileiras.',
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

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: pt.meta.home.title,
  description: pt.meta.home.description,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: pt.meta.home.title,
    description: pt.meta.home.openGraphDescription,
    url: '/',
  },
};

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

const secondaryFeatures: readonly { icon: ElementType; title: string; description: string }[] = [
  { icon: Flame, title: pt.home.features[1].title, description: pt.home.features[1].description },
  { icon: Sparkles, title: pt.home.features[2].title, description: pt.home.features[2].description },
  { icon: Activity, title: pt.home.features[3].title, description: pt.home.features[3].description },
];

async function getHomeSnapshot(): Promise<HomeSnapshot> {
  try {
    const response = await fetchApi('/api/dashboard', {
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
      <JsonLd data={generateFAQSchema(homeFaqs)} />
      <div className="container mx-auto px-4 py-12 sm:py-16">
        {/* Hero */}
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {lastContestNumber !== null && (
              <FreshnessBadge contestNumber={lastContestNumber} />
            )}
            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              {pt.home.heroTitle}
            </h1>
            <p className="max-w-[46ch] text-lg text-muted-foreground">{pt.home.heroSubtitle}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/dashboard">{pt.nav.accessDashboard}</Link>
              </Button>
            </div>
            <p className="max-w-[52ch] text-sm text-muted-foreground">
              A Mega-Sena é aleatória: nenhuma análise prevê resultados. Esta ferramenta é
              educacional e recreativa.
            </p>
          </div>

          <LatestDrawPanel draw={latestDraw} contestNumber={lastContestNumber} />
        </section>

        {/* Features (highlight + list) */}
        <section className="mt-20">
          <h2 className="text-balance text-2xl font-bold tracking-tight">
            O que você encontra
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-5 md:items-stretch">
            <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 sm:p-8 md:col-span-2">
              <div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{pt.home.features[0].title}</h3>
                <p className="mt-2 max-w-[34ch] text-muted-foreground">
                  {pt.home.features[0].description}
                </p>
              </div>
              <Link
                href="/dashboard/statistics"
                className="mt-6 inline-flex items-center text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Ver estatísticas detalhadas
              </Link>
            </div>

            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:col-span-3">
              {secondaryFeatures.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex items-start gap-4 p-5 sm:p-6">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Responsibility notice (compact) */}
        <section className="mt-16 max-w-[75ch]">
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                aria-hidden
                className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{pt.home.disclaimer.title}: </span>
                {pt.home.disclaimer.text}{' '}
                <Link
                  href="/terms"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {pt.home.disclaimer.termsLinkLabel}
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* About + FAQ */}
        <section className="mt-20 max-w-[70ch]">
          <h2 className="text-balance text-2xl font-bold tracking-tight">
            O que é o Mega-Sena Analyzer?
          </h2>
          <p className="mt-4 text-muted-foreground">
            O Mega-Sena Analyzer é uma ferramenta gratuita que analisa todos os sorteios
            históricos da Mega-Sena utilizando dados oficiais da API pública da CAIXA Econômica
            Federal. A plataforma oferece estatísticas de frequência, análise de padrões,
            distribuições numéricas e um gerador inteligente de apostas baseado em programação
            dinâmica.
          </p>
          <p className="mt-4 text-muted-foreground">
            Desenvolvido para fins educacionais e recreativos, o sistema não possui nenhuma
            capacidade preditiva. A Mega-Sena é um jogo puramente aleatório onde cada sorteio é um
            evento independente.
          </p>

          <h2 className="mt-12 text-balance text-2xl font-bold tracking-tight">
            Perguntas Frequentes
          </h2>
          <div className="mt-4 space-y-3">
            {homeFaqs.map((faq) => (
              <details key={faq.question} className="group rounded-lg border border-border bg-card p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {faq.question}
                  <span className="text-muted-foreground transition-transform duration-200 ease-out-quint group-open:rotate-180">
                    &#9660;
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function FreshnessBadge({ contestNumber }: { contestNumber: number }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
      <span>
        Dados até o concurso <span className="tabular-nums">#{contestNumber}</span>
      </span>
    </span>
  );
}

function LatestDrawPanel({
  draw,
  contestNumber,
}: {
  draw: LatestDraw | null;
  contestNumber: number | null;
}): React.JSX.Element {
  if (!draw) {
    return (
      <aside className="rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
        <p className="text-sm font-medium text-muted-foreground">Último sorteio</p>
        <p className="mt-3 text-muted-foreground">
          Os dados do último sorteio estão temporariamente indisponíveis. Acesse o dashboard para
          ver o histórico completo.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link href="/dashboard">Ir para o dashboard</Link>
        </Button>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-border bg-card p-6 shadow-elegant sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">Último sorteio</p>
        {contestNumber !== null && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            #<span className="tabular-nums">{contestNumber}</span>
          </span>
        )}
      </div>

      <p className="mt-1 font-title text-lg font-semibold tracking-tight">
        Concurso <span className="tabular-nums">#{draw.contestNumber}</span> ·{' '}
        <span className="tabular-nums">{formatDate(draw.drawDate)}</span>
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {draw.numbers.map((number) => (
          <LotteryBall key={number} number={number} size="md" />
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Prêmio (sena)</p>
        {draw.accumulated || draw.prizeSena <= 0 ? (
          <p className="font-title text-lg font-semibold">Acumulou</p>
        ) : (
          <p className="font-title text-lg font-semibold tabular-nums">
            {formatCurrency(draw.prizeSena)}
          </p>
        )}
      </div>
    </aside>
  );
}
