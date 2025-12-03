import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Footer } from '@/components/footer';

export default function PrivacyPage(): React.JSX.Element {
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

        <article className="prose prose-slate dark:prose-invert mx-auto max-w-4xl">
          <h1>Politica de Privacidade</h1>
          <p className="text-muted-foreground">
            <strong>Ultima atualizacao: 30 de setembro de 2025</strong>
          </p>
          <p className="text-muted-foreground">
            <strong>Vigencia: A partir de 30 de setembro de 2025</strong>
          </p>

          <h2>1. Introducao</h2>
          <p>
            A sua privacidade e importante para nos. Esta Politica de Privacidade explica como o
            Mega-Sena Analyzer (&quot;nos&quot;, &quot;nosso&quot;, &quot;Plataforma&quot;) coleta,
            usa, armazena e protege suas informacoes pessoais, em conformidade com a Lei Geral de
            Protecao de Dados Pessoais (Lei n 13.709/2018 - LGPD) e demais legislacoes aplicaveis.
          </p>

          <h2>2. Controlador de Dados</h2>
          <ul>
            <li>
              <strong>Controlador de Dados</strong>: Mega-Sena Analyzer
            </li>
          </ul>

          <h2>3. Dados Coletados</h2>

          <h3>3.1 Dados Fornecidos Voluntariamente</h3>
          <p>Atualmente, o Mega-Sena Analyzer opera principalmente no lado do cliente, coletando:</p>
          <ul>
            <li>
              <strong>Preferencias de Uso</strong>: Configuracoes salvas localmente no navegador
            </li>
            <li>
              <strong>Dados de Apostas</strong>: Combinacoes geradas e orcamentos configurados
              (armazenados localmente)
            </li>
          </ul>

          <h3>3.2 Dados Coletados Automaticamente</h3>
          <p>Quando voce acessa a Plataforma, podemos coletar automaticamente:</p>
          <ul>
            <li>Endereco IP</li>
            <li>Tipo de navegador e versao</li>
            <li>Sistema operacional</li>
            <li>Paginas visitadas</li>
            <li>Data e hora de acesso</li>
          </ul>

          <h3>3.3 Dados que NAO Coletamos</h3>
          <ul>
            <li>
              <strong>Informacoes Financeiras</strong>: Nao coletamos dados de cartao de credito,
              conta bancaria ou pagamento
            </li>
            <li>
              <strong>Documentos</strong>: Nao solicitamos CPF, RG ou outros documentos
            </li>
            <li>
              <strong>Dados Sensiveis</strong>: Nao coletamos dados sensiveis conforme definidos pela
              LGPD
            </li>
          </ul>

          <h2>4. Finalidades do Tratamento</h2>
          <p>Utilizamos seus dados para:</p>
          <ul>
            <li>Processar suas solicitacoes de analises estatisticas</li>
            <li>Gerar sugestoes de apostas conforme suas preferencias</li>
            <li>Armazenar suas configuracoes e preferencias</li>
            <li>Fornecer suporte tecnico</li>
            <li>Melhorar e desenvolver a Plataforma</li>
            <li>Prevenir fraudes e garantir seguranca</li>
          </ul>

          <h2>5. Compartilhamento de Dados</h2>

          <h3>5.1 Nao Vendemos Seus Dados</h3>
          <p>Nunca vendemos, alugamos ou comercializamos seus dados pessoais.</p>

          <h3>5.2 Compartilhamento Limitado</h3>
          <p>Podemos compartilhar dados apenas nas seguintes situacoes:</p>
          <ul>
            <li>
              <strong>Prestadores de Servico</strong>: Empresas que nos auxiliam na operacao sob
              contratos de confidencialidade
            </li>
            <li>
              <strong>Obrigacao Legal</strong>: Quando exigido por lei ou autoridades competentes
            </li>
            <li>
              <strong>Protecao de Direitos</strong>: Para proteger nossos direitos e seguranca
            </li>
          </ul>

          <h2>6. Armazenamento e Seguranca</h2>

          <h3>6.1 Armazenamento Local</h3>
          <p>A maior parte dos dados e armazenada localmente em seu navegador atraves de:</p>
          <ul>
            <li>
              <strong>LocalStorage</strong>: Para preferencias e configuracoes
            </li>
            <li>
              <strong>IndexedDB</strong>: Para dados de analise e historico
            </li>
            <li>
              <strong>SQLite (client-side)</strong>: Para banco de dados local
            </li>
          </ul>

          <h3>6.2 Medidas de Seguranca</h3>
          <p>Implementamos medidas tecnicas e organizacionais, incluindo:</p>
          <ul>
            <li>Criptografia de dados em transito (HTTPS/TLS)</li>
            <li>Protecao contra XSS, CSRF e injecao SQL</li>
            <li>Content Security Policy (CSP)</li>
            <li>Controle de acesso baseado em funcao</li>
            <li>Auditorias e revisoes periodicas</li>
          </ul>

          <h2>7. Seus Direitos sob a LGPD</h2>
          <p>Conforme a LGPD (Art. 18), voce tem direito a:</p>
          <ul>
            <li>Confirmar se tratamos seus dados e acessa-los</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
            <li>Solicitar anonimizacao, bloqueio ou eliminacao de dados</li>
            <li>Receber seus dados em formato estruturado (portabilidade)</li>
            <li>Excluir dados tratados com seu consentimento</li>
            <li>Saber com quem compartilhamos seus dados</li>
            <li>Revogar consentimento a qualquer momento</li>
          </ul>

          <h3>Como Exercer Seus Direitos</h3>
          <p>Para exercer qualquer destes direitos:</p>
          <ul>
            <li>
              <strong>Prazo de Resposta</strong>: Ate 15 dias conforme LGPD
            </li>
          </ul>

          <h3>Direito de Reclamacao</h3>
          <p>Voce pode apresentar reclamacao a Autoridade Nacional de Protecao de Dados (ANPD):</p>
          <ul>
            <li>
              <strong>Website</strong>:{' '}
              <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noopener noreferrer">
                https://www.gov.br/anpd/pt-br
              </a>
            </li>
          </ul>

          <h2>8. Cookies e Tecnologias Similares</h2>
          <p>
            Utilizamos cookies essenciais para o funcionamento da Plataforma, cookies funcionais para
            lembrar suas preferencias, e cookies analiticos para compreender o uso da Plataforma.
          </p>
          <p>Voce pode gerenciar cookies atraves das configuracoes do seu navegador.</p>

          <h2>9. Privacidade de Menores</h2>
          <p>
            O Servico e destinado a maiores de 18 anos. Nao coletamos intencionalmente dados de
            menores.
          </p>

          <h2>10. Alteracoes nesta Politica</h2>
          <p>
            Podemos atualizar esta Politica periodicamente. Mudancas materiais serao comunicadas com
            30 dias de antecedencia.
          </p>

          <div className="not-prose mt-8 rounded-lg border border-blue-600 bg-blue-50 p-4 dark:bg-blue-950/20">
            <p className="font-semibold text-blue-900 dark:text-blue-500">Resumo Executivo</p>
            <div className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-400">
              <p>
                <strong>Dados Coletados:</strong> Principalmente dados de uso local; minimo de dados
                pessoais
              </p>
              <p>
                <strong>Armazenamento:</strong> Principalmente no seu navegador (local)
              </p>
              <p>
                <strong>Compartilhamento:</strong> Nao vendemos; compartilhamento minimo conforme
                necessario
              </p>
              <p>
                <strong>Seguranca:</strong> Criptografia, HTTPS, protecoes tecnicas robustas
              </p>
              <p>
                <strong>Seus Direitos:</strong> Acesso, correcao, exclusao, portabilidade e mais
              </p>
            </div>
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <p>
              <em>
                Esta Politica foi elaborada com assessoria juridica especializada em protecao de
                dados e conformidade com LGPD, refletindo as melhores praticas internacionais e
                nacionais de privacidade.
              </em>
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
