import Link from 'next/link';
import { APP_INFO } from '@/lib/constants';

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* About Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Sobre o Projeto</h3>
            <p className="text-sm text-muted-foreground">
              Ferramenta de análise estatística da Mega-Sena para visualização de padrões e geração
              de sugestões de apostas baseadas em dados históricos.
            </p>
            <p className="text-xs text-muted-foreground">
              Versão {APP_INFO.VERSION} • Build {APP_INFO.BUILD_DATE}
            </p>
          </div>

          {/* Legal Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Termos de Serviço
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Recursos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/statistics"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Estatísticas
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/generator"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Gerador de Apostas
                </Link>
              </li>
            </ul>
          </div>

          {/* Responsible Gaming Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Jogo Responsável</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Jogue com responsabilidade. A loteria é um jogo de sorte.</p>
              <div className="space-y-1 text-xs">
                <p className="font-medium text-foreground">Precisa de ajuda?</p>
                <p>CVV: 188 (24h, gratuito)</p>
                <p>
                  <a
                    href="https://www.jogadoresanonimos.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Jogadores Anônimos
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 border-t pt-6">
          <div className="space-y-3 text-xs text-muted-foreground">
            <p className="font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ AVISO IMPORTANTE
            </p>
            <p>
              Esta ferramenta tem finalidade <strong>educacional e recreativa</strong>. As análises
              estatísticas são baseadas em resultados históricos e{' '}
              <strong>não garantem resultados futuros</strong>. A Mega-Sena é um jogo de sorte
              completamente aleatório. Todas as combinações têm a mesma probabilidade matemática de
              serem sorteadas. O uso desta ferramenta não aumenta suas chances de ganhar.
            </p>
            <p>
              Este projeto não é afiliado, patrocinado ou endossado pela Caixa Econômica Federal.
              Os dados de sorteios são obtidos de fontes públicas oficiais.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 border-t pt-6">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground md:flex-row">
            <p>
              © {currentYear} {APP_INFO.NAME}. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4">
              <p>Desenvolvido com dados públicos da CAIXA</p>
              <span className="hidden md:inline">•</span>
              <p className="hidden md:inline">Conformidade: LGPD</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

