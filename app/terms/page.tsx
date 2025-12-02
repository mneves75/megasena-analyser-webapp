import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles } from 'lucide-react';
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
              Mega-Sena Analyser
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

        <article className="prose prose-slate dark:prose-invert mx-auto max-w-4xl">
          <h1>Termos de Servico</h1>
          <p className="text-muted-foreground">
            <strong>Ultima atualizacao: 30 de setembro de 2025</strong>
          </p>

          <h2>1. Aceitacao dos Termos</h2>
          <p>
            Ao acessar e utilizar o Mega-Sena Analyser (&quot;Servico&quot;, &quot;Plataforma&quot;,
            &quot;Aplicacao&quot;), voce (&quot;Usuario&quot;, &quot;Voce&quot;) concorda em ficar
            vinculado a estes Termos de Servico (&quot;Termos&quot;). Se voce nao concordar com
            qualquer parte destes termos, nao utilize o Servico.
          </p>

          <h2>2. Descricao do Servico</h2>
          <p>
            O Mega-Sena Analyser e uma ferramenta de analise estatistica e geracao de sugestoes de
            apostas para a loteria Mega-Sena, operada pela Caixa Economica Federal. O Servico
            oferece:
          </p>
          <ul>
            <li>Analise estatistica de resultados historicos</li>
            <li>Visualizacao de padroes e tendencias</li>
            <li>Geracao automatizada de sugestoes de apostas</li>
            <li>Ferramentas de gestao de orcamento para apostas</li>
          </ul>

          <h2>3. Natureza Informativa e Limitacoes</h2>

          <h3>3.1 Sem Garantias de Resultados</h3>
          <p>O Usuario reconhece e concorda expressamente que:</p>
          <ul>
            <li>
              <strong>Aleatoriedade</strong>: A Mega-Sena e um jogo de sorte completamente aleatorio.
              Nenhuma analise estatistica, por mais sofisticada que seja, pode prever ou influenciar
              os resultados futuros.
            </li>
            <li>
              <strong>Analise Historica</strong>: As estatisticas apresentadas baseiam-se
              exclusivamente em resultados passados e nao garantem resultados futuros.
            </li>
            <li>
              <strong>Probabilidades</strong>: Todas as combinacoes de numeros possuem a mesma
              probabilidade matematica de serem sorteadas, independentemente de padroes historicos.
            </li>
            <li>
              <strong>Sem Vantagem</strong>: O uso desta ferramenta nao aumenta suas chances de
              ganhar na loteria.
            </li>
          </ul>

          <h3>3.2 Finalidade Educacional</h3>
          <p>O Servico tem finalidade educacional e recreativa, destinado a:</p>
          <ul>
            <li>Compreender conceitos basicos de probabilidade e estatistica</li>
            <li>Visualizar dados historicos da Mega-Sena</li>
            <li>Auxiliar na organizacao de apostas de forma estruturada</li>
          </ul>

          <h2>4. Responsabilidades do Usuario</h2>

          <h3>4.1 Uso Responsavel</h3>
          <p>O Usuario compromete-se a:</p>
          <ul>
            <li>Utilizar o Servico de forma licita e responsavel</li>
            <li>Nao apostar valores que nao pode perder</li>
            <li>Reconhecer que jogos de azar podem ser viciantes</li>
            <li>Buscar ajuda profissional caso identifique comportamento de jogo compulsivo</li>
            <li>Respeitar as leis e regulamentos aplicaveis em sua jurisdicao</li>
          </ul>

          <h3>4.2 Maioridade e Capacidade Legal</h3>
          <ul>
            <li>O Usuario declara ser maior de 18 anos</li>
            <li>Possui capacidade legal para aceitar estes Termos</li>
            <li>Esta autorizado a apostar em loterias segundo as leis de sua jurisdicao</li>
          </ul>

          <h2>5. Limitacao de Responsabilidade</h2>

          <h3>5.1 Isencao de Garantias</h3>
          <p>
            O SERVICO E FORNECIDO &quot;NO ESTADO EM QUE SE ENCONTRA&quot; E &quot;CONFORME
            DISPONIVEL&quot;, SEM GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLICITAS, INCLUINDO, MAS
            NAO SE LIMITANDO A:
          </p>
          <ul>
            <li>Garantias de comercializacao</li>
            <li>Adequacao a uma finalidade especifica</li>
            <li>Nao violacao de direitos</li>
            <li>Precisao, confiabilidade ou completude das informacoes</li>
          </ul>

          <h3>5.2 Limitacao de Danos</h3>
          <p>
            EM NENHUMA CIRCUNSTANCIA OS DESENVOLVEDORES, MANTENEDORES OU CONTRIBUIDORES DO MEGA-SENA
            ANALYSER SERAO RESPONSAVEIS POR:
          </p>
          <ul>
            <li>Perdas financeiras decorrentes de apostas</li>
            <li>Decisoes de apostas baseadas nas informacoes fornecidas</li>
            <li>Lucros cessantes ou perda de oportunidades</li>
            <li>Danos indiretos, incidentais, especiais ou consequenciais</li>
            <li>Perda de dados ou interrupcao de negocios</li>
          </ul>

          <h2>6. Jogo Responsavel</h2>

          <h3>6.1 Recursos de Conscientizacao</h3>
          <p>Reconhecemos que o jogo compulsivo e um problema serio. Recomendamos:</p>
          <ul>
            <li>
              <strong>Estabeleca Limites</strong>: Defina quanto pode gastar e nunca exceda esse
              valor
            </li>
            <li>
              <strong>Jogue por Diversao</strong>: Nao tente recuperar perdas
            </li>
            <li>
              <strong>Busque Ajuda</strong>: Se o jogo esta afetando sua vida, procure ajuda
              profissional
            </li>
          </ul>

          <h3>6.2 Recursos de Apoio</h3>
          <ul>
            <li>
              <strong>CVV (Centro de Valorizacao da Vida)</strong>: 188 (24h, gratuito)
            </li>
            <li>
              <strong>Jogadores Anonimos</strong>:{' '}
              <a
                href="https://www.jogadoresanonimos.com.br"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://www.jogadoresanonimos.com.br
              </a>
            </li>
            <li>
              <strong>CAPS (Centro de Atencao Psicossocial)</strong>: Consulte sua cidade
            </li>
          </ul>

          <h2>7. Lei Aplicavel</h2>
          <p>
            Estes Termos sao regidos pelas leis da Republica Federativa do Brasil, em conformidade
            com:
          </p>
          <ul>
            <li>Lei Geral de Protecao de Dados (LGPD - Lei n 13.709/2018)</li>
            <li>Marco Civil da Internet (Lei n 12.965/2014)</li>
            <li>Codigo de Defesa do Consumidor (Lei n 8.078/1990)</li>
          </ul>

          <div className="not-prose mt-8 rounded-lg border border-yellow-600 bg-yellow-50 p-4 dark:bg-yellow-950/20">
            <p className="font-semibold text-yellow-900 dark:text-yellow-500">
              IMPORTANTE: LEIA COM ATENCAO
            </p>
            <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-400">
              AO UTILIZAR O MEGA-SENA ANALYSER, VOCE RECONHECE TER LIDO, COMPREENDIDO E CONCORDADO
              COM ESTES TERMOS DE SERVICO NA INTEGRA. A loteria e um jogo de sorte. Jogue com
              responsabilidade e apenas com valores que pode perder.
            </p>
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              <em>
                Estes Termos foram elaborados com assessoria juridica especializada em direito do
                consumidor, direito digital e protecao de dados pessoais, em conformidade com a
                legislacao brasileira vigente.
              </em>
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
