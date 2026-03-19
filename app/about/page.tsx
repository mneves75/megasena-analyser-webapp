import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, Info, Database, Shield, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { JsonLd } from '@/components/seo/json-ld';
import { generateBreadcrumbSchema } from '@/lib/seo/schemas';
import { BASE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: 'Sobre o Projeto',
  description:
    'Conheça o Mega-Sena Analyzer: ferramenta gratuita de análise estatística da Mega-Sena. Dados oficiais da CAIXA, metodologia transparente e código aberto.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'Sobre o Projeto | Mega-Sena Analyzer',
    description:
      'Ferramenta gratuita de análise estatística com dados oficiais da CAIXA Econômica Federal.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd data={generateBreadcrumbSchema([
        { name: 'Início', url: '/' },
        { name: 'Sobre', url: '/about' },
      ])} />
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
        <nav className="border-b bg-card/50 backdrop-blur" aria-label="Navegação do dashboard">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-2xl font-bold font-title">
                Mega-Sena Analyzer
              </Link>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost">
                  <Link href="/dashboard/statistics">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Estatísticas
                  </Link>
                </Button>
                <Button asChild variant="default">
                  <Link href="/dashboard/generator">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Apostas
                  </Link>
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto flex-1 px-4 py-8">
          <div className="mb-6">
            <Button variant="ghost" asChild>
              <Link href="/dashboard" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Link>
            </Button>
          </div>

          <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <Info className="h-8 w-8 text-primary" />
              <h1 className="mb-0">Sobre o Mega-Sena Analyzer</h1>
            </div>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                O que é o projeto
              </h2>
              <p>
                O Mega-Sena Analyzer é uma ferramenta gratuita de análise estatística
                dos sorteios da Mega-Sena. O objetivo é oferecer uma visualização clara e
                acessível dos dados históricos para fins educacionais e recreativos.
              </p>
              <p>
                Desenvolvido como projeto independente, sem qualquer vínculo com a
                Caixa Econômica Federal ou operadores de loterias.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Fonte dos dados
              </h2>
              <p>
                Todos os dados de sorteios são obtidos diretamente da{' '}
                <strong>API pública da CAIXA Econômica Federal</strong>
                {' '}(servicebus2.caixa.gov.br), a fonte oficial dos resultados
                das loterias brasileiras.
              </p>
              <p>
                O banco de dados local é atualizado periodicamente com os resultados
                mais recentes, garantindo que as análises reflitam o histórico completo
                de sorteios desde o primeiro concurso.
              </p>
            </section>

            <section className="space-y-3">
              <h2>Metodologia</h2>
              <p>As análises oferecidas incluem:</p>
              <ul>
                <li>
                  <strong>Frequência de números:</strong> contagem de quantas vezes
                  cada número de 01 a 60 foi sorteado ao longo de toda a história
                </li>
                <li>
                  <strong>Análise de atraso:</strong> quantos sorteios se passaram
                  desde a última aparição de cada número
                </li>
                <li>
                  <strong>Distribuição por dezena:</strong> como os sorteios se
                  distribuem nas faixas 01-10, 11-20, etc.
                </li>
                <li>
                  <strong>Pares frequentes:</strong> combinações de dois números que
                  aparecem juntos com maior frequência
                </li>
                <li>
                  <strong>Paridade e primos:</strong> distribuição de números pares,
                  ímpares e primos nos sorteios
                </li>
                <li>
                  <strong>Gerador de apostas:</strong> algoritmo de programação
                  dinâmica que otimiza a alocação de orçamento entre apostas simples
                  e múltiplas, minimizando desperdício
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Aviso importante
              </h2>
              <div className="not-prose rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 dark:bg-destructive/10">
                <p className="font-bold text-destructive text-lg mb-2">
                  Previsão de loteria é estatisticamente impossível
                </p>
                <p className="text-muted-foreground text-sm">
                  A Mega-Sena é um jogo puramente aleatório. Cada sorteio é um evento
                  independente e o passado não influencia o futuro. Nenhuma análise
                  estatística, por mais sofisticada, pode prever os números que serão
                  sorteados. Padrões históricos são coincidências, não tendências
                  previsíveis. Jogue com responsabilidade e apenas valores que você
                  pode perder.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2>Tecnologia</h2>
              <p>
                Construído com Next.js, TypeScript e SQLite. Hospedado em servidor
                próprio. Código focado em performance, acessibilidade e privacidade,
                com coleta mínima de dados técnicos para segurança e operação.
              </p>
            </section>

            <section className="space-y-3">
              <h2>Contato</h2>
              <p>
                Para relatar problemas de segurança:{' '}
                <a href="mailto:security@megasena-analyzer.com.br">
                  security@megasena-analyzer.com.br
                </a>
              </p>
            </section>
          </article>
        </div>
      </div>
    </>
  );
}
