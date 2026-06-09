# Capítulo 4: Algoritmos - A Maquinaria por Trás da Geração de Apostas

## Introdução

Este capítulo mergulha nos algoritmos que fazem este aplicativo funcionar. Você aprenderá sobre geração de números aleatórios, o algoritmo de Fisher-Yates para embaralhamento, programação dinâmica para otimização de orçamento, e o algoritmo euclidiano para MDC.

Estes são algoritmos fundamentais que todo desenvolvedor deve conhecer.

---

## Gerando Números Aleatórios

O aplicativo precisa selecionar números aleatoriamente do conjunto {1, 2, ..., 60}.

### O Problema com Math.random()

```typescript
// Abordagem ingênua
function selectRandomNumbers(count: number): number[] {
  const selected: number[] = [];
  while (selected.length < count) {
    const num = Math.floor(Math.random() * 60) + 1;
    if (!selected.includes(num)) {
      selected.push(num);
    }
  }
  return selected;
}
```

**Problemas:**
1. **Complexidade de tempo crescente:** `includes()` é O(n), loops podem repetir
2. **Potencial loop infinito:** Teoricamente possível (embora improvável)
3. **Não garante uniformidade:** Distribuição pode ser levemente enviesada

**Solução:** Fisher-Yates shuffle + seleção

---

## Fisher-Yates Shuffle: O Algoritmo Correto

Abra `lib/analytics/bet-generator.ts:106-119`:

```typescript
private shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const valueI = result[i];
    const valueJ = result[j];
    if (valueI === undefined || valueJ === undefined) {
      continue;
    }
    result[i] = valueJ;
    result[j] = valueI;
  }
  return result;
}
```

**Como funciona:**

Imagine um baralho de cartas. O algoritmo:
1. Começa na última carta
2. Escolhe uma carta aleatória das cartas restantes (incluindo a atual)
3. Troca as duas cartas
4. Move para a carta anterior
5. Repete até chegar no topo

**Visualização:**
```
Inicial:  [A, B, C, D, E]
i=4: j=2  [A, B, E, D, C]  (troca E com C)
i=3: j=0  [D, B, E, A, C]  (troca A com D)
i=2: j=2  [D, B, E, A, C]  (troca E com ela mesma)
i=1: j=1  [D, B, E, A, C]  (troca B com ela mesma)
Final:    [D, B, E, A, C]
```

**Por que funciona:**
- Cada elemento tem igual probabilidade de terminar em qualquer posição
- Complexidade de tempo: O(n)
- Complexidade de espaço: O(1) além do array de entrada

---

## Usando Fisher-Yates para Seleção

Abra `lib/analytics/bet-generator.ts:638-641`:

```typescript
private selectRandomFromPool(pool: number[], count: number): number[] {
  const shuffled = this.shuffle(pool);
  return shuffled.slice(0, count);
}
```

**Por que funciona:**
1. Embaralhamos o array inteiro (O(n))
2. Tomamos os primeiros `count` elementos (O(1))
3. Cada subconjunto de tamanho `count` tem igual probabilidade

**Exemplo:**
```typescript
const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const shuffled = shuffle(pool);  // [7, 2, 9, 1, 5, 3, 10, 4, 8, 6]
const selected = shuffled.slice(0, 6);  // [7, 2, 9, 1, 5, 3]
```

---

## Deduplicação de Apostas: Assinaturas Canônicas

Como evitamos gerar a mesma aposta duas vezes?

Abra `lib/analytics/bet-generator.ts:68-70`:

```typescript
private getBetSignature(numbers: number[]): string {
  return [...numbers].sort((a, b) => a - b).join('-');
}
```

**Como funciona:**
- Ordena os números: `[5, 2, 7, 1, 6, 3]` → `[1, 2, 3, 5, 6, 7]`
- Junta com hífen: `"1-2-3-5-6-7"`
- Usa como chave em um `Set`

**Exemplo:**
```typescript
const bet1 = [5, 2, 7, 1, 6, 3];
const bet2 = [6, 1, 3, 7, 5, 2];

getBetSignature(bet1);  // "1-2-3-5-6-7"
getBetSignature(bet2);  // "1-2-3-5-6-7" (mesma assinatura!)

const seen = new Set<string>();
seen.add(getBetSignature(bet1));
seen.has(getBetSignature(bet2));  // true (detecta duplicata)
```

---

## Programação Dinâmica: Otimização de Orçamento

Este é o algoritmo mais complexo do codebase. Abra `lib/analytics/bet-generator.ts:157-268`.

### O Problema da Mochila

**Entrada:**
- Orçamento: R$100
- Opções de aposta: 6 números (R$6), 7 números (R$42), 8 números (R$168), etc.

**Objetivo:** Maximizar a cobertura de números únicos respeitando o orçamento

### Abordagem Ingênua: Força Bruta

```typescript
function bruteForceOptimization(budget: number): number[] {
  const results: number[][] = [];

  // Tenta todas as combinações possíveis
  for (let a = 0; a <= budget / 6; a++) {
    for (let b = 0; b <= budget / 42; b++) {
      for (let c = 0; c <= budget / 168; c++) {
        // ... e assim por diante
        const cost = a * 6 + b * 42 + c * 168;
        if (cost === budget) {
          results.push([/* combinação */]);
        }
      }
    }
  }

  return best(results);
}
```

**Problema:** Exponencial no número de opções. Impraticável.

### Abordagem PD: Programação Dinâmica

**Ideia:** Resolver subproblemas menores e construir a solução.

Abra `lib/analytics/bet-generator.ts:157-268`:

```typescript
private buildOptimizedBetSizes(budget: number): number[] {
  // Resolve para a menor unidade de custo
  const costUnitCents = this.resolveCostUnitCents();
  const budgetUnits = Math.floor(this.toCents(budget) / costUnitCents);

  // Opções disponíveis (tamanhos de aposta e seus custos em unidades)
  const options = [
    { numberCount: 7, costUnits: 7 },   // R$42 = 7 unidades de R$6
    { numberCount: 8, costUnits: 28 },  // R$168 = 28 unidades de R$6
    // ...
  ];

  // PD: bestPlans[i] = melhor plano usando i unidades
  const bestPlans: Array<PlanNode | null> = Array.from(
    { length: budgetUnits + 1 },
    () => null
  );
  bestPlans[0] = { totalNumbers: 0, betCount: 0, prevIndex: -1, prevBetSize: 0 };

  // Preenche a tabela PD
  for (let units = 0; units <= budgetUnits; units++) {
    const plan = bestPlans[units];
    if (!plan) continue;

    for (const option of options) {
      const nextUnits = units + option.costUnits;
      if (nextUnits > budgetUnits) continue;

      const candidate: PlanNode = {
        totalNumbers: plan.totalNumbers + option.numberCount,
        betCount: plan.betCount + 1,
        prevIndex: units,
        prevBetSize: option.numberCount,
      };

      // Atualiza se este candidato é melhor
      const currentPlan = bestPlans[nextUnits] ?? null;
      if (isBetterPlan(candidate, currentPlan)) {
        bestPlans[nextUnits] = candidate;
      }
    }
  }

  // Reconstrói a solução
  const sizes: number[] = [];
  let currentPlan: PlanNode | null = bestPlans[budgetUnits];
  while (currentPlan && currentPlan.prevIndex >= 0) {
    sizes.push(currentPlan.prevBetSize);
    currentPlan = bestPlans[currentPlan.prevIndex] ?? null;
  }

  return sizes.reverse();
}
```

**Complexidade:**
- Tempo: O(budget × options)
- Espaço: O(budget)

**Muito melhor que força bruta exponencial!**

---

## Máximo Divisor Comum (MDC)

Para resolver a otimização, primeiro encontramos o MDC de todos os preços.

Abra `lib/analytics/bet-generator.ts:133-142`:

```typescript
private gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x;
}
```

**Algoritmo Euclidiano:**

```
gcd(48, 18):
  48 = 18 × 2 + 12
  18 = 12 × 1 + 6
  12 = 6 × 2 + 0
  return 6
```

**Por que usamos MDC?**
- Encontra a menor unidade de custo compartilhada
- Permite resolver o problema em unidades discretas
- Exemplo: MDC(6, 42, 168) = 6, então nossa unidade é R$6

---

## Estratégias de Seleção de Números

Abra `lib/analytics/bet-generator.ts:548-633`:

### 1. Números Quentes (Hot)

```typescript
private selectFromHotPool(count: number, pools: CandidatePool): number[] {
  // Pega os N números mais quentes deterministicamente
  const selected = pools.hot.slice(0, Math.min(count, pools.hot.length));

  // Se o pool quente não tem suficiente, preenche com aleatório
  if (selected.length < count) {
    const remaining = pools.all.filter(n => !selected.includes(n));
    const shuffledRemaining = this.shuffle(remaining);
    selected.push(...shuffledRemaining.slice(0, count - selected.length));
  }

  return selected;
}
```

### 2. Números Frios (Cold)

```typescript
private selectFromColdPool(count: number, pools: CandidatePool): number[] {
  // Pega os N números mais frios deterministicamente
  const selected = pools.cold.slice(0, Math.min(count, pools.cold.length));

  if (selected.length < count) {
    const remaining = pools.all.filter(n => !selected.includes(n));
    const shuffledRemaining = this.shuffle(remaining);
    selected.push(...shuffledRemaining.slice(0, count - selected.length));
  }

  return selected;
}
```

### 3. Balanceado

```typescript
private selectBalancedFromPools(count: number, pools: CandidatePool): number[] {
  const hotCount = Math.ceil(count * BET_ALLOCATION.BALANCED_HOT_PERCENTAGE);
  const coldCount = count - hotCount;

  const shuffledHot = this.shuffle(pools.hot);
  const shuffledCold = this.shuffle(pools.cold);

  const selected = new Set<number>();

  // Adiciona números quentes
  for (const num of shuffledHot) {
    if (selected.size >= hotCount) break;
    selected.add(num);
  }

  // Adiciona números frios (evitando duplicatas)
  for (const num of shuffledCold) {
    if (selected.size >= count) break;
    if (!selected.has(num)) {
      selected.add(num);
    }
  }

  // Preenche o restante com aleatório se necessário
  if (selected.size < count) {
    const remaining = pools.all.filter(n => !selected.has(n));
    const shuffledRemaining = this.shuffle(remaining);
    for (const num of shuffledRemaining) {
      if (selected.size >= count) break;
      selected.add(num);
    }
  }

  return Array.from(selected);
}
```

### 4. Fibonacci

```typescript
private generateFibonacciNumbers(count: number): number[] {
  // Gera sequência de Fibonacci até 60
  const fibonacci: number[] = [1, 2];

  while (fibonacci.length >= 2) {
    const last = fibonacci[fibonacci.length - 1];
    const previous = fibonacci[fibonacci.length - 2];
    if (last === undefined || previous === undefined) break;
    if (last >= MEGASENA_CONSTANTS.MAX_NUMBER) break;

    const next = last + previous;
    if (next <= MEGASENA_CONSTANTS.MAX_NUMBER) {
      fibonacci.push(next);
    } else {
      break;
    }
  }

  // Embaralha e seleciona
  const shuffled = this.shuffle(fibonacci);
  const selected = shuffled.slice(0, Math.min(count, fibonacci.length));

  // Preenche com aleatório se necessário
  if (selected.length < count) {
    const remaining = Array.from(
      { length: MEGASENA_CONSTANTS.MAX_NUMBER },
      (_, i) => i + 1
    ).filter(n => !selected.includes(n));

    const shuffledRemaining = this.shuffle(remaining);
    selected.push(...shuffledRemaining.slice(0, count - selected.length));
  }

  return selected;
}
```

---

## Exercício 4.1: Implementar Fisher-Yates

**Tarefa:** Implemente o algoritmo Fisher-Yates do zero.

```typescript
function fisherYates<T>(array: T[]): T[] {
  // TODO:
  // 1. Crie uma cópia do array
  // 2. Itere do último índice até o segundo
  // 3. Para cada índice, escolha um índice aleatório ≤ ao atual
  // 4. Troque os elementos
  // 5. Retorne o array embaralhado
}

// Teste
const original = [1, 2, 3, 4, 5];
const shuffled = fisherYates(original);

// Verifique:
// 1. O array original não foi modificado
// 2. O array embaralhado tem os mesmos elementos
// 3. Execute muitas vezes e verifique distribuição uniforme
```

<details>
<summary>Solução</summary>

```typescript
function fisherYates<T>(array: T[]): T[] {
  const result = [...array];  // Cópia para não modificar o original

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    // Troca result[i] com result[j]
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}
```

</details>

---

## Exercício 4.2: MDC com Recursão

**Tarefa:** Implemente o algoritmo euclidiano de forma recursiva.

```typescript
function gcdRecursive(a: number, b: number): number {
  // TODO:
  // Caso base: se b === 0, retorne a
  // Caso recursivo: retorne gcdRecursive(b, a % b)
}

// Teste
console.log(gcdRecursive(48, 18));  // 6
console.log(gcdRecursive(17, 5));   // 1 (primos entre si)
console.log(gcdRecursive(100, 25)); // 25
```

<details>
<summary>Solução</summary>

```typescript
function gcdRecursive(a: number, b: number): number {
  if (b === 0) {
    return Math.abs(a);
  }
  return gcdRecursive(b, a % b);
}
```

**Nota:** A versão iterativa (linhas 133-142) é preferida na prática para evitar overflow de pilha com números grandes.

</details>

---

## Exercício 4.3: Memoização de Fibonacci

**Tarefa:** Implemente Fibonacci com memoização para evitar cálculos redundantes.

```typescript
// Ineficiente: O(2^n)
function fibNaive(n: number): number {
  if (n <= 1) return n;
  return fibNaive(n - 1) + fibNaive(n - 2);
}

// TODO: Implementar versão com memoização: O(n)
function fibMemo(n: number, memo: Map<number, number> = new Map()): number {
  // 1. Verifique se n está no memo
  // 2. Se não, calcule recursivamente e armazene
  // 3. Retorne o valor memoizado
}
```

<details>
<summary>Solução</summary>

```typescript
function fibMemo(n: number, memo: Map<number, number> = new Map()): number {
  if (n <= 1) return n;

  if (memo.has(n)) {
    return memo.get(n)!;
  }

  const result = fibMemo(n - 1, memo) + fibMemo(n - 2, memo);
  memo.set(n, result);

  return result;
}
```

**Alternativa iterativa (melhor):**
```typescript
function fibIterative(n: number): number {
  if (n <= 1) return n;

  let prev = 0;
  let curr = 1;

  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }

  return curr;
}
```

</details>

---

## Análise de Complexidade: Resumo

| Algoritmo | Tempo | Espaço | Referência |
|-----------|-------|--------|-----------|
| Fisher-Yates | O(n) | O(n)* | `bet-generator.ts:106-119` |
| Seleção aleatória | O(n) | O(1) | `bet-generator.ts:638-641` |
| Assinatura canônica | O(n log n) | O(n) | `bet-generator.ts:68-70` |
| Programação dinâmica | O(budget × options) | O(budget) | `bet-generator.ts:157-268` |
| MDC (Euclides) | O(log(min(a,b))) | O(1) | `bet-generator.ts:133-142` |

*O(n) para a cópia do array; O(1) adicional

---

## Resumo do Capítulo 4

**Você aprendeu:**
- Por que Math.random() sozinho é insuficiente para seleção aleatória
- O algoritmo Fisher-Yates para embaralhamento imparcial
- Assinaturas canônicas para deduplicação
- Programação dinâmica para otimização de orçamento
- O algoritmo euclidiano para MDC
- Estratégias de seleção de números (quente, frio, balanceado, Fibonacci)

**Referências de código:**
- `lib/analytics/bet-generator.ts:106-119` - Fisher-Yates shuffle
- `lib/analytics/bet-generator.ts:68-70` - Assinatura canônica
- `lib/analytics/bet-generator.ts:157-268` - Otimização PD
- `lib/analytics/bet-generator.ts:133-142` - MDC

**Insight chave:** Algoritmos eficientes transformam problemas impossíveis (força bruta exponencial) em soluções práticas (programação dinâmica polinomial).

---

## Leitura Complementar

- [Fisher-Yates Shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
- [Programação Dinâmica](https://en.wikipedia.org/wiki/Dynamic_programming)
- [Algoritmo Euclidiano](https://en.wikipedia.org/wiki/Euclidean_algorithm)
- [Knapsack Problem](https://en.wikipedia.org/wiki/Knapsack_problem)

---

**A seguir:** Capítulo 5 cobre Banco de Dados - SQLite, transações, prepared statements e otimização.
