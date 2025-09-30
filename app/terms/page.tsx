import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage(): React.JSX.Element {
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
        <h1>Termos de Serviço</h1>
        <p className="text-muted-foreground">
          <strong>Última atualização: 30 de setembro de 2025</strong>
        </p>

        <h2>1. Aceitação dos Termos</h2>
        <p>
          Ao acessar e utilizar o Mega-Sena Analyser (&quot;Serviço&quot;, &quot;Plataforma&quot;,
          &quot;Aplicação&quot;), você (&quot;Usuário&quot;, &quot;Você&quot;) concorda em ficar
          vinculado a estes Termos de Serviço (&quot;Termos&quot;). Se você não concordar com
          qualquer parte destes termos, não utilize o Serviço.
        </p>

        <h2>2. Descrição do Serviço</h2>
        <p>
          O Mega-Sena Analyser é uma ferramenta de análise estatística e geração de sugestões de
          apostas para a loteria Mega-Sena, operada pela Caixa Econômica Federal. O Serviço
          oferece:
        </p>
        <ul>
          <li>Análise estatística de resultados históricos</li>
          <li>Visualização de padrões e tendências</li>
          <li>Geração automatizada de sugestões de apostas</li>
          <li>Ferramentas de gestão de orçamento para apostas</li>
        </ul>

        <h2>3. Natureza Informativa e Limitações</h2>

        <h3>3.1 Sem Garantias de Resultados</h3>
        <p>O Usuário reconhece e concorda expressamente que:</p>
        <ul>
          <li>
            <strong>Aleatoriedade</strong>: A Mega-Sena é um jogo de sorte completamente aleatório.
            Nenhuma análise estatística, por mais sofisticada que seja, pode prever ou influenciar
            os resultados futuros.
          </li>
          <li>
            <strong>Análise Histórica</strong>: As estatísticas apresentadas baseiam-se
            exclusivamente em resultados passados e não garantem resultados futuros.
          </li>
          <li>
            <strong>Probabilidades</strong>: Todas as combinações de números possuem a mesma
            probabilidade matemática de serem sorteadas, independentemente de padrões históricos.
          </li>
          <li>
            <strong>Sem Vantagem</strong>: O uso desta ferramenta não aumenta suas chances de
            ganhar na loteria.
          </li>
        </ul>

        <h3>3.2 Finalidade Educacional</h3>
        <p>O Serviço tem finalidade educacional e recreativa, destinado a:</p>
        <ul>
          <li>Compreender conceitos básicos de probabilidade e estatística</li>
          <li>Visualizar dados históricos da Mega-Sena</li>
          <li>Auxiliar na organização de apostas de forma estruturada</li>
        </ul>

        <h2>4. Responsabilidades do Usuário</h2>

        <h3>4.1 Uso Responsável</h3>
        <p>O Usuário compromete-se a:</p>
        <ul>
          <li>Utilizar o Serviço de forma lícita e responsável</li>
          <li>Não apostar valores que não pode perder</li>
          <li>Reconhecer que jogos de azar podem ser viciantes</li>
          <li>Buscar ajuda profissional caso identifique comportamento de jogo compulsivo</li>
          <li>Respeitar as leis e regulamentos aplicáveis em sua jurisdição</li>
        </ul>

        <h3>4.2 Maioridade e Capacidade Legal</h3>
        <ul>
          <li>O Usuário declara ser maior de 18 anos</li>
          <li>Possui capacidade legal para aceitar estes Termos</li>
          <li>Está autorizado a apostar em loterias segundo as leis de sua jurisdição</li>
        </ul>

        <h2>5. Limitação de Responsabilidade</h2>

        <h3>5.1 Isenção de Garantias</h3>
        <p>
          O SERVIÇO É FORNECIDO &quot;NO ESTADO EM QUE SE ENCONTRA&quot; E &quot;CONFORME
          DISPONÍVEL&quot;, SEM GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLÍCITAS, INCLUINDO, MAS
          NÃO SE LIMITANDO A:
        </p>
        <ul>
          <li>Garantias de comercialização</li>
          <li>Adequação a uma finalidade específica</li>
          <li>Não violação de direitos</li>
          <li>Precisão, confiabilidade ou completude das informações</li>
        </ul>

        <h3>5.2 Limitação de Danos</h3>
        <p>
          EM NENHUMA CIRCUNSTÂNCIA OS DESENVOLVEDORES, MANTENEDORES OU CONTRIBUIDORES DO MEGA-SENA
          ANALYSER SERÃO RESPONSÁVEIS POR:
        </p>
        <ul>
          <li>Perdas financeiras decorrentes de apostas</li>
          <li>Decisões de apostas baseadas nas informações fornecidas</li>
          <li>Lucros cessantes ou perda de oportunidades</li>
          <li>Danos indiretos, incidentais, especiais ou consequenciais</li>
          <li>Perda de dados ou interrupção de negócios</li>
        </ul>

        <h2>6. Jogo Responsável</h2>

        <h3>6.1 Recursos de Conscientização</h3>
        <p>Reconhecemos que o jogo compulsivo é um problema sério. Recomendamos:</p>
        <ul>
          <li>
            <strong>Estabeleça Limites</strong>: Defina quanto pode gastar e nunca exceda esse
            valor
          </li>
          <li>
            <strong>Jogue por Diversão</strong>: Não tente recuperar perdas
          </li>
          <li>
            <strong>Busque Ajuda</strong>: Se o jogo está afetando sua vida, procure ajuda
            profissional
          </li>
        </ul>

        <h3>6.2 Recursos de Apoio</h3>
        <ul>
          <li>
            <strong>CVV (Centro de Valorização da Vida)</strong>: 188 (24h, gratuito)
          </li>
          <li>
            <strong>Jogadores Anônimos</strong>:{' '}
            <a
              href="https://www.jogadoresanonimos.com.br"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://www.jogadoresanonimos.com.br
            </a>
          </li>
          <li>
            <strong>CAPS (Centro de Atenção Psicossocial)</strong>: Consulte sua cidade
          </li>
        </ul>

        <h2>7. Lei Aplicável</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil, em conformidade
          com:
        </p>
        <ul>
          <li>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</li>
          <li>Marco Civil da Internet (Lei nº 12.965/2014)</li>
          <li>Código de Defesa do Consumidor (Lei nº 8.078/1990)</li>
        </ul>

        <h2>8. Contato</h2>
        <p>Para questões sobre estes Termos:</p>
        <ul>
          <li>
            <strong>E-mail</strong>: legal@megasena-analyser.com.br
          </li>
        </ul>

        <div className="not-prose mt-8 rounded-lg border border-yellow-600 bg-yellow-50 p-4 dark:bg-yellow-950/20">
          <p className="font-semibold text-yellow-900 dark:text-yellow-500">
            ⚠️ IMPORTANTE: LEIA COM ATENÇÃO
          </p>
          <p className="mt-2 text-sm text-yellow-800 dark:text-yellow-400">
            AO UTILIZAR O MEGA-SENA ANALYSER, VOCÊ RECONHECE TER LIDO, COMPREENDIDO E CONCORDADO
            COM ESTES TERMOS DE SERVIÇO NA ÍNTEGRA. A loteria é um jogo de sorte. Jogue com
            responsabilidade e apenas com valores que pode perder.
          </p>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          <p>
            <em>
              Estes Termos foram elaborados com assessoria jurídica especializada em direito do
              consumidor, direito digital e proteção de dados pessoais, em conformidade com a
              legislação brasileira vigente.
            </em>
          </p>
          <p className="mt-2">
            Para a versão completa dos Termos de Serviço, consulte a{' '}
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

