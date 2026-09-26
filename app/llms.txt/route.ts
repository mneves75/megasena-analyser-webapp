import { absoluteUrl } from '@/lib/seo/metadata';
import { formatDate, formatNumber } from '@/lib/utils';
import { loadArchiveIndex } from '@/app/_lib/archive';
import { dezena, joinPtBr, senaOutcome } from '@/app/_lib/format';

export const dynamic = 'force-dynamic';

/** Plain-text site guide for AI agents, following the llmstxt.org layout. */
export async function GET(): Promise<Response> {
  const { archive, recent, years } = await loadArchiveIndex();
  const latest = recent[0];
  const oldestYear = years.at(-1)?.year;
  const newestYear = years[0]?.year;

  const lines = [
    '# Mega-Sena Analyzer',
    '',
    '> Arquivo público e gratuito com os resultados oficiais de todos os concursos da Mega-Sena (fonte: CAIXA Econômica Federal), estatísticas descritivas de cada número de 1 a 60 e um gerador de apostas por orçamento. Não há previsão: a Mega-Sena é aleatória e cada concurso é independente.',
    '',
    ...(latest
      ? [
          `Dados até o concurso ${latest.contestNumber} (${formatDate(latest.drawDate)}): ${joinPtBr(
            latest.numbers.map(dezena)
          )}. ${senaOutcome(latest)} O arquivo tem ${formatNumber(archive.totalDraws)} concursos${
            oldestYear ? `, de ${oldestYear} a ${newestYear}` : ''
          }. A base é atualizada periodicamente, não em tempo real.`,
          '',
        ]
      : []),
    '## Resultados',
    '',
    `- [Resultados da Mega-Sena](${absoluteUrl('/resultados')}): último concurso, últimos sorteios e arquivo por ano.`,
    ...(latest
      ? [
          `- [Concurso ${latest.contestNumber}](${absoluteUrl(`/concurso/${latest.contestNumber}`)}): dezenas, ganhadores e prêmios por faixa, e análise do sorteio mais recente do arquivo.`,
          `- Cada concurso tem uma página em ${absoluteUrl('/concurso/')}{número}, de 1 a ${latest.contestNumber}.`,
        ]
      : []),
    ...(oldestYear
      ? [`- Cada ano tem uma página em ${absoluteUrl('/resultados/')}{ano}, de ${oldestYear} a ${newestYear}.`]
      : []),
    `- [Mega da Virada](${absoluteUrl('/mega-da-virada')}): dezenas, ganhadores e prêmios de todas as edições desde 2009, e as regras oficiais do concurso especial de fim de ano.`,
    '',
    '## Números',
    '',
    `- [Números de 1 a 60](${absoluteUrl('/numeros')}): frequência, posição no ranking e atraso de cada número.`,
    `- Cada número tem uma página em ${absoluteUrl('/numeros/')}{1 a 60} com frequência, atraso, intervalo médio, maior sequência sem sair e dezenas que mais saíram junto.`,
    '',
    '## Ferramentas',
    '',
    `- [Estatísticas detalhadas](${absoluteUrl('/dashboard/statistics')}): frequências, atrasos, pares, paridade, primos e somas.`,
    `- [Gerador de apostas](${absoluteUrl('/dashboard/generator')}): distribui um orçamento entre apostas simples e múltiplas; não aumenta a chance de ganhar.`,
    '',
    '## Sobre',
    '',
    `- [Metodologia e fonte dos dados](${absoluteUrl('/about')})`,
    `- [Termos de uso](${absoluteUrl('/terms')})`,
    `- [Política de privacidade](${absoluteUrl('/privacy')})`,
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Cloudflare-CDN-Cache-Control': 'max-age=600',
    },
  });
}
