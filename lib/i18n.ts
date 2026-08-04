export const pt = {
  app: {
    name: 'Mega-Sena Analyzer',
    shortDescription: 'Análise estatística avançada e gerador inteligente de apostas',
  },
  meta: {
    home: {
      title: 'Mega-Sena Analyzer | Estatísticas e Gerador de Apostas',
      description:
        'Análise avançada de dados históricos da Mega-Sena. Estatísticas de frequência, padrões e gerador inteligente de apostas. Ferramenta gratuita e educacional.',
      openGraphDescription:
        'Análise avançada de dados históricos da Mega-Sena com estatísticas, padrões e gerador inteligente de apostas.',
    },
    dashboard: {
      title: 'Dashboard',
      description:
        'Dashboard da Mega-Sena com estatísticas em tempo real, últimos sorteios, números mais frequentes e taxa de acumulação. Dados atualizados da CAIXA.',
      openGraphDescription:
        'Visão geral das estatísticas e últimos sorteios da Mega-Sena com dados atualizados.',
    },
    generator: {
      title: 'Gerador de Apostas',
      description:
        'Gerador inteligente de apostas da Mega-Sena com estratégias baseadas em estatísticas. Otimize seu orçamento e crie combinações diversificadas.',
      openGraphDescription:
        'Sistema inteligente de geração de apostas que minimiza desperdício de orçamento.',
    },
    statistics: {
      title: 'Estatísticas Detalhadas',
      description:
        'Estatísticas completas da Mega-Sena: frequências, padrões, atrasos, dezenas, pares frequentes, paridade, primos, soma e correlação com prêmios.',
      openGraphDescription:
        'Análise completa de frequências e padrões dos sorteios da Mega-Sena.',
    },
    privacy: {
      title: 'Política de Privacidade',
      description:
        'Política de privacidade do Mega-Sena Analyzer. Coletamos apenas telemetria operacional mínima para segurança e disponibilidade. Sem cookies de rastreamento. Sem analytics de marketing.',
      openGraphDescription:
        'Coletamos apenas o mínimo necessário para operar o serviço com segurança.',
    },
    terms: {
      title: 'Termos de Uso',
      description:
        'Termos de uso do Mega-Sena Analyzer. Ferramenta de visualização de dados históricos para fins educacionais. Não aumenta chances de ganhar.',
      openGraphDescription: 'Termos de uso e isenção de responsabilidade do Mega-Sena Analyzer.',
    },
    privacyRights: {
      title: 'Direitos do Titular (LGPD)',
      description:
        'Exerça seus direitos LGPD junto ao Mega-Sena Analyzer: acesso, correção, anonimização, eliminação, portabilidade e informação de compartilhamento.',
      openGraphDescription: 'Como exercer seus direitos LGPD junto ao Mega-Sena Analyzer.',
    },
  },
  nav: {
    dashboard: 'Dashboard',
    statistics: 'Estatísticas',
    generator: 'Gerar Apostas',
    back: 'Voltar',
    backToDashboard: 'Voltar ao Dashboard',
    backToPrivacy: 'Voltar à Política de Privacidade',
    accessDashboard: 'Acessar Dashboard',
  },
  theme: {
    toggle: 'Alternar tema',
    switchToLight: 'Mudar para tema claro',
    switchToDark: 'Mudar para tema escuro',
  },
  common: {
    importantNotice: 'Aviso importante',
    errorLabel: 'Erro',
    tipLabel: 'Dica',
    lastUpdated: 'Última atualização',
    occurrences: 'ocorrências',
  },
  errors: {
    notFound: {
      title: 'Página não encontrada',
      description:
        'Não foi possível encontrar esta página. Verifique o endereço ou volte ao início.',
      action: 'Voltar ao início',
    },
    generic: {
      title: 'Algo deu errado',
      description:
        'Ocorreu um erro inesperado. Tente novamente em alguns instantes.',
      action: 'Tentar novamente',
    },
  },
  loading: {
    app: {
      title: 'Carregando aplicação',
      description: 'Preparando dados e configurações iniciais.',
    },
    dashboard: {
      title: 'Carregando dashboard',
      description: 'Atualizando estatísticas e últimos sorteios.',
    },
    generator: {
      title: 'Carregando gerador',
      description: 'Preparando estratégias e controles de apostas.',
    },
    statistics: {
      title: 'Carregando estatísticas',
      description: 'Processando indicadores e análises completas.',
    },
  },
  home: {
    heroTitle: 'Mega-Sena Analyzer',
    heroSubtitle:
      'Análise estatística avançada e gerador inteligente de apostas baseado em ciência de dados',
    features: [
      {
        title: 'Estatísticas Completas',
        description: 'Análise de frequência, padrões e tendências históricas',
      },
      {
        title: 'Números Quentes',
        description: 'Identifique os números mais sorteados',
      },
      {
        title: 'Gerador Inteligente',
        description: 'Crie apostas baseadas em estratégias avançadas',
      },
      {
        title: 'Análise em Tempo Real',
        description: 'Dados atualizados da API oficial da CAIXA',
      },
    ],
    disclaimer: {
      title: 'Aviso importante',
      text:
        'Esta ferramenta NÃO aumenta suas chances de ganhar. A Mega-Sena é puramente aleatória. Jogue com responsabilidade.',
      termsLinkLabel: 'Termos de uso',
    },
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Visão geral das estatísticas e últimos sorteios da Mega-Sena',
    stats: {
      totalDraws: 'Total de Sorteios',
      totalDrawsDescription: 'Sorteios registrados',
      lastDraw: 'Último Sorteio',
      accumulationRate: 'Taxa de Acumulação',
      accumulationDescriptionSuffix: 'sorteios acumulados',
      averagePrizeSena: 'Prêmio Médio Sena',
      averagePrizeDescription: 'Média de prêmios pagos',
    },
    sections: {
      mostFrequent: 'Números Mais Sorteados',
      mostFrequentDescription: 'Top 10 números com maior frequência',
      leastFrequent: 'Números Menos Sorteados',
      leastFrequentDescription: 'Top 10 números com menor frequência',
      recentDraws: 'Últimos Sorteios',
      recentDrawsDescription: 'Histórico recente da Mega-Sena',
      hotNumbersTitle: 'Números em Alta (Últimos 10 Sorteios)',
      hotNumbersDescription: 'Números com maior intensidade de aparição recente',
      accumulated: 'Acumulado',
      notAccumulated: 'Não acumulado',
      prizeLabel: 'Prêmio',
      contestLabel: 'Concurso',
    },
    actions: {
      statisticsTitle: 'Estatísticas Detalhadas',
      statisticsDescription: 'Análise completa de frequências, padrões e tendências',
      generatorTitle: 'Gerador de Apostas',
      generatorDescription: 'Crie apostas inteligentes baseadas em estratégias avançadas',
    },
  },
  generatorPage: {
    title: 'Gerador de Apostas Otimizado',
    subtitle: 'Sistema inteligente de geração de apostas que minimiza desperdício de orçamento',
    disclaimer: {
      title: 'Aviso Estatístico',
      text:
        'Sorteios de loteria são eventos aleatórios e independentes. Nenhuma estratégia pode prever resultados futuros. Este sistema oferece ferramentas de seleção baseadas em heurísticas estatísticas, não garantias de ganho. O valor esperado de qualquer aposta é negativo devido à margem da casa.',
    },
  },
  generatorForm: {
    errorPrefix: 'Erro',
    errorFallback: 'Erro ao gerar apostas. Tente novamente.',
    emptyState: {
      title: 'Pronto para gerar apostas?',
      description:
        'Configure seu orçamento, escolha uma estratégia e um modo de geração, depois clique em "Gerar Apostas" para começar.',
      helper: 'Sistema otimizado minimiza desperdício do seu orçamento',
    },
    help: {
      title: 'Como funciona?',
      steps: [
        {
          title: '1. Defina o Orçamento',
          description: 'Escolha quanto deseja investir nas apostas. Mínimo de R$ 6,00.',
        },
        {
          title: '2. Configure a Estratégia',
          description: 'Escolha como os números serão selecionados: aleatório, quentes, frios, etc.',
        },
        {
          title: '3. Selecione o Modo',
          description:
            'Otimizado minimiza desperdício. Simples, Mista ou Múltipla para preferências específicas.',
        },
      ],
    },
  },
  betGenerator: {
    budget: {
      title: 'Orçamento',
      description: 'Defina o valor disponível para suas apostas',
      customValue: 'Valor Personalizado',
      quickValues: 'Valores Rápidos',
      selectedBudget: 'Orçamento selecionado:',
      minValueLabel: 'Valor mínimo:',
      maxValueLabel: 'Valor máximo:',
      optimizedLimitHint:
        'No modo Otimizado o limite é de R$ 20.000. Para valores maiores, escolha outro modo de geração.',
      placeholder: '0,00',
      currencyPrefix: 'R$',
    },
    controls: {
      title: 'Configurações de Geração',
      description: 'Escolha a estratégia e o modo de geração das apostas',
      strategyLabel: 'Estratégia de Números',
      modeLabel: 'Modo de Geração',
      infoTitle: 'Dica',
      infoOptimized:
        'O modo Otimizado é recomendado para maximizar o uso do seu orçamento.',
      infoBalanced:
        'A estratégia Balanceada combina análise histórica para resultados equilibrados.',
      generate: 'Gerar Apostas',
      generating: 'Gerando apostas...',
    },
    strategies: [
      {
        value: 'balanced',
        label: 'Balanceada',
        description: 'Mix de números quentes e frios',
      },
      {
        value: 'hot_numbers',
        label: 'Quentes',
        description: 'Mais sorteados',
      },
      {
        value: 'cold_numbers',
        label: 'Frios',
        description: 'Menos sorteados',
      },
      {
        value: 'random',
        label: 'Aleatória',
        description: 'Totalmente aleatório',
      },
      {
        value: 'fibonacci',
        label: 'Fibonacci',
        description: 'Sequência matemática',
      },
    ],
    modes: [
      {
        value: 'optimized',
        label: 'Otimizada',
        description: 'Minimiza desperdício do orçamento',
      },
      {
        value: 'simple_only',
        label: 'Apenas Simples',
        description: 'Somente apostas de 6 números',
      },
      {
        value: 'mixed',
        label: 'Mista',
        description: '60% múltiplas, 40% simples',
      },
      {
        value: 'multiple_only',
        label: 'Apenas Múltipla',
        description: 'Uma aposta múltipla (7-15 números)',
      },
    ],
    summary: {
      title: 'Resumo das Apostas',
      generatedSingle: 'aposta gerada',
      generatedPlural: 'apostas geradas',
      totalCost: 'Custo Total',
      utilization: 'Utilização',
      utilizationGreat: 'Ótimo',
      uniqueNumbers: 'Números Únicos',
      remaining: 'Restante',
      average: 'Média',
      simpleLabel: 'simples',
      multipleSingle: 'múltipla',
      multiplePlural: 'múltiplas',
      previous: 'Anterior',
      next: 'Próxima',
      pageInfoPrefix: 'Exibindo',
      pageInfoMiddle: 'a',
      pageInfoSuffix: 'de',
      betsLabel: 'apostas',
      remainingTipPrefix: 'Você ainda tem',
      remainingTipSuffix: 'disponível. Considere aumentar o orçamento para maximizar a utilização.',
    },
    betCard: {
      betLabel: 'Aposta',
      costLabel: 'Custo',
      copy: 'Copiar',
      copied: 'Copiado',
      strategyLabel: 'Estratégia',
      strategyFallbackSuffix: '(complementada)',
      numbersLabel: 'números',
      typeSimple: 'Simples',
      typeMultiplePrefix: 'Múltipla',
    },
  },
  statistics: {
    title: 'Estatísticas Detalhadas',
    subtitle: 'Análise completa de frequências e padrões dos sorteios',
    freshness: {
      title: 'Base de referência',
      descriptionPrefix: 'Dados atualizados até o concurso',
      onDatePrefix: 'em',
      totalDrawsLabel: 'Total de sorteios processados',
    },
    hotNumbersTitle: 'Números Quentes (Top 20)',
    hotNumbersDescription: 'Números mais sorteados historicamente',
    coldNumbersTitle: 'Números Frios (Top 20)',
    coldNumbersDescription: 'Números menos sorteados historicamente',
    patterns: {
      title: 'Padrões Detectados',
      description: 'Análise de padrões nos sorteios históricos',
      typeLabel: 'Tipo',
      lastSeenLabel: 'Última ocorrência',
      occurrencesLabel: 'ocorrências',
      descriptions: {
        consecutive: 'Números consecutivos no sorteio',
        all_even: 'Todos os números pares',
      },
    },
    delays: {
      title: 'Análise de Atraso',
      description: 'Quantos sorteios desde a última aparição de cada número',
      drawsLabel: 'sorteios',
      distributionTitle: 'Distribuição de Atrasos',
    },
    delayCategories: {
      recent: 'Recente',
      normal: 'Normal',
      overdue: 'Atrasado',
      critical: 'Crítico',
    },
    decades: {
      title: 'Distribuição por Dezena',
      description: 'Análise de frequência por faixas de números',
      occurrencesLabel: 'Ocorrências',
      percentageLabel: 'Percentual',
      topNumbersLabel: 'Top números',
    },
    pairs: {
      title: 'Pares Mais Frequentes',
      description: 'Números que aparecem juntos com maior frequência',
      correlationLabel: 'Correlação',
    },
    parity: {
      title: 'Distribuição Par/Ímpar',
      description: 'Análise da quantidade de números pares vs ímpares',
      evenLabel: 'Pares',
      oddLabel: 'Ímpares',
      mostCommonLabel: 'Mais Comum',
      balancedLabel: 'Distribuições Balanceadas (2-4, 3-3, 4-2)',
      drawsLabel: 'dos sorteios',
    },
    primes: {
      title: 'Análise de Números Primos',
      description: 'Distribuição e frequência de números primos (2, 3, 5, 7, 11, 13, ...)',
      totalLabel: 'Total de Primos',
      totalSuffix: 'de 60 números',
      averageLabel: 'Média por Sorteio',
      averageSuffix: 'números primos',
      mostCommonLabel: 'Mais Comum',
      mostCommonSuffix: 'primos por sorteio',
      distributionTitle: 'Distribuição de Primos por Sorteio',
      topTitle: 'Top 10 Números Primos Mais Sorteados',
    },
    sum: {
      title: 'Distribuição de Soma',
      description: 'Análise estatística da soma dos 6 números sorteados',
      meanLabel: 'Média',
      medianLabel: 'Mediana',
      modeLabel: 'Moda',
      stdDevLabel: 'Desvio Padrão',
      percentileLabel: 'Percentil',
      rangeLabel: 'Intervalo',
    },
    streaks: {
      title: 'Números em Sequência (Últimos 10 Sorteios)',
      description: 'Números com maior e menor intensidade de aparição recente',
      disclaimerTitle: 'Nota estatística',
      disclaimerBody:
        'Cada sorteio é um evento independente. A frequência recente de um número não influencia sua probabilidade em sorteios futuros. Esta análise é apenas histórica e não possui valor preditivo.',
      hotTitle: 'Números Quentes (Alta Intensidade)',
      coldTitle: 'Números Frios (Baixa Intensidade)',
    },
    prizeCorrelation: {
      title: 'Correlação com Prêmios',
      description: 'Números que historicamente aparecem em sorteios com maiores prêmios',
      disclaimerTitle: 'Nota estatística',
      disclaimerBody:
        'Os valores dos prêmios dependem do acúmulo do jackpot e do número de ganhadores, não dos números sorteados. Esta correlação é coincidência estatística, não indica causalidade.',
      luckyTitle: 'Números "Sortudos" (Prêmios Acima da Média)',
      unluckyTitle: 'Números com Prêmios Abaixo da Média',
      averagePrizeLabel: 'Prêmio Médio Sena',
      correlationLabel: 'Correlação',
    },
    allNumbers: {
      title: 'Todos os Números (1-60)',
      description: 'Frequência completa de todos os números possíveis',
    },
  },
  terms: {
    title: 'Termos de Uso',
    updatedAt: '3 de dezembro de 2025',
    warningTitle: 'AVISO IMPORTANTE',
    warningIntro: 'Esta ferramenta NÃO aumenta suas chances de ganhar na loteria.',
    warningBody:
      'A Mega-Sena é um jogo puramente aleatório. Cada sorteio é independente. Padrões históricos não predizem resultados futuros. Todas as combinações têm exatamente a mesma probabilidade.',
    sections: [
      {
        title: '1. O que é esta ferramenta',
        paragraphs: [
          'O Mega-Sena Analyzer é uma ferramenta de visualização de dados históricos da Mega-Sena para fins educacionais e recreativos. Oferece:',
        ],
        items: [
          'Estatísticas de frequência de números sorteados',
          'Visualização de padrões históricos',
          'Geração de combinações aleatórias para apostas',
        ],
      },
      {
        title: '2. O que esta ferramenta NÃO é',
        items: [
          'NÃO é um sistema de previsão de resultados',
          'NÃO é uma estratégia para aumentar chances de ganhar',
          'NÃO possui nenhum algoritmo capaz de prever números',
          'NÃO tem vínculo com a Caixa Econômica Federal',
        ],
      },
      {
        title: '3. Sua responsabilidade',
        paragraphs: ['Ao usar esta ferramenta, você declara que:'],
        items: [
          'Tem 18 anos ou mais',
          'Entende que loteria é jogo de azar',
          'Aceita total responsabilidade por suas decisões de apostas',
          'Apostará apenas valores que pode perder',
        ],
      },
    ],
    liability: {
      title: '4. ISENÇÃO DE RESPONSABILIDADE',
      subtitle: 'O serviço é fornecido "como está" (as is), sem garantias de qualquer tipo.',
      intro: 'NÃO nos responsabilizamos por:',
      items: [
        'Perdas financeiras de qualquer natureza',
        'Decisões de apostas baseadas nas informações exibidas',
        'Interpretação incorreta das estatísticas',
        'Indisponibilidade ou erros da plataforma',
        'Danos diretos, indiretos ou consequenciais',
      ],
    },
    responsibleGaming: {
      title: '5. Jogo responsável',
      intro: 'Se você ou alguém próximo está enfrentando problemas com jogos de azar:',
      items: [
        {
          label: 'CVV',
          value: '188 (24h, gratuito)',
        },
        {
          label: 'Jogadores Anônimos',
          value: 'jogadoresanonimos.com.br',
          href: 'https://www.jogadoresanonimos.com.br',
        },
      ],
    },
    changes: {
      title: '6. Alterações',
      body:
        'Estes termos podem ser alterados a qualquer momento. O uso continuado da plataforma após alterações constitui aceitação dos novos termos.',
    },
    law: {
      title: '7. Lei aplicável',
      body: 'Estes termos são regidos pelas leis da República Federativa do Brasil.',
    },
    closingNote:
      'Ao utilizar o Mega-Sena Analyzer, você confirma ter lido e concordado com estes termos.',
    faqs: [
      {
        question: 'O Mega-Sena Analyzer aumenta minhas chances de ganhar?',
        answer:
          'Não. Esta ferramenta NÃO aumenta suas chances de ganhar na loteria. A Mega-Sena é um jogo puramente aleatório e cada sorteio é independente.',
      },
      {
        question: 'O que é o Mega-Sena Analyzer?',
        answer:
          'É uma ferramenta de visualização de dados históricos da Mega-Sena para fins educacionais e recreativos. Oferece estatísticas de frequência, visualização de padrões e geração de combinações aleatórias.',
      },
      {
        question: 'O serviço é gratuito?',
        answer:
          'Sim, o Mega-Sena Analyzer é totalmente gratuito. Não cobramos por nenhuma funcionalidade.',
      },
      {
        question: 'Posso usar as estatísticas para prever números?',
        answer:
          'Não. Padrões históricos não predizem resultados futuros. Todas as combinações têm exatamente a mesma probabilidade de serem sorteadas.',
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidade',
    updatedAt: '20 de maio de 2026',
    summaryTitle: 'Resumo: Coletamos o mínimo necessário para operar o serviço.',
    summaryBody:
      'Sem cadastro, sem autenticação, sem cookies HTTP, sem analytics de marketing. Pseudonimizamos identificadores técnicos (HMAC-SHA256) e mantemos apenas telemetria operacional mínima para segurança, auditoria e disponibilidade.',
    controllerTitle: 'Controlador e Encarregado (DPO)',
    controllerRows: [
      { label: 'Controlador', value: 'Equipe Mega-Sena Analyzer (projeto independente)' },
      { label: 'Encarregado (DPO)', value: 'Encarregado de Proteção de Dados — Mega-Sena Analyzer' },
      { label: 'Canal de privacidade', value: 'privacidade@megasena-analyzer.com.br' },
      { label: 'Site', value: 'https://megasena-analyzer.com.br' },
    ],
    rightsCtaTitle: 'Exercer direitos do titular',
    rightsCtaBody:
      'Envie sua solicitação para privacidade@megasena-analyzer.com.br. Confirmamos o recebimento em até 72 horas e respondemos em até 15 dias corridos, conforme o Art. 19 da LGPD.',
    rightsCtaLinkLabel: 'Passo a passo em /privacy/direitos',
    rightsCtaLinkHref: '/privacy/direitos',
    sections: [
      {
        title: '1. Dados que NÃO coletamos',
        items: [
          'Nome, e-mail, telefone ou qualquer dado de identificação direta',
          'CPF, RG ou documentos',
          'Dados financeiros ou de pagamento',
          'Dados sensíveis (Art. 5º, II — saúde, biometria, religião, etc.)',
          'Histórico de navegação para perfilização, publicidade ou analytics de marketing',
          'Cookies HTTP de rastreamento ou pixels de terceiros',
          'Dados de crianças ou adolescentes (uso restrito a maiores de 18 anos)',
        ],
      },
      {
        title: '2. Dados armazenados localmente (no seu dispositivo)',
        paragraphs: [
          'Apenas dois valores funcionais ficam no localStorage do seu navegador. A aplicação não usa cookies HTTP, não usa JWT, não usa MFA e não usa autenticação, porque não há cadastro de usuário.',
        ],
        items: [
          'Chave: megasena-theme — valor light, dark ou system (preferência de aparência)',
          'Chave: megasena-privacy-ack — versão do aviso de privacidade já visualizado (ex.: 2026-05-20)',
        ],
        note:
          'Esses dados nunca saem do seu dispositivo. Para apagar, limpe os dados do site nas configurações do navegador.',
      },
      {
        title: '3. Dados operacionais processados no servidor',
        paragraphs: [
          'Para operar a API com segurança, gravamos telemetria técnica mínima: pseudônimo HMAC-SHA256 do IP com salt rotativo (janela de 30 dias), user-agent truncado em 120 caracteres, rota, método HTTP, status, duração, identificador da requisição (UUID) e metadata estruturada sanitizada.',
          'Esses dados servem para rate limiting (100 req/min), auditoria de eventos sensíveis, diagnóstico técnico e continuidade do serviço.',
          'Base legal: Art. 7º, IX da LGPD — legítimo interesse do controlador.',
        ],
      },
      {
        title: '4. Retenção e eliminação',
        paragraphs: [
          'Logs estruturados: 30 dias. Auditoria: 400 dias. Backups do banco: 7 dias rolantes. A eliminação é automatizada por agendadores diários.',
        ],
      },
      {
        title: '5. Compartilhamento e operadores',
        paragraphs: [
          'Não vendemos, alugamos ou compartilhamos dados com terceiros para fins comerciais. Operamos com Cloudflare (CDN, mitigação de DDoS, terminação TLS) e um provedor de VPS para hospedagem, ambos sob cláusulas-padrão de proteção de dados.',
        ],
      },
      {
        title: '6. Transferência internacional (Art. 33 LGPD)',
        paragraphs: [
          'O tráfego é intermediado pela edge global da Cloudflare, o que pode envolver processamento fora do Brasil. A transferência ocorre apenas para entrega do serviço e está coberta por cláusulas-padrão de proteção de dados.',
        ],
      },
      {
        title: '7. Seus direitos (Art. 18 LGPD)',
        items: [
          'Confirmar a existência de tratamento dos seus dados',
          'Acessar os dados que tratamos',
          'Corrigir dados incompletos, inexatos ou desatualizados',
          'Solicitar anonimização, bloqueio ou eliminação',
          'Solicitar portabilidade em formato estruturado',
          'Saber com quais entidades houve compartilhamento',
          'Apresentar petição contra o controlador perante a ANPD',
        ],
        paragraphs: [
          'Para exercer qualquer direito, envie e-mail para privacidade@megasena-analyzer.com.br, descreva o que precisa e inclua a janela temporal relevante. Confirmamos recebimento em até 72 horas e respondemos em até 15 dias corridos.',
        ],
        link: {
          label: 'ANPD (Autoridade Nacional de Proteção de Dados)',
          href: 'https://www.gov.br/anpd/pt-br',
          prefix: 'Reclamações independentes podem ser apresentadas à',
        },
      },
      {
        title: '8. Segurança',
        items: [
          'TLS obrigatório em produção, com HSTS preload no edge',
          'HMAC-SHA256 com salt rotativo para pseudonimizar IP',
          'CSP nonce-based em produção; CSP deny-by-default em respostas JSON da API',
          'Sanitização recursiva de metadados antes da gravação',
          'Rate limit por identificador pseudonimizado (100 req/min)',
          'Validação Zod em rotas mutáveis; SQL parametrizado',
          'Cabeçalhos defensivos: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP',
          'Permissões 0640 no arquivo SQLite no servidor; secret scanning periódico no histórico Git',
        ],
      },
      {
        title: '9. Incidentes (Art. 48 LGPD)',
        paragraphs: [
          'Se identificarmos incidente de segurança que possa acarretar risco ou dano relevante aos titulares, comunicaremos a ANPD em prazo razoável e, quando aplicável, os titulares afetados.',
        ],
      },
      {
        title: '10. Crianças e adolescentes',
        paragraphs: [
          'O uso do Mega-Sena Analyzer é restrito a pessoas com 18 anos ou mais. Não direcionamos conteúdo para crianças nem coletamos intencionalmente dados de menores.',
        ],
      },
      {
        title: '11. Sobre a Plataforma',
        paragraphs: [
          'O Mega-Sena Analyzer é um projeto independente de análise estatística, desenvolvido para fins educacionais. Não possui vínculo, patrocínio ou endosso da Caixa Econômica Federal ou de qualquer operador de loterias.',
        ],
      },
    ],
    notice: 'Esta política pode ser atualizada. A data da última revisão fica no topo do documento.',
    faqs: [
      {
        question: 'O Mega-Sena Analyzer coleta meus dados pessoais?',
        answer:
          'Coletamos apenas telemetria técnica mínima: rota, método, status, duração, user-agent truncado, identificador da requisição e um pseudônimo HMAC do seu IP. Não coletamos cadastro, documentos, dados financeiros nem analytics de marketing.',
      },
      {
        question: 'O Mega-Sena Analyzer usa cookies?',
        answer:
          'Não usamos cookies HTTP. Usamos apenas duas chaves no localStorage do seu navegador: megasena-theme (preferência de tema) e megasena-privacy-ack (versão do aviso de privacidade já visualizado).',
      },
      {
        question: 'O Mega-Sena Analyzer tem login, JWT ou MFA?',
        answer:
          'Não. Não há cadastro nem autenticação. Sem login, sem token, sem MFA.',
      },
      {
        question: 'Onde ficam armazenadas minhas apostas geradas?',
        answer:
          'As apostas geradas não são persistidas no navegador nem no servidor por padrão.',
      },
      {
        question: 'O Mega-Sena Analyzer vende meus dados?',
        answer:
          'Não. Não vendemos, alugamos ou compartilhamos dados com terceiros para fins comerciais.',
      },
      {
        question: 'Posso apagar meus dados?',
        answer:
          'Sim. Para dados no servidor, envie e-mail para privacidade@megasena-analyzer.com.br. Para dados no navegador, limpe os dados do site nas configurações do navegador.',
      },
    ],
  },
  privacyRights: {
    title: 'Direitos do Titular (LGPD)',
    subtitle:
      'Como exercer seus direitos previstos no Art. 18 da Lei nº 13.709/2018 junto ao Mega-Sena Analyzer.',
    updatedAt: '20 de maio de 2026',
    introTitle: 'Canal único de privacidade',
    introBody:
      'Envie sua solicitação para privacidade@megasena-analyzer.com.br. Confirmamos o recebimento em até 72 horas e respondemos em até 15 dias corridos, conforme o Art. 19 da LGPD.',
    channelLabel: 'E-mail do Encarregado',
    channelValue: 'privacidade@megasena-analyzer.com.br',
    rightsTitle: 'Direitos disponíveis',
    rights: [
      {
        legalRef: 'Art. 18, I',
        title: 'Confirmação de tratamento',
        description: 'Saber se tratamos dados sobre você, com confirmação formal.',
      },
      {
        legalRef: 'Art. 18, II',
        title: 'Acesso aos dados',
        description: 'Receber cópia dos dados pseudonimizados correlacionáveis ao seu pedido.',
      },
      {
        legalRef: 'Art. 18, III',
        title: 'Correção',
        description: 'Corrigir dado incompleto, inexato ou desatualizado.',
      },
      {
        legalRef: 'Art. 18, IV',
        title: 'Anonimização, bloqueio ou eliminação',
        description: 'Pedir a eliminação de dados desnecessários, excessivos ou tratados em desconformidade.',
      },
      {
        legalRef: 'Art. 18, V',
        title: 'Portabilidade',
        description: 'Receber seus dados em formato estruturado e interoperável (JSON).',
      },
      {
        legalRef: 'Art. 18, VII',
        title: 'Informação de compartilhamento',
        description: 'Saber com quais entidades públicas e privadas houve compartilhamento.',
      },
      {
        legalRef: 'Art. 55-K',
        title: 'Petição à ANPD',
        description: 'Apresentar reclamação à Autoridade Nacional de Proteção de Dados quando entender necessário.',
      },
    ],
    howTitle: 'Como solicitar',
    howSteps: [
      'Escreva um e-mail para privacidade@megasena-analyzer.com.br.',
      'Identifique o direito que deseja exercer (acesso, eliminação, portabilidade, etc.).',
      'Inclua a janela temporal aproximada e, se possível, um X-Request-Id recebido nos cabeçalhos da resposta.',
      'Aguarde a confirmação de recebimento em até 72 horas.',
      'Receberemos a resposta final em até 15 dias corridos.',
    ],
    templateTitle: 'Modelo de solicitação',
    templateBody:
      'Assunto: Solicitação LGPD — [acesso | correção | eliminação | portabilidade | informação]\n\nOlá, em conformidade com o Art. 18 da LGPD, solicito o exercício do seguinte direito:\n[descreva o direito].\n\nDados para correlação:\n- Janela temporal aproximada: [DD/MM/AAAA a DD/MM/AAAA]\n- X-Request-Id (se houver): [valor]\n- Detalhes adicionais: [opcional]\n\nAtenciosamente,',
    copyTemplate: 'Copiar modelo',
    copiedTemplate: 'Modelo copiado',
    anpdTitle: 'Reclamação à ANPD',
    anpdBody:
      'Independentemente do nosso atendimento, você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).',
    anpdLinkLabel: 'Canais de atendimento da ANPD',
    anpdLinkHref: 'https://www.gov.br/anpd/pt-br/canais_atendimento',
    legalRefTitle: 'Referência legal',
    legalRefBody:
      'Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais. Art. 18 (direitos do titular) e Art. 19 (prazo de resposta).',
  },
  storageBanner: {
    title: 'Aviso de privacidade',
    body:
      'O Mega-Sena Analyzer não usa cookies HTTP nem autenticação. Apenas dois valores funcionais ficam no localStorage do seu navegador: megasena-theme (preferência de tema) e, ao confirmar este aviso, megasena-privacy-ack (versão deste aviso já visualizada, para não exibi-lo novamente).',
    accept: 'Entendi',
    learnMore: 'Política de Privacidade',
    learnMoreHref: '/privacy',
    rightsLink: 'Direitos LGPD',
    rightsLinkHref: '/privacy/direitos',
    ariaLabel: 'Aviso de privacidade e armazenamento local',
  },
  footer: {
    aboutTitle: 'Sobre o Projeto',
    aboutText:
      'Ferramenta de análise estatística da Mega-Sena para visualização de padrões e geração de sugestões de apostas baseadas em dados históricos.',
    legalTitle: 'Legal',
    termsLink: 'Termos de Serviço',
    privacyLink: 'Política de Privacidade',
    rightsLink: 'Direitos LGPD',
    resourcesTitle: 'Recursos',
    responsibleGamingTitle: 'Jogo Responsável',
    responsibleGamingText: 'Jogue com responsabilidade. A loteria é um jogo de sorte.',
    helpTitle: 'Precisa de ajuda?',
    helpContact: 'CVV: 188 (24h, gratuito)',
    helpLinkLabel: 'Jogadores Anônimos',
    disclaimerTitle: 'AVISO IMPORTANTE',
    disclaimerBody:
      'Esta ferramenta tem finalidade educacional e recreativa. As análises estatísticas são baseadas em resultados históricos e não garantem resultados futuros. A Mega-Sena é um jogo de sorte completamente aleatório. Todas as combinações têm a mesma probabilidade matemática de serem sorteadas. O uso desta ferramenta não aumenta suas chances de ganhar.',
    disclaimerSource:
      'Este projeto não é afiliado, patrocinado ou endossado pela Caixa Econômica Federal. Os dados de sorteios são obtidos de fontes públicas oficiais.',
    rightsReservedPrefix: 'Todos os direitos reservados.',
    developedWith: 'Desenvolvido com dados públicos da CAIXA',
    compliance: 'Privacidade e transparência',
  },
} as const;

const STRATEGY_LABELS: Record<string, string> = {
  balanced: 'Balanceada',
  hot_numbers: 'Quentes',
  cold_numbers: 'Frios',
  random: 'Aleatória',
  fibonacci: 'Fibonacci',
};

export function formatStrategyLabel(strategy: string): string {
  const isMultiple = strategy.startsWith('multiple_');
  // A bet marked `_fallback` could not be filled from the chosen strategic pool
  // and was completed from all 60 numbers. Hiding that marker presented a random
  // set as if it honoured the selected strategy, so it is now shown.
  const isFallback = strategy.endsWith('_fallback');
  const sanitized = strategy
    .replace(/^multiple_/, '')
    .replace(/_fallback$/, '')
    .trim();

  const base = STRATEGY_LABELS[sanitized] ?? sanitized.replace(/_/g, ' ');
  const label = isFallback ? `${base} ${pt.betGenerator.betCard.strategyFallbackSuffix}` : base;
  if (isMultiple) {
    return `${pt.betGenerator.betCard.typeMultiplePrefix} ${label}`;
  }
  return label;
}

export function formatBetTypeLabel(type: 'simple' | 'multiple', numberCount: number): string {
  if (type === 'simple') {
    return pt.betGenerator.betCard.typeSimple;
  }
  return `${pt.betGenerator.betCard.typeMultiplePrefix} (${numberCount} ${pt.betGenerator.betCard.numbersLabel})`;
}
