import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Footer } from '@/components/footer';

export default function TermsPage(): React.JSX.Element {
  return (
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
                  Estatisticas
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
            Ultima atualizacao: 3 de dezembro de 2025
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
                  Esta ferramenta <strong>NAO aumenta suas chances de ganhar na loteria</strong>.
                </p>
                <p className="text-red-700 dark:text-red-500 text-sm">
                  A Mega-Sena e um jogo puramente aleatorio. Cada sorteio e independente.
                  Padroes historicos nao predizem resultados futuros.
                  Todas as combinacoes tem exatamente a mesma probabilidade.
                </p>
              </div>
            </div>
          </div>

          <h2>1. O que e esta ferramenta</h2>
          <p>
            O Mega-Sena Analyzer e uma ferramenta de <strong>visualizacao de dados historicos</strong> da
            Mega-Sena para fins educacionais e recreativos. Oferece:
          </p>
          <ul>
            <li>Estatisticas de frequencia de numeros sorteados</li>
            <li>Visualizacao de padroes historicos</li>
            <li>Geracao de combinacoes aleatorias para apostas</li>
          </ul>

          <h2>2. O que esta ferramenta NAO e</h2>
          <ul>
            <li>NAO e um sistema de previsao de resultados</li>
            <li>NAO e uma estrategia para aumentar chances de ganhar</li>
            <li>NAO possui nenhum algoritmo capaz de prever numeros</li>
            <li>NAO tem vinculo com a Caixa Economica Federal</li>
          </ul>

          <h2>3. Sua responsabilidade</h2>
          <p>Ao usar esta ferramenta, voce declara que:</p>
          <ul>
            <li>Tem 18 anos ou mais</li>
            <li>Entende que loteria e jogo de azar</li>
            <li>Aceita <strong>total responsabilidade</strong> por suas decisoes de apostas</li>
            <li>Apostara apenas valores que pode perder</li>
          </ul>

          {/* ISENCAO DE RESPONSABILIDADE */}
          <div className="not-prose my-8 rounded-xl border border-yellow-500/50 bg-yellow-50 p-6 dark:bg-yellow-950/20">
            <h3 className="font-bold text-yellow-800 dark:text-yellow-400 text-lg mb-4">
              4. ISENCAO DE RESPONSABILIDADE
            </h3>
            <p className="text-yellow-800 dark:text-yellow-400 text-sm mb-4 uppercase font-medium">
              O servico e fornecido &quot;como esta&quot; (as is), sem garantias de qualquer tipo.
            </p>
            <p className="text-yellow-700 dark:text-yellow-500 text-sm mb-2">
              <strong>NAO nos responsabilizamos por:</strong>
            </p>
            <ul className="text-yellow-700 dark:text-yellow-500 text-sm space-y-1 list-disc list-inside">
              <li>Perdas financeiras de qualquer natureza</li>
              <li>Decisoes de apostas baseadas nas informacoes exibidas</li>
              <li>Interpretacao incorreta das estatisticas</li>
              <li>Indisponibilidade ou erros da plataforma</li>
              <li>Danos diretos, indiretos ou consequenciais</li>
            </ul>
          </div>

          <h2>5. Jogo responsavel</h2>
          <p>
            Se voce ou alguem proximo esta enfrentando problemas com jogos de azar:
          </p>
          <ul>
            <li><strong>CVV</strong>: 188 (24h, gratuito)</li>
            <li><strong>Jogadores Anonimos</strong>:{' '}
              <a href="https://www.jogadoresanonimos.com.br" target="_blank" rel="noopener noreferrer">
                jogadoresanonimos.com.br
              </a>
            </li>
          </ul>

          <h2>6. Alteracoes</h2>
          <p>
            Estes termos podem ser alterados a qualquer momento.
            O uso continuado da plataforma apos alteracoes constitui aceitacao dos novos termos.
          </p>

          <h2>7. Lei aplicavel</h2>
          <p>
            Estes termos sao regidos pelas leis da Republica Federativa do Brasil.
          </p>

          <div className="not-prose mt-8 rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Ao utilizar o Mega-Sena Analyzer, voce confirma ter lido e concordado com estes termos.
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
