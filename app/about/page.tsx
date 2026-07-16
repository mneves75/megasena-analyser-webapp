import type { Metadata } from 'next';
import { BookOpen, Database, Info, Shield } from 'lucide-react';
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
      <div className="container mx-auto px-4 py-8">
        <article className="mx-auto max-w-[70ch] space-y-6 break-words leading-7 [&_a:hover]:underline [&_a]:text-primary [&_a]:underline-offset-2 [&_h1]:text-balance [&_h1]:font-title [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-balance [&_h2]:font-title [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6">
          <div className="mb-6 flex items-center gap-3">
            <Info aria-hidden className="h-8 w-8 text-primary" />
            <h1 className="mb-0">Sobre o Mega-Sena Analyzer</h1>
          </div>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2">
              <BookOpen aria-hidden className="h-5 w-5 text-primary" />
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
              <Database aria-hidden className="h-5 w-5 text-primary" />
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
              <Shield aria-hidden className="h-5 w-5 text-primary" />
              Aviso importante
            </h2>
            <div className="not-prose rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 dark:bg-destructive/10">
              <p className="mb-2 text-lg font-bold text-destructive">
                Previsão de loteria é estatisticamente impossível
              </p>
              <p className="text-sm text-muted-foreground">
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
    </>
  );
}
