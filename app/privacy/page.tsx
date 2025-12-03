import Link from 'next/link';
import { ArrowLeft, BarChart3, Sparkles, Shield } from 'lucide-react';
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

        <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="mb-0">Politica de Privacidade</h1>
          </div>

          <p className="text-muted-foreground text-sm">
            Ultima atualizacao: 3 de dezembro de 2025
          </p>

          <div className="not-prose my-8 rounded-xl border-2 border-green-500/50 bg-green-50 p-6 dark:bg-green-950/20">
            <p className="font-bold text-green-800 dark:text-green-400 text-lg mb-2">
              Resumo: Nao coletamos seus dados pessoais.
            </p>
            <p className="text-green-700 dark:text-green-500 text-sm">
              Sem cookies de rastreamento. Sem analytics. Sem cadastro.
              Tudo que voce faz aqui fica no seu navegador.
            </p>
          </div>

          <h2>1. Dados que NAO coletamos</h2>
          <ul>
            <li>Nome, e-mail ou qualquer dado de identificacao</li>
            <li>CPF, RG ou documentos</li>
            <li>Dados financeiros ou de pagamento</li>
            <li>Historico de navegacao ou comportamento</li>
            <li>Cookies de rastreamento ou analytics</li>
          </ul>

          <h2>2. Dados armazenados localmente</h2>
          <p>
            As informacoes abaixo ficam salvas <strong>apenas no seu navegador</strong> (localStorage)
            e nunca sao enviadas para nossos servidores:
          </p>
          <ul>
            <li>Preferencia de tema (claro/escuro)</li>
            <li>Apostas geradas</li>
            <li>Configuracoes de orcamento</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Voce pode apagar esses dados a qualquer momento limpando os dados do site no seu navegador.
          </p>

          <h2>3. Infraestrutura</h2>
          <p>
            Utilizamos Cloudflare como CDN e protecao DDoS. A Cloudflare pode registrar
            logs agregados de trafego (como numero de visitas por pais), mas esses dados
            sao anonimizados e nao identificam usuarios individuais.
          </p>

          <h2>4. Terceiros</h2>
          <p>
            Nao vendemos, alugamos ou compartilhamos dados com terceiros.
            Nao temos parceiros de publicidade ou marketing.
          </p>

          <h2>5. Seus direitos (LGPD)</h2>
          <p>
            Como nao coletamos dados pessoais identificaveis, nao ha dados para
            acessar, corrigir ou excluir em nossos sistemas. Os dados no seu navegador
            estao sob seu controle total.
          </p>
          <p>
            Para duvidas sobre privacidade no Brasil, consulte a{' '}
            <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noopener noreferrer">
              ANPD (Autoridade Nacional de Protecao de Dados)
            </a>.
          </p>

          <h2>6. Sobre a Plataforma</h2>
          <p>
            O Mega-Sena Analyzer e um projeto independente de analise estatistica,
            desenvolvido para fins educacionais. Nao possui vinculo com a Caixa
            Economica Federal ou qualquer operador de loterias.
          </p>

          <div className="not-prose mt-8 rounded-lg border border-muted bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Esta politica pode ser atualizada. Recomendamos revisita-la periodicamente.
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
