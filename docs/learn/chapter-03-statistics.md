# Capítulo 3: Análise Estatística de Dados Históricos

## Introdução

Estabelecemos que não podemos prever números de loteria. Então o que PODEMOS fazer?

**Podemos analisar o que JÁ ACONTECEU.**

Este capítulo explora os métodos estatísticos usados neste aplicativo para extrair insights de milhares de sorteios históricos. Você aprenderá sobre análise de frequência, detecção de padrões e a diferença entre correlação e causalidade.

---

## A Filosofia: Descrição, Não Previsão

**Estatística descritiva** resume o que os dados mostram.
**Estatística inferencial** tira conclusões sobre o que os dados significam.

Este app usa **estatística descritiva** exclusivamente.

**Exemplo:**
- Descritiva: "O número 10 apareceu 287 vezes em 3000 sorteios"
- Inferencial (INVÁLIDA): "O número 10 está 'quente' e mais propenso a sair no próximo sorteio"

A segunda afirmação é inválida porque sorteios de loteria são **eventos independentes** (Capítulo 1).

---

## Análise de Frequência: Números Quentes e Frios

Abra `lib/analytics/statistics.ts:49-61`:

```typescript
getNumberFrequencies(): NumberFrequency[] {
  return this.db
    .prepare(
      `SELECT
        number,
        frequency,
        last_drawn_contest as lastDrawnContest,
        last_drawn_date as lastDrawnDate
       FROM number_frequency
       ORDER BY frequency DESC`
    )
    .all() as NumberFrequency[];
}
```

**O que isso faz:**
1. Consulta a view materializada `number_frequency`
2. Retorna todos os 60 números com suas contagens de ocorrências
3. Ordenado por frequência (maior primeiro)

### O Padrão de View Materializada

Em vez de calcular frequências em cada consulta, mantemos uma tabela pré-computada:

```sql
-- Schema (veja db/schema.ts)
CREATE TABLE number_frequency (
  number INTEGER PRIMARY KEY,
  frequency INTEGER DEFAULT 0,
  last_drawn_contest INTEGER,
  last_drawn_date TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Por que?** Performance. Calcular C(60,6) frequências através de 3000+ sorteios é caro. Atualizamos incrementalmente.

**Mecanismo de atualização:** `lib/analytics/statistics.ts:63-129`

---

## Entendendo o Processo de Atualização

Vamos traçar como as frequências são calculadas. Abra `lib/analytics/statistics.ts:63-129`:

```typescript
updateNumberFrequencies(): void {
  try {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      // Reseta todas as frequências para 0
      const resetStatement = this.db.prepare('UPDATE number_frequency SET frequency = 0');

      // Queries pré-geradas para cada coluna (number_1 até number_6)
      const countStatements = NUMBER_COLUMN_COUNT_QUERIES; // Linhas 5-8
      const lastDrawStatements = NUMBER_COLUMN_LAST_DRAWN_QUERIES; // Linhas 10-14

      // Statement de update para resultado final
      const updateStatement = this.db.prepare(/* ... */);

      // Reseta frequências
      resetStatement.run();

      // Conta ocorrências para cada número 1-60
      for (let num = 1; num <= 60; num++) {
        let frequency = 0;
        let lastContest: number | null = null;
        let lastDate: string | null = null;

        // Soma através de todas as 6 colunas de número
        for (let col = 0; col < 6; col++) {
          const countResult = countStatements[col].get(num);
          frequency += countResult?.count ?? 0;

          // Rastreia a aparição mais recente
          const lastDrawn = lastDrawStatements[col].get(num);
          if (lastDrawn && (lastContest === null || lastDrawn.contest_number > lastContest)) {
            lastContest = lastDrawn.contest_number;
            lastDate = lastDrawn.draw_date;
          }
        }

        // Atualiza a tabela number_frequency
        updateStatement.run(frequency, lastContest, lastDate, num);
      }

      this.db.exec('COMMIT');
    } catch (innerError) {
      this.db.exec('ROLLBACK');
      throw innerError;
    }
  } catch (error) {
    throw new Error(`Failed to update number frequencies: ${error}`);
  }
}
```

**Conceitos chave:**
1. **Transação:** Execução tudo-ou-nada (Capítulo 5 cobre isso em profundidade)
2. **Prepared statements:** Prevenção de SQL injection (linhas 5-14)
3. **Contagem por coluna:** Mega-Sena armazena sorteios como 6 colunas separadas

---

## Entendendo o Schema do Banco de Dados

Sorteios são armazenados assim:

```sql
CREATE TABLE draws (
  contest_number INTEGER PRIMARY KEY,
  draw_date TEXT NOT NULL,
  number_1 INTEGER NOT NULL,
  number_2 INTEGER NOT NULL,
  number_3 INTEGER NOT NULL,
  number_4 INTEGER NOT NULL,
  number_5 INTEGER NOT NULL,
  number_6 INTEGER NOT NULL,
  -- ... outros campos
);
```

**Por que 6 colunas em vez de um schema normalizado?**

**Alternativa (normalizado):**
```sql
CREATE TABLE draws (
  contest_number INTEGER PRIMARY KEY,
  draw_date TEXT NOT NULL
);

CREATE TABLE draw_numbers (
  contest_number INTEGER,
  number INTEGER,
  PRIMARY KEY (contest_number, number)
);
```

**Análise de trade-off:**
- **Schema atual (desnormalizado):** Queries mais rápidas, joins mais simples, mais armazenamento
- **Schema normalizado:** Menos armazenamento, queries mais complexas, mais joins

**Decisão:** Carga de leitura pesada, armazenamento é barato → desnormalizado é apropriado.

---

## Detecção de Padrões: O Que Podemos Encontrar

Abra `lib/analytics/statistics.ts:175-228`:

```typescript
detectPatterns(): Pattern[] {
  const patterns: Pattern[] = [];

  // Padrão de números consecutivos
  const consecutiveQuery = `
    SELECT
      COUNT(*) as occurrences,
      MAX(draw_date) as last_seen
    FROM draws
    WHERE
      (number_2 = number_1 + 1) OR
      (number_3 = number_2 + 1) OR
      (number_4 = number_3 + 1) OR
      (number_5 = number_4 + 1) OR
      (number_6 = number_5 + 1)
  `;

  const consecutive = this.db.prepare(consecutiveQuery).get();

  patterns.push({
    type: 'consecutive',
    description: 'Números consecutivos no sorteio',
    occurrences: consecutive.occurrences,
    lastSeen: consecutive.last_seen,
  });

  // Padrões de distribuição par/ímpar
  const evenOddQuery = `
    SELECT
      COUNT(*) as occurrences,
      MAX(draw_date) as last_seen
    FROM draws
    WHERE
      (number_1 % 2 = 0 AND number_2 % 2 = 0 AND number_3 % 2 = 0 AND
       number_4 % 2 = 0 AND number_5 % 2 = 0 AND number_6 % 2 = 0)
  `;

  const allEven = this.db.prepare(evenOddQuery).get();

  patterns.push({
    type: 'all_even',
    description: 'Todos os números pares',
    occurrences: allEven.occurrences,
    lastSeen: allEven.last_seen,
  });

  return patterns;
}
```

**Quais padrões são detectados:**

1. **Números consecutivos:** Quaisquer dois números adjacentes no sorteio (ex: {23, 24})
2. **Todos pares:** Todos os seis números são pares

**Mais padrões que PODERIAM ser adicionados:**
- Todos ímpares
- Pesado em primos (4+ primos)
- Mesma década (4+ números de 1-10, 11-20, etc.)
- Números de Fibonacci

---

## A Lei dos Grandes Números

**Definição:** Conforme o número de tentativas aumenta, a frequência observada converge para a probabilidade teórica.

**Na Mega-Sena:**
- Frequência esperada por número: Total de sorteios × 6 / 60 = Total de sorteios / 10
- Após 3000 sorteios: Esperado 300 aparições por número
- Após 30.000 sorteios: Esperado 3000 aparições por número

**O que isso significa:**
- Com poucos sorteios, frequências podem variar amplamente
- Com muitos sorteios, frequências devem convergir para uniformidade
- Números "quentes" e "frios" são desvios temporários, não sinais preditivos

**Referência de código:** O app mostra "números mais frequentes" e "menos frequentes" em `lib/analytics/statistics.ts:140-142`. Estes são descritivos, não preditivos.

---

## Teste Qui-Quadrado para Uniformidade

Um teste estatístico para determinar se frequências observadas correspondem a frequências esperadas.

**Fórmula:**
```
χ² = Σ (observado - esperado)² / esperado
```

**Exemplo:** Após 1000 sorteios
- Frequência esperada: 1000 × 6 / 60 = 100 por número
- Se o número 10 apareceu 120 vezes: (120-100)² / 100 = 4

Some isso para todos os 60 números e compare com o valor crítico.

**Se χ² é alto:** Os sorteios podem não ser uniformes (investigação necessária)
**Se χ² é baixo:** A distribuição é consistente com aleatoriedade

**Nota:** Este app não implementa teste qui-quadrado, mas poderia ser adicionado para garantia de qualidade da fonte de dados.

---

## Médias Móveis e Tendências

Analistas financeiros usam médias móveis para identificar tendências. Poderíamos aplicar isso a números de loteria?

**Técnica:** Calcular frequência média sobre uma janela deslizante

```typescript
function movingAverageFrequencies(draws: Draw[], window: number, number: number) {
  const averages: number[] = [];

  for (let i = window; i < draws.length; i++) {
    const windowDraws = draws.slice(i - window, i);
    const count = windowDraws.filter(d => d.numbers.includes(number)).length;
    averages.push(count / window);
  }

  return averages;
}
```

**Interpretação:**
- Tendência ascendente: Número aparecendo mais frequentemente recentemente
- Tendência descendente: Número aparecendo menos frequentemente recentemente
- Estável: Consistente com frequência esperada

**Lembrete crítico:** Tendências descrevem o PASSADO, não predizem o FUTURO. Cada sorteio é independente.

---

## Desvio Padrão e Z-Scores

Como determinamos se uma frequência é "incomum"?

**Desvio padrão:** Mede a dispersão dos dados
```
σ = √(Σ(x - μ)² / N)
```
Onde μ = média, N = tamanho da amostra

**Z-score:** Quantos desvios padrão da média
```
z = (x - μ) / σ
```

**Regra prática:**
- |z| < 2: Variação normal
- 2 ≤ |z| < 3: Incomum
- |z| ≥ 3: Muito incomum (possível erro de dados)

**Exemplo de aplicação:**
```typescript
function analyzeOutliers(frequencies: NumberFrequency[]) {
  const mean = frequencies.reduce((sum, f) => sum + f.frequency, 0) / frequencies.length;
  const variance = frequencies.reduce((sum, f) => sum + Math.pow(f.frequency - mean, 2), 0) / frequencies.length;
  const stdDev = Math.sqrt(variance);

  return frequencies
    .map(f => ({
      number: f.number,
      frequency: f.frequency,
      zScore: (f.frequency - mean) / stdDev
    }))
    .filter(f => Math.abs(f.zScore) >= 2);
}
```

---

## Exercício 3.1: Implementar Média e Mediana

**Tarefa:** Escreva funções para calcular média e mediana de frequências de números.

```typescript
interface NumberFrequency {
  number: number;
  frequency: number;
  lastDrawnContest: number | null;
  lastDrawnDate: string | null;
}

function mean(frequencies: NumberFrequency[]): number {
  // TODO: Calcular média aritmética
}

function median(frequencies: NumberFrequency[]): number {
  // TODO: Calcular mediana (valor do meio quando ordenado)
}
```

**Dados de teste:**
```typescript
const testFreqs: NumberFrequency[] = [
  { number: 1, frequency: 280, lastDrawnContest: 3000, lastDrawnDate: '2025-01-01' },
  { number: 2, frequency: 310, lastDrawnContest: 2999, lastDrawnDate: '2025-01-01' },
  { number: 3, frequency: 295, lastDrawnContest: 2998, lastDrawnDate: '2025-01-01' },
];
```

<details>
<summary>Solução</summary>

```typescript
function mean(frequencies: NumberFrequency[]): number {
  if (frequencies.length === 0) return 0;
  const sum = frequencies.reduce((acc, f) => acc + f.frequency, 0);
  return sum / frequencies.length;
}

function median(frequencies: NumberFrequency[]): number {
  if (frequencies.length === 0) return 0;

  const sorted = [...frequencies].sort((a, b) => a.frequency - b.frequency);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Par: média dos dois valores do meio
    return (sorted[mid - 1].frequency + sorted[mid].frequency) / 2;
  } else {
    // Ímpar: valor do meio
    return sorted[mid].frequency;
  }
}
```

</details>

---

## Exercício 3.2: Histograma de Distribuição de Frequência

**Tarefa:** Crie uma função que agrupa frequências em intervalos.

```typescript
type HistogramBin = {
  range: string;  // ex: "280-289"
  count: number;  // Quantos números caem neste intervalo
};

function frequencyHistogram(
  frequencies: NumberFrequency[],
  binSize: number
): HistogramBin[] {
  // TODO:
  // 1. Encontre frequências mín e máx
  // 2. Crie bins de tamanho binSize
  // 3. Conte números em cada bin
  // 4. Retorne array de bins
}
```

**Exemplo de saída:**
```typescript
[
  { range: "270-279", count: 5 },
  { range: "280-289", count: 12 },
  { range: "290-299", count: 18 },
  { range: "300-309", count: 15 },
  { range: "310-319", count: 10 }
]
```

<details>
<summary>Solução</summary>

```typescript
function frequencyHistogram(
  frequencies: NumberFrequency[],
  binSize: number
): HistogramBin[] {
  if (frequencies.length === 0) return [];

  const freqs = frequencies.map(f => f.frequency);
  const min = Math.min(...freqs);
  const max = Math.max(...freqs);

  // Cria bins
  const bins: Map<string, number> = new Map();

  for (let freq of freqs) {
    const binStart = Math.floor((freq - min) / binSize) * binSize + min;
    const binEnd = binStart + binSize - 1;
    const range = `${binStart}-${binEnd}`;

    bins.set(range, (bins.get(range) || 0) + 1);
  }

  // Converte para array e ordena por range
  return Array.from(bins.entries())
    .map(([range, count]) => ({ range, count }))
    .sort((a, b) => parseInt(a.range.split('-')[0]) - parseInt(b.range.split('-')[0]));
}
```

</details>

---

## Exercício 3.3: Análise de Sequências

**Tarefa:** Encontre a maior lacuna entre aparições para cada número.

```typescript
interface StreakInfo {
  number: number;
  longestGap: number;     // Máximo de sorteios consecutivos sem aparecer
  currentGap: number;     // Sorteios desde a última aparição (0 se apareceu no mais recente)
}

function analyzeStreaks(
  draws: Array<{ numbers: number[] }>,
  number: number
): { longestGap: number; currentGap: number } {
  // TODO:
  // 1. Itere através dos sorteios (mais antigo para mais recente)
  // 2. Rastreie sorteios consecutivos sem o número
  // 3. Retorne lacuna mais longa e lacuna atual
}

function analyzeAllStreaks(
  draws: Array<{ numbers: number[] }>
): StreakInfo[] {
  // TODO: Analise para todos os números 1-60
}
```

<details>
<summary>Solução</summary>

```typescript
function analyzeStreaks(
  draws: Array<{ numbers: number[] }>,
  number: number
): { longestGap: number; currentGap: number } {
  let longestGap = 0;
  let currentGap = 0;
  let gap = 0;

  for (const draw of draws) {
    if (draw.numbers.includes(number)) {
      if (gap > longestGap) {
        longestGap = gap;
      }
      gap = 0;
    } else {
      gap++;
    }
  }

  currentGap = gap;

  return { longestGap, currentGap };
}

function analyzeAllStreaks(
  draws: Array<{ numbers: number[] }>
): StreakInfo[] {
  const results: StreakInfo[] = [];

  for (let num = 1; num <= 60; num++) {
    const { longestGap, currentGap } = analyzeStreaks(draws, num);
    results.push({
      number: num,
      longestGap,
      currentGap
    });
  }

  return results.sort((a, b) => b.longestGap - a.longestGap);
}
```

</details>

---

## A Falácia do Apostador: Um Lembrete

Depois de toda esta análise estatística, é crucial lembrar:

**A falácia do apostador** é a crença equivocada de que eventos aleatórios passados afetam eventos futuros independentes.

**Exemplos de pensamento falacioso:**
- "O número 10 não aparece em 50 sorteios, está 'para sair'"
- "O número 53 está 'quente', continua aparecendo"
- "Este padrão não ocorreu há muito tempo, está fadado a acontecer"

**Realidade:** Cada sorteio é independente. As bolas não têm memória.

**O que este app REALMENTE fornece:**
1. Contexto histórico: "Isto é o que aconteceu"
2. Entretenimento: Exploração de padrões
3. Seleção de estratégia: "Prefiro números frios" (preferência pessoal, não vantagem matemática)

---

## Resumo do Capítulo 3

**Você aprendeu:**
- A diferença entre estatística descritiva e inferencial
- Como análise de frequência funciona neste codebase
- O padrão de view materializada para performance
- Técnicas de detecção de padrões (consecutivos, par/ímpar)
- A Lei dos Grandes Números e suas implicações
- Como calcular média, mediana e outliers
- A distinção crítica: nós descrevemos, não prevemos

**Referências de código:**
- `lib/analytics/statistics.ts:49-61` - Query de frequência
- `lib/analytics/statistics.ts:63-129` - Update de frequência com transações
- `lib/analytics/statistics.ts:175-228` - Detecção de padrões
- `lib/analytics/statistics.ts:131-173` - Agregação de estatísticas de sorteios

**Conclusão chave:** Toda análise estatística neste app é **descritiva**. Nos conta o que aconteceu no passado, não o que acontecerá no futuro. Sorteios de loteria são eventos independentes.

---

## Leitura Complementar

- [Estatística Descritiva vs Inferencial](https://statisticsbyjim.com/basics/descriptive-inferential-statistics/)
- [Lei dos Grandes Números](https://en.wikipedia.org/wiki/Law_of_large_numbers)
- [Falácia do Apostador](https://en.wikipedia.org/wiki/Gambler%27s_fallacy)
- [Teste Qui-Quadrado](https://www.khanacademy.org/math/ap-statistics/chi-square-tests)

---

**A seguir:** Capítulo 4 cobre Algoritmos - a maquinaria bela por trás de geração de números aleatórios, embaralhamento e otimização de orçamento.
