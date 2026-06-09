# Capítulo 7: Sistema de Geração de Apostas - Arquitetura Completa

## Introdução

Este é o capítulo onde tudo se une. Você verá como combinatória, estatística, algoritmos e banco de dados se unem para criar um sistema sofisticado de geração de apostas.

O sistema gera apostas otimizadas para um orçamento dado, usando diferentes estratégias de seleção de números.

---

## Visão Geral da Arquitetura

```
Entrada: Orçamento + Estratégia
    ↓
Validação (orçamento mínimo)
    ↓
Busca de Candidatos (hot/cold pools)
    ↓
Determinação de Tamanhos (PD optimization)
    ↓
Seleção de Números (estratégia específica)
    ↓
Deduplicação (assinaturas canônicas)
    ↓
Saída: Apostas + Estatísticas
```

Abra `lib/analytics/bet-generator.ts` para ver a implementação completa.

---

## Interface Pública

Abra `lib/analytics/bet-generator.ts:11-33`:

```typescript
export interface Bet {
  id: string;
  numbers: number[];
  cost: number;
  type: 'simple' | 'multiple';
  numberCount: number;
  strategy: string;
}

export interface BetGenerationResult {
  bets: Bet[];
  totalCost: number;
  remainingBudget: number | null;
  budgetUtilization: number | null;
  totalNumbers: number; // Números únicos cobertos
  strategy: string;
  mode: BetGenerationMode;
  summary: {
    simpleBets: number;
    multipleBets: number;
    averageCost: number;
  };
}

export type BetStrategy =
  | 'random'
  | 'hot_numbers'
  | 'cold_numbers'
  | 'balanced'
  | 'fibonacci'
  | 'custom';
```

---

## Função Principal: generateOptimizedBets

Abra `lib/analytics/bet-generator.ts:274-328`:

```typescript
generateOptimizedBets(
  budget: number,
  mode: BetGenerationMode = BET_GENERATION_MODE.OPTIMIZED,
  strategy: BetStrategy = 'balanced'
): BetGenerationResult {
  const simpleBetCost = this.getBetCost(6);

  // Validação de entrada
  if (budget < simpleBetCost) {
    throw new Error(`Orçamento insuficiente. Mínimo: R$ ${simpleBetCost.toFixed(2)}`);
  }

  // Busca pools de candidatos uma vez (cache em memória)
  const pools = this.fetchCandidatePools();

  let bets: Bet[] = [];

  // Seleciona modo de geração
  switch (mode) {
    case BET_GENERATION_MODE.SIMPLE_ONLY:
      bets = this.generateSimpleBets(budget, strategy, pools);
      break;
    case BET_GENERATION_MODE.MULTIPLE_ONLY:
      bets = this.generateLargestMultipleBet(budget, strategy, pools);
      break;
    case BET_GENERATION_MODE.MIXED:
      bets = this.generateMixedBets(budget, strategy, pools);
      break;
    case BET_GENERATION_MODE.OPTIMIZED:
    default:
      bets = this.generateOptimizedMix(budget, strategy, pools);
      break;
  }

  // Calcula estatísticas
  const totalCost = bets.reduce((sum, bet) => sum + bet.cost, 0);
  const remainingBudget = budget - totalCost;
  const budgetUtilization = (totalCost / budget) * 100;

  // Calcula números únicos cobertos
  const allNumbers = new Set<number>();
  bets.forEach(bet => bet.numbers.forEach(num => allNumbers.add(num)));

  return {
    bets,
    totalCost,
    remainingBudget,
    budgetUtilization,
    totalNumbers: allNumbers.size,
    strategy,
    mode,
    summary: {
      simpleBets: bets.filter(b => b.type === 'simple').length,
      multipleBets: bets.filter(b => b.type === 'multiple').length,
      averageCost: bets.length > 0 ? totalCost / bets.length : 0,
    },
  };
}
```

---

## Modos de Geração

### 1. SIMPLE_ONLY: Apenas Apostas Simples

Abra `lib/analytics/bet-generator.ts:334-358`:

```typescript
private generateSimpleBets(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
  const simpleBetCost = this.getBetCost(6);
  const maxBets = Math.min(
    Math.floor(budget / simpleBetCost),
    BetGenerator.MAX_BETS_PER_GENERATION
  );
  const bets: Bet[] = [];
  const seenSignatures = new Set<string>();

  for (let i = 0; i < maxBets; i++) {
    const bet = this.generateUniqueBet(6, strategy, pools, seenSignatures);
    if (bet) {
      bets.push({
        id: this.generateBetId(),
        numbers: bet,
        cost: simpleBetCost,
        type: 'simple',
        numberCount: 6,
        strategy,
      });
    }
  }

  return bets;
}
```

**Exemplo:** Orçamento R$60 → 10 apostas de 6 números

### 2. MULTIPLE_ONLY: A Maior Aposta Múltipla

Abra `lib/analytics/bet-generator.ts:363-400`:

```typescript
private generateLargestMultipleBet(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
  let selectedNumberCount = 6;

  // Encontra a maior aposta múltipla dentro do orçamento (até 20 números)
  for (let count = MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE; count >= 6; count--) {
    const cost = BET_PRICES[count];
    if (cost !== undefined && cost <= budget) {
      selectedNumberCount = count;
      break;
    }
  }

  const seenSignatures = new Set<string>();
  const numbers = this.generateUniqueBet(selectedNumberCount, strategy, pools, seenSignatures);
  const selectedCost = this.getBetCost(selectedNumberCount);

  if (!numbers) {
    // Fallback para aleatório puro se estratégia falhou
    return [{
      id: this.generateBetId(),
      numbers: this.selectRandomFromPool(pools.all, selectedNumberCount),
      cost: selectedCost,
      type: selectedNumberCount > 6 ? 'multiple' : 'simple',
      numberCount: selectedNumberCount,
      strategy: `multiple_${strategy}_fallback`,
    }];
  }

  return [{
    id: this.generateBetId(),
    numbers,
    cost: selectedCost,
    type: selectedNumberCount > 6 ? 'multiple' : 'simple',
    numberCount: selectedNumberCount,
    strategy: `multiple_${strategy}`,
  }];
}
```

**Exemplo:** Orçamento R$200 → Uma aposta de 10 números (R$126)

### 3. MIXED: Combinação de Apostas

Abra `lib/analytics/bet-generator.ts:406-466`:

```typescript
private generateMixedBets(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
  const bets: Bet[] = [];
  const seenSignatures = new Set<string>();
  let remainingBudget = budget;
  const simpleBetCost = this.getBetCost(6);
  const minimumMultipleCost = this.getBetCost(7);

  // Aloca porcentagem para apostas múltiplas
  const multipleAllocation = budget * BET_ALLOCATION.MIXED_MULTIPLE_PERCENTAGE;

  // Gera uma aposta múltipla
  if (multipleAllocation >= minimumMultipleCost) {
    let bestMultipleSize = 7;
    let bestMultipleCost = minimumMultipleCost;
    for (let count = MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE; count >= 7; count--) {
      const cost = BET_PRICES[count];
      if (cost !== undefined && cost <= multipleAllocation) {
        bestMultipleSize = count;
        bestMultipleCost = cost;
        break;
      }
    }

    if (bestMultipleSize > 6) {
      const numbers = this.generateUniqueBet(bestMultipleSize, strategy, pools, seenSignatures);
      if (numbers) {
        bets.push({
          id: this.generateBetId(),
          numbers,
          cost: bestMultipleCost,
          type: 'multiple',
          numberCount: bestMultipleSize,
          strategy: `multiple_${strategy}`,
        });
        remainingBudget -= bestMultipleCost;
      }
    }
  }

  // Preenche orçamento restante com apostas simples
  const remainingSlots = Math.max(0, BetGenerator.MAX_BETS_PER_GENERATION - bets.length);
  const maxSimpleBets = Math.min(
    Math.floor(remainingBudget / simpleBetCost),
    remainingSlots
  );

  for (let i = 0; i < maxSimpleBets; i++) {
    const numbers = this.generateUniqueBet(6, strategy, pools, seenSignatures);
    if (numbers) {
      bets.push({
        id: this.generateBetId(),
        numbers,
        cost: simpleBetCost,
        type: 'simple',
        numberCount: 6,
        strategy,
      });
    }
  }

  return bets;
}
```

**Exemplo:** Orçamento R$200 → Uma aposta de 9 números (R$84) + 19 apostas simples (R$114)

### 4. OPTIMIZED: Maximização de Cobertura

Abra `lib/analytics/bet-generator.ts:473-495`:

```typescript
private generateOptimizedMix(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
  const bets: Bet[] = [];
  const seenSignatures = new Set<string>();
  const optimizedSizes = this.buildOptimizedBetSizes(budget);

  for (const numberCount of optimizedSizes) {
    const numbers = this.generateUniqueBet(numberCount, strategy, pools, seenSignatures);
    if (!numbers) {
      continue;
    }
    const cost = this.getBetCost(numberCount);
    bets.push({
      id: this.generateBetId(),
      numbers,
      cost,
      type: numberCount > 6 ? 'multiple' : 'simple',
      numberCount,
      strategy: numberCount > 6 ? `multiple_${strategy}` : strategy,
    });
  }

  return bets;
}
```

**Otimização:** Usa programação dinâmica (Capítulo 4) para maximizar cobertura de números únicos.

**Exemplo:** Orçamento R$200 → Apostas de [10, 8, 8, 7, 6, 6] números = máxima cobertura

---

## Estratégias de Seleção

### fetchCandidatePools: Cache em Memória

Abra `lib/analytics/bet-generator.ts:76-101`:

```typescript
private fetchCandidatePools(): CandidatePool {
  // Busca números quentes (top 30 por frequência)
  const hot = this.db
    .prepare(
      `SELECT number FROM number_frequency
       ORDER BY frequency DESC
       LIMIT ?`
    )
    .all(BetGenerator.STRATEGY_POOL_SIZE) as Array<{ number: number }>;

  // Busca números frios (bottom 30 por frequência)
  const cold = this.db
    .prepare(
      `SELECT number FROM number_frequency
       ORDER BY frequency ASC
       LIMIT ?`
    )
    .all(BetGenerator.STRATEGY_POOL_SIZE) as Array<{ number: number }>;

  // Todos os números 1-60
  const all = Array.from(
    { length: MEGASENA_CONSTANTS.MAX_NUMBER },
    (_, i) => i + 1
  );

  return {
    hot: hot.map(h => h.number),
    cold: cold.map(c => c.number),
    all,
  };
}
```

**Por que cache:** Evita 60 queries ao banco por geração. Buscamos uma vez, reutilizamos.

### generateUniqueBet: Garantia de Unicidade

Abra `lib/analytics/bet-generator.ts:502-542`:

```typescript
private generateUniqueBet(
  count: number,
  strategy: BetStrategy,
  pools: CandidatePool,
  seenSignatures: Set<string>
): number[] | null {
  let attempts = 0;
  let useFallback = false;

  while (attempts < BetGenerator.MAX_DEDUP_ATTEMPTS) {
    // Após FALLBACK_THRESHOLD tentativas, muda para aleatório puro
    if (attempts >= BetGenerator.FALLBACK_THRESHOLD) {
      useFallback = true;
    }

    const numbers = useFallback
      ? this.selectRandomFromPool(pools.all, count)
      : this.generateNumberSetFromPools(count, strategy, pools);

    const signature = this.getBetSignature(numbers);

    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      return numbers.sort((a, b) => a - b);
    }

    attempts++;
  }

  // Último recurso: aleatório puro com tentativa garantida de unicidade
  for (let i = 0; i < 10; i++) {
    const numbers = this.selectRandomFromPool(pools.all, count);
    const signature = this.getBetSignature(numbers);
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      return numbers.sort((a, b) => a - b);
    }
  }

  return null; // Não foi possível gerar aposta única
}
```

**Fallback progressivo:**
1. Tenta com estratégia (hot/cold/balanced)
2. Após 10 tentativas, muda para aleatório
3. Último recurso: força bruta com 10 tentativas

---

## Exemplo de Uso Completo

```typescript
import { BetGenerator } from '@/lib/analytics/bet-generator';

async function generateForUser(budget: number, strategy: string) {
  const generator = new BetGenerator();

  // Gera apostas otimizadas
  const result = generator.generateOptimizedBets(
    budget,
    'optimized', // modo otimizado
    strategy as BetStrategy
  );

  // Exibe resultados
  console.log(`Total de apostas: ${result.bets.length}`);
  console.log(`Custo total: R$ ${result.totalCost.toFixed(2)}`);
  console.log(`Orçamento utilizado: ${result.budgetUtilization?.toFixed(1)}%`);
  console.log(`Números únicos cobertos: ${result.totalNumbers}/60`);

  // Exibe cada aposta
  for (const bet of result.bets) {
    console.log(`${bet.type}: [${bet.numbers.join(', ')}] - R$ ${bet.cost.toFixed(2)}`);
  }

  return result;
}

// Uso
await generateForUser(200, 'balanced');
```

---

## Exercício 7.1: Implementar Estratégia Personalizada

**Tarefa:** Implemente uma estratégia que prioriza números primos.

```typescript
// lib/analytics/bet-generator.ts

private generatePrimeNumbers(count: number): number[] {
  // TODO:
  // 1. Use PRIME_NUMBERS de constants.ts
  // 2. Embaralhe com Fisher-Yates
  // 3. Selecione 'count' números primos
  // 4. Se insuficiente, preencha com não-primos
}

private generateNumberSetFromPools(count: number, strategy: BetStrategy, pools: CandidatePool): number[] {
  switch (strategy) {
    // ... casos existentes ...
    case 'fibonacci':
      return this.generateFibonacciNumbers(count);
    case 'prime':
      return this.generatePrimeNumbers(count); // NOVO
    default:
      return this.selectRandomFromPool(pools.all, count);
  }
}
```

<details>
<summary>Solução</summary>

```typescript
private generatePrimeNumbers(count: number): number[] {
  // Importa PRIME_NUMBERS de constants.ts
  const primes = [...PRIME_NUMBERS];
  const shuffled = this.shuffle(primes);
  const selected = shuffled.slice(0, Math.min(count, primes.length));

  // Preenche com não-primos se necessário
  if (selected.length < count) {
    const nonPrimes = Array.from(
      { length: MEGASENA_CONSTANTS.MAX_NUMBER },
      (_, i) => i + 1
    ).filter(n => !PRIME_NUMBERS.includes(n));

    const shuffledNonPrimes = this.shuffle(nonPrimes);
    selected.push(...shuffledNonPrimes.slice(0, count - selected.length));
  }

  return selected;
}
```

</details>

---

## Exercício 7.2: Calcular Cobertura Esperada

**Tarefa:** Calcule quantas combinações de 6 números são cobertas por um conjunto de apostas.

```typescript
interface CoverageAnalysis {
  totalCombinations: number;
  coveredCombinations: number;
  coveragePercentage: number;
}

function analyzeCoverage(bets: Array<{ numbers: number[] }>): CoverageAnalysis {
  // TODO:
  // 1. Para cada aposta de k números, calcule C(k, 6)
  // 2. Some todas as combinações cobertas
  // 3. Calcule porcentagem de cobertura do espaço total (50.063.860)
  // 4. Note: Combinações podem se sobrepor (não são aditivas)
}

// Teste
const bets = [
  { numbers: [1, 2, 3, 4, 5, 6] },      // C(6,6) = 1
  { numbers: [1, 2, 3, 4, 5, 6, 7] },   // C(7,6) = 7
  { numbers: [1, 2, 3, 4, 5, 6, 7, 8] }, // C(8,6) = 28
];

console.log(analyzeCoverage(bets));
// { totalCombinations: 50063860, coveredCombinations: 36, coveragePercentage: ~0.00007% }
```

<details>
<summary>Solução</summary>

```typescript
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k;

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

function analyzeCoverage(bets: Array<{ numbers: number[] }>): CoverageAnalysis {
  const totalCombinations = combinations(60, 6); // 50.063.860

  let coveredCombinations = 0;
  for (const bet of bets) {
    const k = bet.numbers.length;
    coveredCombinations += combinations(k, 6);
  }

  const coveragePercentage = (coveredCombinations / totalCombinations) * 100;

  return {
    totalCombinations,
    coveredCombinations,
    coveragePercentage,
  };
}
```

**Nota:** Isso assume que as combinações não se sobrepõem. Na prática, apostas com números sobrepostos têm menos cobertura única.

</details>

---

## Exercício 7.3: Modo de Orçamento Fixo

**Tarefa:** Implemente um modo que gera apostas até exatamente esgotar o orçamento.

```typescript
function generateExactBudget(
  generator: BetGenerator,
  targetBudget: number,
  strategy: BetStrategy
): BetGenerationResult {
  // TODO:
  // 1. Gera apostas otimizadas
  // 2. Se sobrar orçamento, tenta adicionar apostas simples
  // 3. Repete até orçamento ser exatamente utilizado
  // 4. Se não for possível exato, retorna melhor aproximação
}
```

<details>
<summary>Solução</summary>

```typescript
function generateExactBudget(
  generator: BetGenerator,
  targetBudget: number,
  strategy: BetStrategy
): BetGenerationResult {
  const simpleCost = 6.0;
  let result = generator.generateOptimizedBets(targetBudget, 'optimized', strategy);

  // Tenta gastar o restante com apostas simples
  let remaining = result.remainingBudget ?? 0;
  let attempts = 0;

  while (remaining >= simpleCost && attempts < 10) {
    const extraBets = Math.floor(remaining / simpleCost);

    if (extraBets === 0) break;

    // Gera apostas extras
    const extraResult = generator.generateOptimizedBets(
      remaining,
      'simple_only',
      strategy
    );

    // Adiciona apostas extras ao resultado
    result.bets.push(...extraResult.bets);
    result.totalCost += extraResult.totalCost;
    result.summary.simpleBets += extraResult.summary.simpleBets;

    remaining = result.remainingBudget ?? 0;
    attempts++;
  }

  result.budgetUtilization = (result.totalCost / targetBudget) * 100;
  result.remainingBudget = targetBudget - result.totalCost;

  return result;
}
```

</details>

---

## Análise de Estratégias

| Estratégia | Filosofia | Melhor Para |
|------------|-----------|-------------|
| `random` | Aleatório puro | Nenhuma preferência |
| `hot_numbers` | Frequentes históricos | "Números em dia" |
| `cold_numbers` | Infrequentes históricos | "Números atrasados" |
| `balanced` | 50% hot + 50% cold | Equilíbrio |
| `fibonacci` | Sequência matemática | Interesse numérico |
| `prime` (custom) | Números primos | Interesse matemático |

**Importante:** Nenhuma estratégia é matematicamente superior. Todas são preferências pessoais, não vantagens estatísticas.

---

## Resumo do Capítulo 7

**Você aprendeu:**
- A arquitetura completa do sistema de geração de apostas
- Os quatro modos de geração (simple, multiple, mixed, optimized)
- Como as estratégias de seleção funcionam
- O padrão de cache com `fetchCandidatePools`
- Garantia de unicidade com assinaturas canônicas
- Fallback progressivo para geração robusta
- Análise de cobertura e orçamento

**Referências de código:**
- `lib/analytics/bet-generator.ts:11-33` - Interfaces
- `lib/analytics/bet-generator.ts:274-328` - Função principal
- `lib/analytics/bet-generator.ts:473-495` - Modo otimizado
- `lib/analytics/bet-generator.ts:502-542` - Deduplicação

**Insight chave:** O sistema combina algoritmos sofisticados (PD, Fisher-Yates) com garantias práticas (limite de tentativas, fallback) para criar uma experiência de usuário robusta.

---

## Leitura Complementar

- [Design de Sistemas de Apostas](https://en.wikipedia.org/wiki/Betting_system)
- [Otimização Combinatória](https://en.wikipedia.org/wiki/Combinatorial_optimization)
- [Heurística](https://en.wikipedia.org/wiki/Heuristic)

---

**A seguir:** Capítulo 8 cobre Testes - como garantir que tudo funciona corretamente com Vitest.
