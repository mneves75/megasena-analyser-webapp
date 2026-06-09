import type { Metadata } from 'next';
import Link from 'next/link';
import type { ElementType } from 'react';
import { AlertTriangle, BarChart3, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { JsonLd } from '@/components/seo/json-ld';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
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

export default function HomePage() {
  return (
    <>
      <JsonLd data={generateFAQSchema(homeFaqs)} />
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex justify-end">
            <ThemeToggle />
          </div>

          <header className="mb-16 text-center">
            <h1 className="mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
              {pt.home.heroTitle}
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
              {pt.home.heroSubtitle}
            </p>
          </header>

          <div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={BarChart3}
              title={pt.home.features[0].title}
              description={pt.home.features[0].description}
            />
            <FeatureCard
              icon={TrendingUp}
              title={pt.home.features[1].title}
              description={pt.home.features[1].description}
            />
            <FeatureCard
              icon={Sparkles}
              title={pt.home.features[2].title}
              description={pt.home.features[2].description}
            />
            <FeatureCard
              icon={Zap}
              title={pt.home.features[3].title}
              description={pt.home.features[3].description}
            />
          </div>

          <div className="mx-auto mb-12 max-w-2xl">
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm">
                  <p className="mb-1 font-medium text-amber-800 dark:text-amber-300">
                    {pt.home.disclaimer.title}
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    {pt.home.disclaimer.text}{' '}
                    <Link href="/terms" className="underline hover:no-underline">
                      {pt.home.disclaimer.termsLinkLabel}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="h-auto px-8 py-6 text-lg">
              <Link href="/dashboard">{pt.nav.accessDashboard}</Link>
            </Button>
          </div>

          <section className="mx-auto mt-20 max-w-3xl">
            <h2 className="mb-4 text-2xl font-bold">O que é o Mega-Sena Analyzer?</h2>
            <p className="mb-4 text-muted-foreground">
              O Mega-Sena Analyzer é uma ferramenta gratuita que analisa todos os sorteios
              históricos da Mega-Sena utilizando dados oficiais da API pública da CAIXA
              Econômica Federal. A plataforma oferece estatísticas de frequência, análise de
              padrões, distribuições numéricas e um gerador inteligente de apostas baseado
              em programação dinâmica.
            </p>
            <p className="mb-8 text-muted-foreground">
              Desenvolvido para fins educacionais e recreativos, o sistema não possui
              nenhuma capacidade preditiva. A Mega-Sena é um jogo puramente aleatório onde
              cada sorteio é um evento independente.
            </p>

            <h2 className="mb-4 text-2xl font-bold">Perguntas Frequentes</h2>
            <div className="space-y-4">
              {homeFaqs.map((faq) => (
                <details key={faq.question} className="group rounded-lg border bg-card p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                    {faq.question}
                    <span className="text-muted-foreground transition-transform group-open:rotate-180">
                      &#9660;
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 transition-smooth hover:shadow-glow">
      <Icon className="mb-4 h-10 w-10 text-primary" />
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
