import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { JsonLd } from '@/components/seo/json-ld';
import { generateFAQSchema } from '@/lib/seo/schemas';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description:
    'Termos de uso do Mega-Sena Analyzer. Ferramenta de visualizacao de dados historicos para fins educacionais. Nao aumenta chances de ganhar.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Termos de Uso | Mega-Sena Analyzer',
    description: 'Termos de uso e isencao de responsabilidade do Mega-Sena Analyzer.',
    url: '/terms',
  },
};

const termsFAQs = [
  {
    question: 'O Mega-Sena Analyzer aumenta minhas chances de ganhar?',
    answer:
      'Nao. Esta ferramenta NAO aumenta suas chances de ganhar na loteria. A Mega-Sena e um jogo puramente aleatorio e cada sorteio e independente.',
  },
  {
    question: 'O que e o Mega-Sena Analyzer?',
    answer:
      'E uma ferramenta de visualizacao de dados historicos da Mega-Sena para fins educacionais e recreativos. Oferece estatisticas de frequencia, visualizacao de padroes e geracao de combinacoes aleatorias.',
  },
  {
    question: 'O servico e gratuito?',
    answer:
      'Sim, o Mega-Sena Analyzer e totalmente gratuito. Nao cobramos por nenhuma funcionalidade.',
  },
  {
    question: 'Posso usar as estatisticas para prever numeros?',
    answer:
      'Nao. Padroes historicos nao predizem resultados futuros. Todas as combinacoes tem exatamente a mesma probabilidade de serem sorteadas.',
  },
];

export default function TermsPage(): React.JSX.Element {
  return (
    <>
      <JsonLd data={generateFAQSchema(termsFAQs)} />
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-primary/5">
        <nav className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">
              Mega-Sena Analyzer
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/statistics">
                <Button variant="ghost">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Estatísticas
                </Button>
              </Link>
              <Link href="/dashboard/generator">
                <Button variant="default">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Apostas
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto flex-1 px-4 py-8">
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
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="mb-0">Termos de Uso</h1>
          </div>

          <p className="text-muted-foreground text-sm">
            Última atualização: 3 de dezembro de 2025
          </p>

          {/* AVISO PRINCIPAL - O MAIS IMPORTANTE */}
          <div className="not-prose my-8 rounded-xl border-2 border-red-500/50 bg-red-50 p-6 dark:bg-red-950/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
              <div>
                <p className="font-bold text-red-800 dark:text-red-400 text-lg mb-2">
                  AVISO IMPORTANTE
                </p>
                <p className="text-red-700 dark:text-red-500 mb-2">
                  Esta ferramenta <strong>NÃO aumenta suas chances de ganhar na loteria</strong>.
                </p>
                <p className="text-red-700 dark:text-red-500 text-sm">
                  A Mega-Sena é um jogo puramente aleatório. Cada sorteio é independente.
                  Padrões históricos não predizem resultados futuros.
                  Todas as combinações têm exatamente a mesma probabilidade.
                </p>
              </div>
            </div>
          </div>

          <h2>1. O que é esta ferramenta</h2>
          <p>
            O Mega-Sena Analyzer é uma ferramenta de <strong>visualização de dados históricos</strong> da
            Mega-Sena para fins educacionais e recreativos. Oferece:
          </p>
          <ul>
            <li>Estatísticas de frequência de números sorteados</li>
            <li>Visualização de padrões históricos</li>
            <li>Geração de combinações aleatórias para apostas</li>
          </ul>

          <h2>2. O que esta ferramenta NÃO é</h2>
          <ul>
            <li>NÃO é um sistema de previsão de resultados</li>
            <li>NÃO é uma estratégia para aumentar chances de ganhar</li>
            <li>NÃO possui nenhum algoritmo capaz de prever números</li>
            <li>NÃO tem vínculo com a Caixa Econômica Federal</li>
          </ul>

          <h2>3. Sua responsabilidade</h2>
          <p>Ao usar esta ferramenta, você declara que:</p>
          <ul>
            <li>Tem 18 anos ou mais</li>
            <li>Entende que loteria é jogo de azar</li>
            <li>Aceita <strong>total responsabilidade</strong> por suas decisões de apostas</li>
            <li>Apostará apenas valores que pode perder</li>
          </ul>

          {/* ISENCAO DE RESPONSABILIDADE */}
          <div className="not-prose my-8 rounded-xl border border-yellow-500/50 bg-yellow-50 p-6 dark:bg-yellow-950/20">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-400 text-lg mb-4">
              4. ISENÇÃO DE RESPONSABILIDADE
            </h3>
            <p className="text-yellow-800 dark:text-yellow-400 text-sm mb-4 uppercase font-medium">
              O serviço é fornecido &quot;como está&quot; (as is), sem garantias de qualquer tipo.
            </p>
            <p className="text-yellow-700 dark:text-yellow-500 text-sm mb-2">
              <strong>NÃO nos responsabilizamos por:</strong>
            </p>
            <ul className="text-yellow-700 dark:text-yellow-500 text-sm space-y-1 list-disc list-inside">
              <li>Perdas financeiras de qualquer natureza</li>
              <li>Decisões de apostas baseadas nas informações exibidas</li>
              <li>Interpretação incorreta das estatísticas</li>
              <li>Indisponibilidade ou erros da plataforma</li>
              <li>Danos diretos, indiretos ou consequenciais</li>
            </ul>
          </div>

          <h2>5. Jogo responsável</h2>
          <p>
            Se você ou alguém próximo está enfrentando problemas com jogos de azar:
          </p>
          <ul>
            <li><strong>CVV</strong>: 188 (24h, gratuito)</li>
            <li><strong>Jogadores Anônimos</strong>:{' '}
              <a href="https://www.jogadoresanonimos.com.br" target="_blank" rel="noopener noreferrer">
                jogadoresanonimos.com.br
              </a>
            </li>
          </ul>

          <h2>6. Alterações</h2>
          <p>
            Estes termos podem ser alterados a qualquer momento.
            O uso continuado da plataforma após alterações constitui aceitação dos novos termos.
          </p>

          <h2>7. Lei aplicável</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil.
          </p>

          <div className="not-prose mt-8 rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Ao utilizar o Mega-Sena Analyzer, você confirma ter lido e concordado com estes termos.
            </p>
          </div>
        </article>
      </main>
      </div>
    </>
  );
}
