import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APP_INFO } from '@/lib/constants';

export default function ChangelogPage(): React.JSX.Element {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-4xl font-bold">Changelog</h1>
        <p className="mt-2 text-muted-foreground">
          Histórico de versões e atualizações do {APP_INFO.NAME}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Versão atual: <strong>{APP_INFO.VERSION}</strong>
        </p>
      </div>

      <div className="space-y-8">
        {/* Version 1.2.0 */}
        <div className="border-l-2 border-primary pl-6">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant="default" className="text-base">
              v{APP_INFO.VERSION}
            </Badge>
            <Badge variant="outline">Atual</Badge>
            <span className="text-sm text-muted-foreground">{APP_INFO.BUILD_DATE}</span>
          </div>

          <div className="space-y-6">
            {/* Segurança */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-blue-600 dark:text-blue-500">
                Seguranca
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>CSP com Nonces:</strong> Implementado Content Security Policy baseado em
                    nonces criptograficos via Next.js middleware, eliminando uso de unsafe-inline
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Cross-Origin Isolation:</strong> Adicionados headers COEP, COOP e CORP
                    para protecao contra ataques Spectre
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>CSP Expandido:</strong> Novos diretivas frame-src, worker-src e
                    manifest-src seguindo melhores praticas 2025
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>HSTS Preload:</strong> Strict-Transport-Security com includeSubDomains e
                    preload directive
                  </span>
                </li>
              </ul>
            </div>

            {/* Corrigido */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-500">
                Corrigido
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Corrigido middleware.ts: arquivo renomeado de proxy.ts e funcao exportada
                    corretamente para Next.js reconhecer
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Removidos atributos nonce invalidos de tags HTML (head/body) - Next.js aplica
                    nonces automaticamente
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Corrigido import de process em Edge Runtime usando process.env diretamente
                  </span>
                </li>
              </ul>
            </div>

            {/* Testes */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-purple-600 dark:text-purple-500">
                Testes
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Expandida cobertura de testes de seguranca de 4 para 20 testes (72 testes
                    totais)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Novos testes para generateNonce, CSP directives e security headers
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Version 1.1.3 */}
        <div className="border-l-2 border-muted pl-6">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-base">
              v1.1.3
            </Badge>
            <span className="text-sm text-muted-foreground">2025-10-01</span>
          </div>

          <div className="space-y-6">
            {/* Corrigido */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-500">
                Corrigido
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Corrigido erro React does not recognize the asChild prop on a DOM
                    element no componente Button ao remover a propagacao nao intencional da
                    prop para o elemento DOM nativo
                  </span>
                </li>
              </ul>
            </div>

            {/* Refatorado */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-blue-600 dark:text-blue-500">
                Refatorado
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Pagina de estatisticas agora busca dados da API Bun ao inves de computar
                    diretamente no servidor Next.js, resolvendo problemas de compilacao com
                    bun:sqlite no ambiente Next.js
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Melhorada a logica de inicializacao do banco de dados para lidar com requisitos
                    de runtime Bun de forma mais eficaz, incluindo verificacoes de ambiente e
                    tratamento de erros aprimorado
                  </span>
                </li>
              </ul>
            </div>

            {/* Documentação */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-purple-600 dark:text-purple-500">
                Documentacao
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Reorganizada estrutura de documentacao tecnica: movidos arquivos de revisao e
                    planos de agentes para o subdiretorio docs/AGENTS_PLAN/ para melhor organizacao
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Adicionada revisao Fresh Eyes Review (2025-10-01) documentando a
                    analise tecnica da arquitetura e melhorias prioritarias
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Version 1.0.2 */}
        <div className="border-l-2 border-muted pl-6">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-base">
              v1.0.2
            </Badge>
            <span className="text-sm text-muted-foreground">2025-09-30</span>
          </div>

          <div className="space-y-6">
            {/* Corrigido */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-500">
                🐛 Corrigido
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Ajustado o endpoint POST /api/generate-bets para validar o orçamento recebido e
                    utilizar generateOptimizedBets
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Eliminados avisos de implicit any nas páginas do dashboard ao tipar as respostas
                    das APIs
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Version 1.0.1 */}
        <div className="border-l-2 border-muted pl-6">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-base">
              v1.0.1
            </Badge>
            <span className="text-sm text-muted-foreground">2025-09-30</span>
          </div>

          <div className="space-y-6">
            {/* Modificado */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-blue-600 dark:text-blue-500">
                🔄 Modificado
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>BREAKING CHANGE:</strong> Migrado de better-sqlite3 para bun:sqlite
                    (SQLite nativo do Bun). Projeto agora requer Bun como runtime
                  </span>
                </li>
              </ul>
            </div>

            {/* Corrigido */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-500">
                🐛 Corrigido
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>CRÍTICO:</strong> Corrigido bug grave no cálculo de frequências de
                    números (lib/analytics/statistics.ts)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>CRÍTICO:</strong> Corrigidos timeouts na busca de dados históricos da
                    API CAIXA com timeout aumentado e melhor retry logic
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Version 1.0.0 */}
        <div className="border-l-2 border-muted pl-6">
          <div className="mb-4 flex items-center gap-3">
            <Badge variant="secondary" className="text-base">
              v1.0.0
            </Badge>
            <span className="text-sm text-muted-foreground">2025-09-30</span>
          </div>

          <div className="space-y-6">
            {/* Adicionado */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-green-600 dark:text-green-500">
                ✨ Adicionado
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Dashboard principal com navegação intuitiva</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Módulo de estatísticas avançadas da Mega-Sena com análise de frequência,
                    padrões de números pares/ímpares, distribuição por dezenas e análise de
                    sequências
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Gerador inteligente de apostas com suporte a apostas simples e múltiplas,
                    otimização de orçamento e seletor de estratégias
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Integração com API oficial da CAIXA para dados de sorteios</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Sistema de armazenamento local com SQLite</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Testes automatizados com Vitest para garantia de qualidade</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Documentação completa do projeto</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    Footer profissional com links para termos de serviço, política de privacidade e
                    recursos de jogo responsável
                  </span>
                </li>
              </ul>
            </div>

            {/* Segurança */}
            <div>
              <h3 className="mb-2 text-lg font-semibold text-blue-600 dark:text-blue-500">
                🔒 Segurança
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Implementação de Content Security Policy (CSP)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Proteção contra ataques XSS e CSRF</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Rate limiting nas chamadas de API</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Validação rigorosa de entrada de dados</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>Conformidade com LGPD (Lei Geral de Proteção de Dados)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Information */}
      <div className="mt-12 rounded-lg border bg-muted/50 p-6">
        <h3 className="mb-3 text-lg font-semibold">Sobre o Versionamento</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Este projeto segue o{' '}
            <a
              href="https://semver.org/lang/pt-BR/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Semantic Versioning
            </a>{' '}
            (SemVer):
          </p>
          <ul className="ml-4 space-y-1">
            <li>
              <strong>MAJOR</strong> (X.0.0): Mudanças incompatíveis na API
            </li>
            <li>
              <strong>MINOR</strong> (0.X.0): Funcionalidades adicionadas de forma retrocompatível
            </li>
            <li>
              <strong>PATCH</strong> (0.0.X): Correções de bugs retrocompatíveis
            </li>
          </ul>
        </div>

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Tipos de mudanças no changelog:</strong>
          </p>
          <ul className="ml-4 space-y-1">
            <li>✨ Adicionado - Novas funcionalidades</li>
            <li>🔄 Modificado - Mudanças em funcionalidades existentes</li>
            <li>⚠️ Depreciado - Funcionalidades que serão removidas</li>
            <li>🗑️ Removido - Funcionalidades removidas</li>
            <li>🐛 Corrigido - Correções de bugs</li>
            <li>🔒 Segurança - Correções de vulnerabilidades</li>
          </ul>
        </div>
      </div>

      {/* Repository Link */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Para ver o changelog completo e detalhes técnicos, visite o{' '}
          <a
            href={APP_INFO.REPOSITORY}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            repositório no GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}

