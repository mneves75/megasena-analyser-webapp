# Plano de Melhorias do Dashboard - Mega-Sena Analyser

**Data:** 30 de Setembro de 2025  
**Status:** Proposta  
**Autor:** Senior Engineer

---

## 1. ANÁLISE DO ESTADO ATUAL

### 1.1 Dashboard Existente
**Localização:** `app/dashboard/page.tsx`

**Métricas Atuais:**
- Total de sorteios
- Último sorteio
- Taxa de acumulação
- Prêmio médio Sena
- Top 10 números mais/menos sorteados
- Últimos 5 sorteios

**Pontos Fortes:**
- Interface limpa e responsiva
- Dados básicos bem apresentados
- Navegação clara entre seções

**Limitações Identificadas:**
- Ausência de visualização temporal (tendências)
- Falta de análises preditivas
- Métricas de probabilidade não expostas
- Sem análise de retorno sobre investimento (ROI)
- Ausência de comparação entre períodos
- Falta de insights acionáveis para apostadores

### 1.2 Página de Estatísticas
**Localização:** `app/dashboard/statistics/page.tsx`

**Funcionalidades:**
- Top 20 números quentes/frios
- Padrões básicos (consecutivos, todos pares)
- Grid completo 1-60

**Limitações:**
- Padrões muito básicos
- Sem análise de combinações vencedoras
- Ausência de métricas temporais
- Falta de segmentação por período

---

## 2. BENCHMARKING - MELHORES PRÁTICAS DE MERCADO

### 2.1 Referências Analisadas
- **LotoFacil Analytics (BR):** Análise de ciclos, atrasos e frequências por período
- **Lottery Post (US):** Gráficos temporais, análise de pares e trios
- **UK National Lottery Insights:** Heatmaps, correlações e previsões
- **PowerBall Tracker (US):** ROI tracking, success rates, combinação de estratégias
- **Analytics Dashboards (Mixpanel, Amplitude):** UX para dados complexos

### 2.2 Padrões de Excelência Identificados

#### A. Visualização de Dados
- **Gráficos temporais interativos** (line, area, bar charts)
- **Heatmaps** para identificar padrões visuais
- **Distribuição de frequências** por quartil/decil
- **Treemaps e sunburst charts** para hierarquia de dados
- **Spark lines** em cards para tendências rápidas

#### B. Métricas Avançadas
- **Atraso (Latency):** Número de sorteios desde última aparição
- **Ciclo médio:** Intervalo médio entre aparições
- **Momentum:** Taxa de mudança na frequência
- **Clusters e correlações:** Números que aparecem juntos
- **Análise de simetria:** Distribuição par/ímpar, alto/baixo, primos
- **ROI tracking:** Custo vs. ganhos em estratégias simuladas

#### C. UX e Interatividade
- **Filtros temporais:** Última semana, mês, trimestre, ano, tudo
- **Comparação de períodos:** YoY, MoM, custom ranges
- **Drill-down:** Click em número → histórico completo
- **Tooltips informativos** com contexto e insights
- **Exportação de dados:** CSV, PDF para análise offline
- **Personalização:** Salvar números favoritos, criar alertas

#### D. Insights Acionáveis
- **Recomendações baseadas em dados**
- **Alertas de tendências** (ex: número "devido" a sair)
- **Score de qualidade** para combinações
- **Simulador de estratégias** (backtesting)
- **Comparação de múltiplas apostas**

---

## 3. PROPOSTA DE MELHORIAS - ROADMAP ESTRUTURADO

### FASE 1: FUNDAÇÃO (Semana 1-2) - PRIORIDADE ALTA

#### 3.1 Nova Arquitetura de Analytics Engine
**Arquivos Afetados:**
- `lib/analytics/statistics.ts` (expandir)
- Criar: `lib/analytics/advanced-metrics.ts`
- Criar: `lib/analytics/temporal-analysis.ts`
- Criar: `lib/analytics/pattern-detection.ts`

**Novas Métricas a Implementar:**

```typescript
// lib/analytics/advanced-metrics.ts

export interface AdvancedNumberMetrics {
  number: number;
  frequency: number;
  latency: number;                    // Sorteios desde última aparição
  averageCycle: number;               // Média de sorteios entre aparições
  momentum: number;                   // Taxa de mudança (últimos 10 vs. histórico)
  expectedNextAppearance: number;     // Estimativa baseada em ciclo
  probabilityScore: number;           // Score 0-100
  standardDeviation: number;          // Consistência de aparições
}

export interface TemporalStats {
  period: string;                     // '7d', '30d', '90d', '1y', 'all'
  totalDraws: number;
  uniqueNumbers: Set<number>;
  mostFrequent: number[];
  averageLatency: number;
  trendDirection: 'up' | 'down' | 'stable';
}

export interface PatternAnalysis {
  consecutivePairs: Array<[number, number]>; // Ex: [5,6], [23,24]
  frequentTrios: Array<[number, number, number]>;
  parityDistribution: {
    allEven: number;
    allOdd: number;
    mixed: number;
  };
  rangeDistribution: {
    low: number;    // 1-20
    mid: number;    // 21-40
    high: number;   // 41-60
  };
  primeCount: number;
  fibonacciCount: number;
  sumDistribution: Record<number, number>; // Soma dos 6 números
}
```

**Queries SQL Necessárias:**
```sql
-- Latency (atraso)
WITH latest_draw AS (SELECT MAX(contest_number) as max_contest FROM draws)
SELECT 
  nf.number,
  (SELECT max_contest FROM latest_draw) - COALESCE(nf.last_drawn_contest, 0) as latency
FROM number_frequency nf;

-- Ciclo médio
WITH number_appearances AS (
  SELECT number, contest_number,
    LAG(contest_number) OVER (PARTITION BY number ORDER BY contest_number) as prev_contest
  FROM (
    SELECT number_1 as number, contest_number FROM draws UNION ALL
    SELECT number_2, contest_number FROM draws UNION ALL
    -- ... outros números
  )
)
SELECT number, AVG(contest_number - prev_contest) as avg_cycle
FROM number_appearances
WHERE prev_contest IS NOT NULL
GROUP BY number;

-- Pares frequentes
SELECT 
  LEAST(n1, n2) as num1,
  GREATEST(n1, n2) as num2,
  COUNT(*) as frequency
FROM (
  SELECT number_1 as n1, number_2 as n2 FROM draws UNION ALL
  SELECT number_1, number_3 FROM draws UNION ALL
  -- ... todas as combinações
) pairs
GROUP BY num1, num2
ORDER BY frequency DESC
LIMIT 20;
```

#### 3.2 Dashboard Principal - Widgets Novos

**Arquivo:** `app/dashboard/page.tsx`

**Novos Cards de Métricas (adicionar à grid existente):**
1. **Maior Atraso Atual** - Número há mais tempo sem sair
2. **Jackpot Acumulado** - Valor atual acumulado (se disponível via API)
3. **Melhor Período para Apostar** - Baseado em análise histórica
4. **Taxa de Sucesso Simulada** - ROI de estratégias populares

**Novo Componente: Timeline de Frequências**
- Gráfico de linha mostrando evolução de frequência dos Top 10 números
- Período selecionável: 30d, 90d, 1y, tudo
- **Biblioteca:** Recharts ou Chart.js
- **Componente:** `components/charts/frequency-timeline.tsx`

**Novo Componente: Heatmap de Números**
- Grid 10x6 (60 números) colorido por frequência
- Escala de cor: frio (azul) → quente (vermelho)
- Tooltip com dados detalhados ao hover
- **Componente:** `components/charts/number-heatmap.tsx`

**Novo Componente: Distribuição Par/Ímpar**
- Gráfico de pizza ou dona com % de sorteios por categoria
- Comparação com distribuição esperada (estatística)
- **Componente:** `components/charts/parity-distribution.tsx`

**Layout Proposto:**
```
┌─────────────────────────────────────────────────────┐
│  Header + Navigation (existente)                    │
├─────────────┬─────────────┬─────────────┬───────────┤
│ Total       │ Último      │ Taxa Acum.  │ Prêmio    │
│ Sorteios    │ Sorteio     │             │ Médio     │
├─────────────┼─────────────┼─────────────┼───────────┤
│ Maior       │ Jackpot     │ Melhor      │ Taxa de   │
│ Atraso      │ Atual       │ Período     │ Sucesso   │
├─────────────────────────────────────────────────────┤
│  Timeline de Frequências (interactive chart)        │
├───────────────────────┬─────────────────────────────┤
│  Heatmap de Números   │  Distribuição Par/Ímpar     │
│  (60 números grid)    │  (pie/donut chart)          │
├───────────────────────┴─────────────────────────────┤
│  Análise de Padrões (tabela expandida)              │
├──────────────────────────────────────────────────────┤
│  Últimos Sorteios (existente)                       │
└──────────────────────────────────────────────────────┘
```

---

### FASE 2: ANÁLISES AVANÇADAS (Semana 3-4) - PRIORIDADE ALTA

#### 3.3 Nova Página: Análise Temporal
**Criar:** `app/dashboard/temporal/page.tsx`

**Seções:**

1. **Evolução Histórica**
   - Gráfico de linha com múltiplas séries (selecionar até 6 números)
   - Comparação de frequências ao longo do tempo
   - Marcadores de eventos especiais (mega da virada, etc.)

2. **Análise de Ciclos**
   - Tabela com ciclo médio, mínimo, máximo por número
   - Identificação de números "atrasados" vs. ciclo esperado
   - Alertas visuais (cor vermelha = muito atrasado)

3. **Tendências e Momentum**
   - Números em alta (frequência crescente)
   - Números em queda (frequência decrescente)
   - Gráfico de barras com setas de tendência

4. **Comparação de Períodos**
   - Side-by-side: últimos 30d vs. 30d anteriores
   - Destaque para mudanças significativas (>20%)
   - Tabela de diferenças absolutas e percentuais

**Componentes Necessários:**
- `components/charts/multi-series-line.tsx`
- `components/charts/cycle-table.tsx`
- `components/charts/momentum-indicator.tsx`
- `components/charts/period-comparison.tsx`

---

#### 3.4 Nova Página: Análise de Padrões
**Criar:** `app/dashboard/patterns/page.tsx`

**Seções:**

1. **Pares e Trios Frequentes**
   - Top 20 pares mais sorteados juntos
   - Top 10 trios mais sorteados juntos
   - Heatmap de correlações entre números

2. **Distribuições Estatísticas**
   - **Paridade:** Gráfico de distribuição 6-0, 5-1, 4-2, 3-3 (pares-ímpares)
   - **Faixas:** Distribuição baixo (1-20), médio (21-40), alto (41-60)
   - **Soma Total:** Histograma da soma dos 6 números sorteados
   - **Primos:** Frequência de números primos nos sorteios

3. **Padrões Geométricos**
   - Sequências (números consecutivos)
   - Múltiplos (números múltiplos de X)
   - Números terminados em X
   - Diagonais e linhas no grid 10x6

4. **Análise de Raridade**
   - Combinações únicas (sorteadas apenas 1x)
   - Combinações repetidas (se houver)
   - Tempo médio para repetição de padrões

**Componentes Necessários:**
- `components/charts/pair-frequency-table.tsx`
- `components/charts/correlation-heatmap.tsx`
- `components/charts/distribution-charts.tsx`
- `components/charts/geometric-patterns.tsx`

---

### FASE 3: FERRAMENTAS PREDITIVAS (Semana 5-6) - PRIORIDADE MÉDIA

#### 3.5 Nova Página: Simulador de Estratégias
**Criar:** `app/dashboard/simulator/page.tsx`

**Funcionalidades:**

1. **Backtesting de Estratégias**
   - Simular apostas com estratégias pré-definidas:
     - **Hot Numbers:** Sempre apostar nos 10 mais frequentes
     - **Cold Numbers:** Apostar nos 10 menos frequentes
     - **Balanced:** Mix 50/50 hot e cold
     - **Overdue:** Apostar em números atrasados (latency alta)
     - **Random:** Controle (baseline)
     - **Custom:** Usuário escolhe critérios
   
   - Parâmetros:
     - Período de simulação (últimos X sorteios)
     - Orçamento por sorteio
     - Tipo de aposta (6, 7, 8... números)
   
   - Resultados:
     - Total investido
     - Total ganho (Sena, Quina, Quadra)
     - ROI %
     - Win rate (% de apostas premiadas)
     - Melhor/pior resultado
     - Gráfico de evolução do saldo

2. **Gerador de Combinações Inteligentes**
   - Baseado em múltiplos critérios:
     - Equilíbrio de frequências
     - Diversidade de faixas
     - Paridade balanceada
     - Evitar padrões óbvios
   
   - Score de qualidade para cada combinação gerada
   - Comparação lado a lado de até 5 combinações
   - Exportar combinações para PDF

3. **Análise de Combinação Própria**
   - Usuário insere 6 números
   - Sistema retorna:
     - Score de qualidade
     - Frequência histórica de cada número
     - Padrões presentes
     - Similaridade com sorteios passados
     - Probabilidade estimada (estatística)
     - Sugestões de melhoria

**Componentes Necessários:**
- `components/simulator/strategy-selector.tsx`
- `components/simulator/backtesting-results.tsx`
- `components/simulator/combination-generator.tsx`
- `components/simulator/combination-analyzer.tsx`
- `lib/analytics/backtesting-engine.ts`
- `lib/analytics/combination-scorer.ts`

---

#### 3.6 Nova Página: Meus Números Favoritos
**Criar:** `app/dashboard/favorites/page.tsx`

**Funcionalidades:**

1. **Gerenciamento de Favoritos**
   - Adicionar números favoritos (até 20)
   - Organizar em grupos/categorias
   - Anotações pessoais por número

2. **Dashboard Personalizado**
   - Estatísticas exclusivas dos números favoritos:
     - Frequência acumulada
     - Última aparição
     - Próxima aparição estimada
     - Tendência (subindo/descendo)
   
   - Gráfico de evolução temporal dos favoritos
   - Alertas quando favorito é sorteado

3. **Histórico de Apostas** (futuro)
   - Registrar apostas manuais
   - Acompanhar resultados
   - Calcular ROI pessoal
   - Estatísticas de acertos (Sena, Quina, Quadra)

**Persistência:**
- LocalStorage (MVP)
- Futuro: tabela `user_favorites` no SQLite
- Integração com `user_bets` (já existe no schema)

**Componentes Necessários:**
- `components/favorites/number-selector.tsx`
- `components/favorites/favorite-stats.tsx`
- `components/favorites/alerts-config.tsx`

---

### FASE 4: UX E INTERATIVIDADE (Semana 7-8) - PRIORIDADE MÉDIA

#### 3.7 Melhorias Globais de UX

**A. Filtros e Controles Globais**
- **Componente:** `components/filters/global-date-filter.tsx`
- Seletor de período visível em todas as páginas
- Presets: 7d, 30d, 90d, 1y, All time, Custom range
- Salvar preferência no localStorage
- Animação suave ao trocar período

**B. Tooltips Inteligentes**
- Informações contextuais em todos os números
- Ao hover: frequência, latency, último sorteio
- Ícones indicadores (🔥 hot, ❄️ cold, ⏰ overdue)
- **Biblioteca:** Radix UI Tooltip ou Shadcn Tooltip

**C. Modo de Comparação**
- Selecionar múltiplos números (até 10)
- Visualização comparativa em modal ou sidebar
- Gráficos de comparação lado a lado
- Exportar comparação como imagem

**D. Busca Rápida**
- Input de busca global (Cmd+K / Ctrl+K)
- Buscar por:
  - Número específico
  - Concurso
  - Data
  - Padrão
- Resultados instantâneos com preview

**E. Exportação de Dados**
- Botão de exportar em cada seção
- Formatos: CSV, JSON, PDF (relatório formatado)
- Customizar campos incluídos
- **Biblioteca:** jsPDF para PDFs, Papa Parse para CSV

**F. Notificações e Alertas**
- Sistema de notificações toast
- Alertas personalizáveis:
  - Número favorito sorteado
  - Número com atraso recorde
  - Nova tendência detectada
  - Resultado de simulação completado
- **Biblioteca:** Sonner ou Radix Toast

---

### FASE 5: OTIMIZAÇÕES E POLISH (Semana 9-10) - PRIORIDADE BAIXA

#### 3.8 Performance e Cache

**A. Cache de Queries Complexas**
- Implementar cache em memória (Map ou WeakMap)
- TTL configurável (ex: 5 minutos para stats gerais)
- Invalidação ao adicionar novos sorteios
- **Localização:** `lib/analytics/cache.ts`

```typescript
// lib/analytics/cache.ts
export class AnalyticsCache {
  private cache: Map<string, { data: any; timestamp: number }>;
  private ttl: number;

  constructor(ttlMinutes: number = 5) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

**B. Lazy Loading de Charts**
- Componentes de gráficos com lazy loading
- Skeleton loaders durante carregamento
- Intersection Observer para gráficos abaixo da fold

**C. Otimização de Queries SQL**
- Adicionar índices compostos para queries frequentes
- Views materializadas para agregações pesadas
- EXPLAIN QUERY PLAN para identificar gargalos

```sql
-- db/migrations/002_performance_indexes.sql

-- Índices para queries de frequência por período
CREATE INDEX idx_draws_date_range ON draws(draw_date, contest_number);

-- Índice composto para análise de números
CREATE INDEX idx_draws_numbers ON draws(
  number_1, number_2, number_3, number_4, number_5, number_6
);

-- View materializada para métricas comuns
CREATE VIEW v_number_metrics AS
SELECT 
  nf.number,
  nf.frequency,
  nf.last_drawn_contest,
  (SELECT MAX(contest_number) FROM draws) - COALESCE(nf.last_drawn_contest, 0) as latency,
  -- ... outros campos calculados
FROM number_frequency nf;
```

**D. Code Splitting**
- Split por rota (já feito pelo Next.js App Router)
- Dynamic imports para bibliotecas pesadas (Chart.js, etc.)
- Prefetch de rotas críticas

---

#### 3.9 Acessibilidade (a11y)

**Checklist de Implementação:**
- [ ] Todos os gráficos com alt text descritivo
- [ ] Navegação por teclado completa (Tab, Enter, Esc)
- [ ] Focus indicators visíveis
- [ ] Contraste WCAG AA (mínimo 4.5:1)
- [ ] Screen reader labels em todos os interactive elements
- [ ] Skip links para conteúdo principal
- [ ] Tabelas com headers apropriados
- [ ] Formulários com labels e error messages
- [ ] Cores não como única forma de comunicação (usar ícones também)

**Ferramentas de Teste:**
- axe DevTools
- Lighthouse CI
- NVDA/VoiceOver manual testing

---

#### 3.10 Design System Enhancements

**A. Novos Componentes no Design System**

```typescript
// components/ui/stat-card.tsx
interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
    direction: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral';
  sparkline?: number[]; // Dados para mini gráfico
}

// components/ui/info-tooltip.tsx
interface InfoTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

// components/ui/number-badge.tsx
interface NumberBadgeProps {
  number: number;
  variant?: 'hot' | 'cold' | 'overdue' | 'default';
  size?: 'sm' | 'md' | 'lg';
  showFrequency?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

// components/ui/loading-skeleton.tsx
interface LoadingSkeletonProps {
  type: 'card' | 'chart' | 'table' | 'text';
  count?: number;
}
```

**B. Tokens de Design Específicos**

```typescript
// lib/constants.ts - adicionar

export const CHART_CONFIG = {
  colors: {
    hot: 'hsl(var(--chart-hot))',
    cold: 'hsl(var(--chart-cold))',
    neutral: 'hsl(var(--chart-neutral))',
    overdue: 'hsl(var(--chart-overdue))',
  },
  thresholds: {
    hot: 0.7,        // Top 30% de frequência
    cold: 0.3,       // Bottom 30%
    overdue: 1.5,    // 1.5x o ciclo médio
  },
  animations: {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const STATS_CATEGORIES = {
  frequency: {
    label: 'Frequência',
    description: 'Quantas vezes o número foi sorteado',
    color: 'blue',
  },
  latency: {
    label: 'Atraso',
    description: 'Sorteios desde a última aparição',
    color: 'orange',
  },
  cycle: {
    label: 'Ciclo',
    description: 'Intervalo médio entre aparições',
    color: 'green',
  },
  momentum: {
    label: 'Momentum',
    description: 'Tendência de crescimento/queda',
    color: 'purple',
  },
} as const;
```

---

## 4. ESTRUTURA TÉCNICA DE IMPLEMENTAÇÃO

### 4.1 Novos Arquivos a Criar

```
lib/analytics/
  ├── advanced-metrics.ts          [Fase 1]
  ├── temporal-analysis.ts         [Fase 2]
  ├── pattern-detection.ts         [Fase 2]
  ├── backtesting-engine.ts        [Fase 3]
  ├── combination-scorer.ts        [Fase 3]
  ├── cache.ts                     [Fase 5]
  └── types.ts                     [Fase 1] - tipos compartilhados

components/charts/
  ├── frequency-timeline.tsx       [Fase 1]
  ├── number-heatmap.tsx           [Fase 1]
  ├── parity-distribution.tsx      [Fase 1]
  ├── multi-series-line.tsx        [Fase 2]
  ├── cycle-table.tsx              [Fase 2]
  ├── momentum-indicator.tsx       [Fase 2]
  ├── period-comparison.tsx        [Fase 2]
  ├── pair-frequency-table.tsx     [Fase 2]
  ├── correlation-heatmap.tsx      [Fase 2]
  ├── distribution-charts.tsx      [Fase 2]
  └── geometric-patterns.tsx       [Fase 2]

components/simulator/
  ├── strategy-selector.tsx        [Fase 3]
  ├── backtesting-results.tsx      [Fase 3]
  ├── combination-generator.tsx    [Fase 3]
  └── combination-analyzer.tsx     [Fase 3]

components/favorites/
  ├── number-selector.tsx          [Fase 3]
  ├── favorite-stats.tsx           [Fase 3]
  └── alerts-config.tsx            [Fase 3]

components/filters/
  ├── global-date-filter.tsx       [Fase 4]
  └── number-search.tsx            [Fase 4]

components/ui/ (novos)
  ├── stat-card.tsx                [Fase 5]
  ├── info-tooltip.tsx             [Fase 4]
  ├── number-badge.tsx             [Fase 1]
  └── loading-skeleton.tsx         [Fase 4]

app/dashboard/
  ├── temporal/page.tsx            [Fase 2]
  ├── patterns/page.tsx            [Fase 2]
  ├── simulator/page.tsx           [Fase 3]
  └── favorites/page.tsx           [Fase 3]

db/migrations/
  ├── 002_performance_indexes.sql  [Fase 5]
  └── 003_user_favorites.sql       [Fase 3]

tests/lib/
  ├── advanced-metrics.test.ts     [Fase 1]
  ├── temporal-analysis.test.ts    [Fase 2]
  ├── pattern-detection.test.ts    [Fase 2]
  └── backtesting-engine.test.ts   [Fase 3]
```

### 4.2 Dependências Adicionais

**Bibliotecas de Gráficos:**
```json
{
  "recharts": "^2.15.0",              // Gráficos React responsivos
  "d3": "^7.9.0",                     // Manipulação de dados complexos
  "@nivo/core": "^0.87.0",            // Gráficos avançados (heatmap, sunburst)
  "@nivo/heatmap": "^0.87.0",
  "@nivo/pie": "^0.87.0"
}
```

**Utilitários:**
```json
{
  "date-fns": "^3.6.0",               // Manipulação de datas
  "lodash-es": "^4.17.21",            // Utilidades (groupBy, sortBy, etc.)
  "jspdf": "^2.5.2",                  // Exportação PDF
  "jspdf-autotable": "^3.8.3",        // Tabelas em PDF
  "papaparse": "^5.4.1",              // Parsing/export CSV
  "html-to-image": "^1.11.11"         // Export de gráficos como imagem
}
```

**Comando de Instalação:**
```bash
bun add recharts d3 @nivo/core @nivo/heatmap @nivo/pie date-fns lodash-es jspdf jspdf-autotable papaparse html-to-image
bun add -d @types/d3 @types/lodash-es @types/papaparse
```

### 4.3 Migração de Dados

**Migration: 002_performance_indexes.sql**
```sql
-- Índices para otimização de queries

CREATE INDEX IF NOT EXISTS idx_draws_date_range 
  ON draws(draw_date, contest_number);

CREATE INDEX IF NOT EXISTS idx_draws_numbers_full 
  ON draws(number_1, number_2, number_3, number_4, number_5, number_6);

CREATE INDEX IF NOT EXISTS idx_number_frequency_latency 
  ON number_frequency(frequency DESC, last_drawn_contest DESC);

-- View para métricas calculadas
CREATE VIEW IF NOT EXISTS v_number_advanced_metrics AS
SELECT 
  nf.number,
  nf.frequency,
  nf.last_drawn_contest,
  nf.last_drawn_date,
  (SELECT MAX(contest_number) FROM draws) - COALESCE(nf.last_drawn_contest, 0) as latency,
  CAST(nf.frequency AS REAL) / (SELECT COUNT(*) FROM draws) as frequency_rate,
  CASE 
    WHEN nf.frequency > (SELECT AVG(frequency) FROM number_frequency) * 1.2 THEN 'hot'
    WHEN nf.frequency < (SELECT AVG(frequency) FROM number_frequency) * 0.8 THEN 'cold'
    ELSE 'neutral'
  END as temperature
FROM number_frequency nf
ORDER BY nf.frequency DESC;
```

**Migration: 003_user_favorites.sql**
```sql
-- Tabela de números favoritos do usuário
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 60),
  group_name TEXT DEFAULT 'default',
  notes TEXT,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  alert_enabled BOOLEAN DEFAULT 0,
  UNIQUE(number)
);

CREATE INDEX idx_user_favorites_group ON user_favorites(group_name);
CREATE INDEX idx_user_favorites_alert ON user_favorites(alert_enabled);

-- Tabela de alertas configurados
CREATE TABLE IF NOT EXISTS user_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL, -- 'favorite_drawn', 'overdue_record', 'trend_change'
  config TEXT, -- JSON com configuração específica
  enabled BOOLEAN DEFAULT 1,
  last_triggered TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. PRIORIZAÇÃO E CRONOGRAMA

### 5.1 Matriz de Prioridade (Impacto x Esforço)

```
      Alto Impacto
           ↑
    ┌──────┼──────┐
    │  B   │  A   │
    │      │      │
Baixo──────┼──────Alto Esforço
    │  C   │  D   │
    │      │      │
    └──────┼──────┘
           ↓
     Baixo Impacto
```

**Quadrante A (Alto Impacto, Alto Esforço):**
- Simulador de Estratégias (Fase 3)
- Análise Temporal completa (Fase 2)
- Sistema de Cache avançado (Fase 5)

**Quadrante B (Alto Impacto, Baixo Esforço):**
- Advanced Metrics básicas (Fase 1) ✅ COMEÇAR AQUI
- Heatmap de números (Fase 1) ✅
- Gráfico de timeline (Fase 1) ✅
- Filtros temporais (Fase 4)
- Tooltips inteligentes (Fase 4)

**Quadrante C (Baixo Impacto, Baixo Esforço):**
- Números favoritos (Fase 3)
- Exportação CSV (Fase 4)
- Melhorias a11y (Fase 5)

**Quadrante D (Baixo Impacto, Alto Esforço):**
- Sistema de notificações push
- Integração com APIs externas de pagamento
- Versão mobile nativa

### 5.2 Cronograma Recomendado

**Sprint 1 (Semana 1-2): Fundação - Quick Wins**
- [ ] Criar `lib/analytics/advanced-metrics.ts` com latency, cycle, momentum
- [ ] Implementar queries SQL para métricas avançadas
- [ ] Adicionar 4 novos cards no dashboard principal
- [ ] Criar componente `NumberBadge` com variants (hot/cold/overdue)
- [ ] Criar componente `NumberHeatmap` básico
- [ ] Atualizar `app/dashboard/page.tsx` com novo layout
- [ ] Testes unitários para advanced-metrics
- [ ] **Entrega:** Dashboard principal melhorado com métricas avançadas

**Sprint 2 (Semana 3-4): Visualizações Temporais**
- [ ] Criar `lib/analytics/temporal-analysis.ts`
- [ ] Implementar `FrequencyTimeline` com Recharts
- [ ] Criar página `app/dashboard/temporal/page.tsx`
- [ ] Implementar filtros de período (7d, 30d, 90d, 1y, all)
- [ ] Adicionar comparação de períodos (YoY, MoM)
- [ ] Criar componente `CycleTable` com sorting
- [ ] Testes para temporal-analysis
- [ ] **Entrega:** Página de análise temporal funcional

**Sprint 3 (Semana 5-6): Padrões e Correlações**
- [ ] Criar `lib/analytics/pattern-detection.ts`
- [ ] Implementar detecção de pares e trios frequentes
- [ ] Criar página `app/dashboard/patterns/page.tsx`
- [ ] Implementar `CorrelationHeatmap` com D3 ou Nivo
- [ ] Adicionar análises de distribuição (paridade, faixas, soma)
- [ ] Criar componente `DistributionCharts`
- [ ] Testes para pattern-detection
- [ ] **Entrega:** Página de análise de padrões completa

**Sprint 4 (Semana 7-8): Simulador e Backtesting**
- [ ] Criar `lib/analytics/backtesting-engine.ts`
- [ ] Criar `lib/analytics/combination-scorer.ts`
- [ ] Implementar estratégias pré-definidas (hot, cold, balanced, overdue)
- [ ] Criar página `app/dashboard/simulator/page.tsx`
- [ ] Implementar interface de configuração de simulação
- [ ] Criar componente `BacktestingResults` com gráficos
- [ ] Implementar gerador de combinações inteligentes
- [ ] Implementar analisador de combinação própria
- [ ] Testes para backtesting-engine
- [ ] **Entrega:** Simulador funcional com backtesting

**Sprint 5 (Semana 9-10): UX e Polish**
- [ ] Implementar sistema de cache (`lib/analytics/cache.ts`)
- [ ] Adicionar lazy loading em todos os gráficos
- [ ] Criar componente `GlobalDateFilter` persistente
- [ ] Implementar busca rápida (Cmd+K)
- [ ] Adicionar tooltips informativos em todos os números
- [ ] Implementar exportação (CSV, PDF)
- [ ] Otimizar queries SQL e adicionar índices
- [ ] Passar por checklist de acessibilidade
- [ ] Code review e refactoring
- [ ] **Entrega:** Sistema polido e otimizado

---

## 6. TESTES E QUALIDADE

### 6.1 Cobertura de Testes

**Metas:**
- Cobertura geral: **≥ 80%** (alinhado com projeto)
- Cobertura de analytics engines: **≥ 90%**
- Cobertura de componentes UI: **≥ 70%**

**Casos de Teste Críticos:**

```typescript
// tests/lib/advanced-metrics.test.ts
describe('AdvancedMetrics', () => {
  it('should calculate latency correctly', () => { /* ... */ });
  it('should handle numbers never drawn', () => { /* ... */ });
  it('should compute average cycle accurately', () => { /* ... */ });
  it('should detect momentum (up/down/stable)', () => { /* ... */ });
  it('should score probability within 0-100 range', () => { /* ... */ });
});

// tests/lib/backtesting-engine.test.ts
describe('BacktestingEngine', () => {
  it('should simulate hot numbers strategy', () => { /* ... */ });
  it('should calculate ROI correctly', () => { /* ... */ });
  it('should handle edge case: no winners', () => { /* ... */ });
  it('should respect budget constraints', () => { /* ... */ });
  it('should match historical results', () => { /* ... */ });
});

// tests/lib/pattern-detection.test.ts
describe('PatternDetection', () => {
  it('should find frequent pairs', () => { /* ... */ });
  it('should detect consecutive sequences', () => { /* ... */ });
  it('should calculate parity distribution', () => { /* ... */ });
  it('should identify geometric patterns', () => { /* ... */ });
});
```

### 6.2 Testes E2E (Playwright)

```typescript
// tests/app/dashboard/temporal.spec.ts
test('should filter data by period', async ({ page }) => {
  await page.goto('/dashboard/temporal');
  await page.click('[data-testid="period-filter"]');
  await page.click('[data-testid="period-30d"]');
  
  await expect(page.locator('[data-testid="chart-title"]'))
    .toContainText('Últimos 30 dias');
});

test('should compare two periods', async ({ page }) => {
  await page.goto('/dashboard/temporal');
  await page.click('[data-testid="compare-toggle"]');
  
  await expect(page.locator('[data-testid="comparison-chart"]'))
    .toBeVisible();
});
```

---

## 7. DOCUMENTAÇÃO E TREINAMENTO

### 7.1 Documentação Técnica a Criar

**Arquivos:**
- `docs/ANALYTICS_API.md` - API de todas as funções de analytics
- `docs/CHARTS_GUIDE.md` - Guia de uso dos componentes de gráficos
- `docs/DATA_MODEL.md` - Modelo de dados e relacionamentos
- `docs/PERFORMANCE.md` - Guia de otimização e cache

### 7.2 Documentação de Usuário

**Seções para README ou docs/:**
- Como interpretar cada métrica (latency, cycle, momentum)
- Guia de uso do simulador
- Melhores práticas para análise de padrões
- FAQ sobre estatísticas e probabilidades
- Glossário de termos técnicos

---

## 8. RISCOS E MITIGAÇÕES

### 8.1 Riscos Identificados

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Performance degradada com muito volume de dados | Alto | Média | Implementar cache agressivo, lazy loading, paginação |
| Complexidade excessiva na UX | Médio | Alta | User testing, progressive disclosure, tooltips contextuais |
| Queries SQL lentas | Alto | Média | Índices otimizados, views materializadas, EXPLAIN QUERY |
| Bibliotecas de gráficos incompatíveis | Médio | Baixa | Avaliar alternativas, ter fallbacks simples |
| Over-engineering | Médio | Média | Seguir YAGNI, implementar por prioridade, revisões regulares |
| Inconsistência de dados históricos | Alto | Baixa | Validações no ingestion, testes de integridade, backups |

### 8.2 Plano de Rollback

**Para cada fase:**
1. Manter branch de produção estável
2. Features flags para funcionalidades novas
3. Deploy incremental (por página/feature)
4. Monitoramento de erros (Sentry ou similar)
5. Rollback automático se erro rate > 5%

---

## 9. MÉTRICAS DE SUCESSO

### 9.1 KPIs Técnicos

- [ ] **Performance:** Lighthouse score ≥ 90
- [ ] **Cobertura de testes:** ≥ 80%
- [ ] **Bundle size:** < 500KB (gzipped)
- [ ] **Time to Interactive:** < 3s
- [ ] **Linter warnings:** 0
- [ ] **TypeScript errors:** 0

### 9.2 KPIs de Produto

- [ ] **Engajamento:** Tempo médio na plataforma aumenta em 50%
- [ ] **Adoção de features:** 70% dos usuários usam análise temporal
- [ ] **Retenção:** Taxa de retorno semanal > 40%
- [ ] **Satisfação:** NPS ≥ 50 (se medido)
- [ ] **Conversão:** % de usuários que geram apostas aumenta em 30%

### 9.3 Critérios de Aceitação Final

- [ ] Todas as páginas renderizam sem erros
- [ ] Todos os gráficos exibem dados corretos
- [ ] Filtros temporais funcionam em todas as páginas
- [ ] Exportação (CSV/PDF) funciona sem falhas
- [ ] Simulador retorna resultados em < 2s para 100 sorteios
- [ ] Responsivo de mobile (320px) até 4K (3840px)
- [ ] Acessível via teclado e screen reader
- [ ] Sem regressões em funcionalidades existentes
- [ ] Documentação completa e atualizada

---

## 10. CONSIDERAÇÕES FINAIS

### 10.1 Próximos Passos Imediatos

1. **Aprovação do Plano:** Revisar com stakeholders/time
2. **Setup de Ambiente:** Instalar dependências novas
3. **Kick-off Sprint 1:** Começar por advanced-metrics.ts
4. **Design Review:** Validar protótipos de novos componentes
5. **Setup de Testes:** Configurar Vitest para novos módulos

### 10.2 Expansões Futuras (Fora do Escopo)

- **Machine Learning:** Modelos preditivos com TensorFlow.js
- **Integração com APIs de Pagamento:** Comprar apostas direto na plataforma
- **Compartilhamento Social:** Compartilhar combinações/análises
- **Modo Colaborativo:** Grupos de apostadores, splits de prêmios
- **App Mobile Nativo:** React Native ou Swift/Kotlin
- **Notificações Push:** Alertas em tempo real de sorteios
- **Dashboard de Admin:** Gerenciar usuários, analytics de uso
- **Sistema de Recomendação:** IA para sugerir apostas personalizadas

### 10.3 Manutenção e Evolução

**Frequência de Atualizações:**
- **Dados:** Automático após cada sorteio (via `scripts/pull-draws.ts`)
- **Features:** Releases quinzenais (seguindo sprints)
- **Bugfixes:** Hotfix em < 24h para críticos
- **Dependências:** Atualização mensal (security patches semanalmente)

**Monitoramento Contínuo:**
- Erros de runtime (Sentry ou similar)
- Performance metrics (Web Vitals)
- Analytics de uso (Plausible, Umami ou GA4)
- Database size e query performance

---

## APÊNDICE A: REFERÊNCIAS

### Artigos e Documentação
- [Best Practices for Dashboard Design](https://datavizcatalogue.com/)
- [Recharts Documentation](https://recharts.org/)
- [D3.js Gallery](https://observablehq.com/@d3/gallery)
- [Nivo Components](https://nivo.rocks/)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)

### Ferramentas Recomendadas
- **Design:** Figma (protótipos), Excalidraw (diagramas)
- **Performance:** Lighthouse CI, WebPageTest
- **Testes:** Vitest, Playwright, Testing Library
- **Code Quality:** ESLint, Prettier, TypeScript strict mode
- **Monitoramento:** Sentry, Plausible Analytics

---

## APÊNDICE B: EXEMPLOS DE CÓDIGO

### Exemplo: Advanced Metrics Function

```typescript
// lib/analytics/advanced-metrics.ts
import { getDatabase } from '@/lib/db';
import type { AdvancedNumberMetrics } from './types';

export function getAdvancedNumberMetrics(): AdvancedNumberMetrics[] {
  const db = getDatabase();
  
  const latestContest = (
    db.prepare('SELECT MAX(contest_number) as max FROM draws').get() as { max: number }
  ).max;
  
  const avgFrequency = (
    db.prepare('SELECT AVG(frequency) as avg FROM number_frequency').get() as { avg: number }
  ).avg;
  
  const results = db.prepare(`
    SELECT 
      nf.number,
      nf.frequency,
      ? - COALESCE(nf.last_drawn_contest, 0) as latency,
      nf.last_drawn_contest,
      nf.last_drawn_date
    FROM number_frequency nf
    ORDER BY nf.number ASC
  `).all(latestContest) as Array<{
    number: number;
    frequency: number;
    latency: number;
    last_drawn_contest: number | null;
    last_drawn_date: string | null;
  }>;
  
  return results.map((row) => {
    const frequencyRate = row.frequency / (latestContest || 1);
    const expectedCycle = 1 / (frequencyRate || 0.01); // Ciclo esperado em sorteios
    const momentum = calculateMomentum(row.number); // Implementar função auxiliar
    
    return {
      number: row.number,
      frequency: row.frequency,
      latency: row.latency,
      averageCycle: expectedCycle,
      momentum,
      expectedNextAppearance: row.last_drawn_contest 
        ? row.last_drawn_contest + expectedCycle 
        : latestContest + expectedCycle,
      probabilityScore: calculateProbabilityScore(row.frequency, avgFrequency, row.latency),
      standardDeviation: calculateStdDev(row.number), // Implementar
    };
  });
}

function calculateProbabilityScore(
  frequency: number, 
  avgFrequency: number, 
  latency: number
): number {
  // Score de 0-100 baseado em múltiplos fatores
  const freqScore = (frequency / avgFrequency) * 40; // Peso 40%
  const latencyScore = (latency > 0 ? (1 / latency) : 1) * 100 * 30; // Peso 30%
  const randomFactor = 30; // Peso 30% (sorteio é aleatório)
  
  return Math.min(100, Math.max(0, freqScore + latencyScore + randomFactor));
}
```

### Exemplo: Heatmap Component

```typescript
// components/charts/number-heatmap.tsx
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface NumberHeatmapProps {
  data: Array<{ number: number; frequency: number }>;
  title?: string;
  description?: string;
}

export function NumberHeatmap({ data, title, description }: NumberHeatmapProps) {
  const { minFreq, maxFreq, grid } = useMemo(() => {
    const frequencies = data.map((d) => d.frequency);
    const min = Math.min(...frequencies);
    const max = Math.max(...frequencies);
    
    // Organizar em grid 10x6 (60 números)
    const gridData = [];
    for (let row = 0; row < 6; row++) {
      const rowData = [];
      for (let col = 0; col < 10; col++) {
        const num = row * 10 + col + 1;
        const item = data.find((d) => d.number === num);
        rowData.push(item || { number: num, frequency: 0 });
      }
      gridData.push(rowData);
    }
    
    return { minFreq: min, maxFreq: max, grid: gridData };
  }, [data]);
  
  const getColorIntensity = (frequency: number): string => {
    if (maxFreq === minFreq) return 'bg-primary/50';
    
    const normalized = (frequency - minFreq) / (maxFreq - minFreq);
    
    if (normalized < 0.2) return 'bg-blue-200 dark:bg-blue-950';
    if (normalized < 0.4) return 'bg-blue-300 dark:bg-blue-900';
    if (normalized < 0.6) return 'bg-orange-300 dark:bg-orange-900';
    if (normalized < 0.8) return 'bg-orange-400 dark:bg-orange-800';
    return 'bg-red-500 dark:bg-red-700';
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || 'Mapa de Calor de Números'}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {row.map((item) => (
                <div
                  key={item.number}
                  className={cn(
                    'flex-1 aspect-square flex items-center justify-center',
                    'rounded-lg font-semibold text-sm transition-smooth',
                    'hover:scale-110 hover:shadow-lg cursor-pointer',
                    getColorIntensity(item.frequency)
                  )}
                  title={`${item.number}: ${item.frequency}x`}
                >
                  {item.number}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Menos frequente</span>
          <div className="flex gap-1">
            {[
              'bg-blue-200',
              'bg-blue-300',
              'bg-orange-300',
              'bg-orange-400',
              'bg-red-500',
            ].map((color, i) => (
              <div key={i} className={cn('w-8 h-4 rounded', color)} />
            ))}
          </div>
          <span>Mais frequente</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

**FIM DO PLANO**

---

**Próxima Ação:** Aprovação e início da Sprint 1 (Advanced Metrics + Dashboard Enhancements)

**Contato para Dúvidas:** [Incluir canal de comunicação do time]

**Última Atualização:** 30/09/2025

