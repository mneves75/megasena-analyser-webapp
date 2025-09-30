import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPage(): React.JSX.Element {
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

      <article className="prose prose-slate dark:prose-invert max-w-none">
        <h1>Política de Privacidade</h1>
        <p className="text-muted-foreground">
          <strong>Última atualização: 30 de setembro de 2025</strong>
        </p>
        <p className="text-muted-foreground">
          <strong>Vigência: A partir de 30 de setembro de 2025</strong>
        </p>

        <h2>1. Introdução</h2>
        <p>
          A sua privacidade é importante para nós. Esta Política de Privacidade explica como o
          Mega-Sena Analyser (&quot;nós&quot;, &quot;nosso&quot;, &quot;Plataforma&quot;) coleta,
          usa, armazena e protege suas informações pessoais, em conformidade com a Lei Geral de
          Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e demais legislações aplicáveis.
        </p>

        <h2>2. Controlador de Dados</h2>
        <ul>
          <li>
            <strong>Controlador de Dados</strong>: Mega-Sena Analyser
          </li>
          <li>
            <strong>Encarregado de Dados (DPO)</strong>: privacy@
          </li>
          <li>
            <strong>Contato</strong>: legal@
          </li>
        </ul>

        <h2>3. Dados Coletados</h2>

        <h3>3.1 Dados Fornecidos Voluntariamente</h3>
        <p>Atualmente, o Mega-Sena Analyser opera principalmente no lado do cliente, coletando:</p>
        <ul>
          <li>
            <strong>Preferências de Uso</strong>: Configurações salvas localmente no navegador
          </li>
          <li>
            <strong>Dados de Apostas</strong>: Combinações geradas e orçamentos configurados
            (armazenados localmente)
          </li>
        </ul>

        <h3>3.2 Dados Coletados Automaticamente</h3>
        <p>Quando você acessa a Plataforma, podemos coletar automaticamente:</p>
        <ul>
          <li>Endereço IP</li>
          <li>Tipo de navegador e versão</li>
          <li>Sistema operacional</li>
          <li>Páginas visitadas</li>
          <li>Data e hora de acesso</li>
        </ul>

        <h3>3.3 Dados que NÃO Coletamos</h3>
        <ul>
          <li>
            <strong>Informações Financeiras</strong>: Não coletamos dados de cartão de crédito,
            conta bancária ou pagamento
          </li>
          <li>
            <strong>Documentos</strong>: Não solicitamos CPF, RG ou outros documentos
          </li>
          <li>
            <strong>Dados Sensíveis</strong>: Não coletamos dados sensíveis conforme definidos pela
            LGPD
          </li>
        </ul>

        <h2>4. Finalidades do Tratamento</h2>
        <p>Utilizamos seus dados para:</p>
        <ul>
          <li>Processar suas solicitações de análises estatísticas</li>
          <li>Gerar sugestões de apostas conforme suas preferências</li>
          <li>Armazenar suas configurações e preferências</li>
          <li>Fornecer suporte técnico</li>
          <li>Melhorar e desenvolver a Plataforma</li>
          <li>Prevenir fraudes e garantir segurança</li>
        </ul>

        <h2>5. Compartilhamento de Dados</h2>

        <h3>5.1 Não Vendemos Seus Dados</h3>
        <p>Nunca vendemos, alugamos ou comercializamos seus dados pessoais.</p>

        <h3>5.2 Compartilhamento Limitado</h3>
        <p>Podemos compartilhar dados apenas nas seguintes situações:</p>
        <ul>
          <li>
            <strong>Prestadores de Serviço</strong>: Empresas que nos auxiliam na operação sob
            contratos de confidencialidade
          </li>
          <li>
            <strong>Obrigação Legal</strong>: Quando exigido por lei ou autoridades competentes
          </li>
          <li>
            <strong>Proteção de Direitos</strong>: Para proteger nossos direitos e segurança
          </li>
        </ul>

        <h2>6. Armazenamento e Segurança</h2>

        <h3>6.1 Armazenamento Local</h3>
        <p>A maior parte dos dados é armazenada localmente em seu navegador através de:</p>
        <ul>
          <li>
            <strong>LocalStorage</strong>: Para preferências e configurações
          </li>
          <li>
            <strong>IndexedDB</strong>: Para dados de análise e histórico
          </li>
          <li>
            <strong>SQLite (client-side)</strong>: Para banco de dados local
          </li>
        </ul>

        <h3>6.2 Medidas de Segurança</h3>
        <p>Implementamos medidas técnicas e organizacionais, incluindo:</p>
        <ul>
          <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
          <li>Proteção contra XSS, CSRF e injeção SQL</li>
          <li>Content Security Policy (CSP)</li>
          <li>Controle de acesso baseado em função</li>
          <li>Auditorias e revisões periódicas</li>
        </ul>

        <h2>7. Seus Direitos sob a LGPD</h2>
        <p>Conforme a LGPD (Art. 18), você tem direito a:</p>
        <ul>
          <li>✅ Confirmar se tratamos seus dados e acessá-los</li>
          <li>✅ Corrigir dados incompletos, inexatos ou desatualizados</li>
          <li>✅ Solicitar anonimização, bloqueio ou eliminação de dados</li>
          <li>✅ Receber seus dados em formato estruturado (portabilidade)</li>
          <li>✅ Excluir dados tratados com seu consentimento</li>
          <li>✅ Saber com quem compartilhamos seus dados</li>
          <li>✅ Revogar consentimento a qualquer momento</li>
        </ul>

        <h3>Como Exercer Seus Direitos</h3>
        <p>Para exercer qualquer destes direitos:</p>
        <ul>
          <li>
            <strong>E-mail</strong>: privacy@megasena-analyser.com.br
          </li>
          <li>
            <strong>Prazo de Resposta</strong>: Até 15 dias conforme LGPD
          </li>
        </ul>

        <h3>Direito de Reclamação</h3>
        <p>Você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD):</p>
        <ul>
          <li>
            <strong>Website</strong>:{' '}
            <a href="https://www.gov.br/anpd/pt-br" target="_blank" rel="noopener noreferrer">
              https://www.gov.br/anpd/pt-br
            </a>
          </li>
          <li>
            <strong>E-mail</strong>: comunicacao@anpd.gov.br
          </li>
        </ul>

        <h2>8. Cookies e Tecnologias Similares</h2>
        <p>
          Utilizamos cookies essenciais para o funcionamento da Plataforma, cookies funcionais para
          lembrar suas preferências, e cookies analíticos para compreender o uso da Plataforma.
        </p>
        <p>Você pode gerenciar cookies através das configurações do seu navegador.</p>

        <h2>9. Privacidade de Menores</h2>
        <p>
          O Serviço é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de
          menores.
        </p>

        <h2>10. Alterações nesta Política</h2>
        <p>
          Podemos atualizar esta Política periodicamente. Mudanças materiais serão comunicadas com
          30 dias de antecedência.
        </p>

        <h2>11. Contato e Encarregado de Dados</h2>
        <p>Para questões sobre privacidade:</p>
        <ul>
          <li>
            <strong>Encarregado de Proteção de Dados (DPO)</strong>:
            privacy@megasena-analyser.com.br
          </li>
          <li>
            <strong>Assuntos Legais</strong>: legal@megasena-analyser.com.br
          </li>
          <li>
            <strong>Prazo de Resposta</strong>: Até 15 dias úteis conforme LGPD
          </li>
        </ul>

        <div className="not-prose mt-8 rounded-lg border border-blue-600 bg-blue-50 p-4 dark:bg-blue-950/20">
          <p className="font-semibold text-blue-900 dark:text-blue-500">📊 Resumo Executivo</p>
          <div className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-400">
            <p>
              <strong>Dados Coletados:</strong> Principalmente dados de uso local; mínimo de dados
              pessoais
            </p>
            <p>
              <strong>Armazenamento:</strong> Principalmente no seu navegador (local)
            </p>
            <p>
              <strong>Compartilhamento:</strong> Não vendemos; compartilhamento mínimo conforme
              necessário
            </p>
            <p>
              <strong>Segurança:</strong> Criptografia, HTTPS, proteções técnicas robustas
            </p>
            <p>
              <strong>Seus Direitos:</strong> Acesso, correção, exclusão, portabilidade e mais
            </p>
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          <p>
            <em>
              Esta Política foi elaborada com assessoria jurídica especializada em proteção de
              dados e conformidade com LGPD, refletindo as melhores práticas internacionais e
              nacionais de privacidade.
            </em>
          </p>
          <p className="mt-2">
            Para a versão completa da Política de Privacidade, consulte a{' '}
            <a
              href="https://github.com/megasena-analyser/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              documentação oficial
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
}

