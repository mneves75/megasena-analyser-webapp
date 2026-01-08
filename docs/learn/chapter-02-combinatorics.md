# Capítulo 2: Combinatória - A Matemática da Contagem

## Introdução

Por que uma aposta de 6 números custa R$6, mas uma aposta de 7 números custa R$42?

**Resposta:** Combinatória - o ramo da matemática que estuda contagem.

Este capítulo explica a matemática que faz os preços de loteria funcionarem. Você entenderá por que adicionar apenas um número à sua aposta pode aumentar o custo em 7x ou mais.

---

## Fatoriais: O Bloco de Construção

Antes das combinações, precisamos de fatoriais.

**Definição:** n fatorial = n! = n × (n-1) × (n-2) × ... × 2 × 1

**Exemplos:**
- 3! = 3 × 2 × 1 = 6
- 5! = 5 × 4 × 3 × 2 × 1 = 120
- 10! = 3.628.800

**Caso especial:** 0! = 1 (por definição)

**Por que nos importamos?** Fatoriais contam permutações - arranjos ordenados.

**Exemplo:** Quantas formas 3 pessoas podem sentar em 3 cadeiras?

- A pessoa A pode sentar em qualquer uma das 3 cadeiras
- A pessoa B pode sentar em qualquer uma das 2 cadeiras restantes
- A pessoa C fica com a última cadeira

Total: 3 × 2 × 1 = 3! = 6 formas

---

## Permutações vs Combinações

Esta distinção é **CRÍTICA**.

**Permutação:** Ordem importa
- {1,2,3} é diferente de {3,2,1}
- Fórmula: n! / (n-k)!
- Caso de uso: Senhas, resultados de corrida

**Combinação:** Ordem NÃO importa
- {1,2,3} é o mesmo que {3,2,1}
- Fórmula: C(n,k) = n! / (k! × (n-k)!)
- Caso de uso: Loteria, mãos de cartas

**Mega-Sena usa combinações** - as bolas são sorteadas uma por uma, mas apenas o conjunto final importa.

---

## A Fórmula de Combinação

```
C(n,k) = n! / (k! × (n-k)!)
```

**Onde:**
- n = total de itens para escolher (60 na Mega-Sena)
- k = itens para escolher (6 para uma aposta simples)

**Cálculo passo a passo para C(60,6):**

```
C(60,6) = 60! / (6! × 54!)
```

Isso significaria calcular números massivos. Mas podemos simplificar:

```
C(60,6) = (60 × 59 × 58 × 57 × 56 × 55) / (6 × 5 × 4 × 3 × 2 × 1)
        = (60 × 59 × 58 × 57 × 56 × 55) / 720
        = 50.063.860
```

**50 milhões de combinações possíveis.**

---

## Por Que os Preços Crescem Exponencialmente

Abra `lib/constants.ts:83-99`:

```typescript
export const BET_COMBINATIONS: Record<number, number> = {
  6: 1,
  7: 7,
  8: 28,
  9: 84,
  10: 210,
  11: 462,
  12: 924,
  13: 1716,
  14: 3003,
  15: 5005,
  16: 8008,
  17: 12376,
  18: 18564,
  19: 27132,
  20: 38760,
} as const;
```

**Estes números são:** Quantos jogos de 6 números existem em uma aposta de k números

Quando você escolhe 7 números, na verdade está comprando C(7,6) = 7 combinações diferentes de 6 números.

Quando você escolhe 8 números, na verdade está comprando C(8,6) = 28 combinações diferentes de 6 números.

**Fórmula geral:** Preço da aposta de k números = C(k,6) × R$6

Vamos verificar:
- 7 números: C(7,6) × 6 = 7 × 6 = 42 ✓
- 8 números: C(8,6) × 6 = 28 × 6 = 168 ✓
- 15 números: C(15,6) × 6 = 5005 × 6 = 30.030 ✓

---

## Implementação no Código: Calculando Combinações

O codebase não calcula combinações em tempo de execução - elas são pré-computadas em `BET_COMBINATIONS`. Aqui está como você implementaria:

```typescript
function combinations(n: number, k: number): number {
  // Trata casos extremos
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  // Otimiza: C(n,k) = C(n, n-k)
  if (k > n - k) k = n - k;

  // Calcula: (n × (n-1) × ... × (n-k+1)) / k!
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }

  return Math.round(result);
}
```

**Por que dividir em cada iteração?** Para evitar overflow com fatoriais grandes.

---

## Visualizando com o Triângulo de Pascal

O Triângulo de Pascal é uma representação visual de combinações:

```
        1          C(0,0)
       1 1         C(1,0) C(1,1)
      1 2 1        C(2,0) C(2,1) C(2,2)
     1 3 3 1       C(3,0) C(3,1) C(3,2) C(3,3)
    1 4 6 4 1      C(4,0) C(4,1) C(4,2) C(4,3) C(4,4)
   1 5 10 10 5 1   C(5,0) C(5,1) C(5,2) C(5,3) C(5,4) C(5,5)
```

**Regra:** Cada número = soma dos dois acima dele

**C(7,6) = 7** está na linha 7, posição 6.

Isso mostra por que combinações crescem rapidamente: cada linha aproximadamente dobra a soma da linha anterior.

---

## Probabilidade de Ganhar

Agora podemos calcular probabilidades exatas:

```typescript
// Total de resultados possíveis
const totalCombinations = combinations(60, 6); // 50.063.860

// Probabilidade de acertar exatamente 6 números (Sena)
const probSena = combinations(6, 6) * combinations(54, 0) / totalCombinations;
// = 1 / 50.063.860 ≈ 0,000002%

// Probabilidade de acertar exatamente 5 números (Quina)
const probQuina = combinations(6, 5) * combinations(54, 1) / totalCombinations;
// = 324 / 50.063.860 ≈ 0,000647%

// Probabilidade de acertar exatamente 4 números (Quadra)
const probQuadra = combinations(6, 4) * combinations(54, 2) / totalCombinations;
// = 21.465 / 50.063.860 ≈ 0,0429%
```

**Referência de código:** Este padrão de cálculo é usado em `lib/analytics/statistics.ts` ao analisar distribuições de prêmios.

---

## O Paradoxo do Aniversário

Um conceito relacionado: Em uma sala com 23 pessoas, há 50% de chance de duas compartilharem o mesmo aniversário.

**Por que mencionar isso?** Demonstra como a combinatória pode ser contra-intuitiva.

C(365, 23) parece enorme, ainda assim colisões acontecem frequentemente devido ao **número de pares**, não de indivíduos.

**Conexão com loteria:** Com 50 milhões de combinações, números vencedores duplicados através de 3000+ sorteios (histórico da Mega-Sena) são esperados, não surpreendentes.

---

## Exercício 2.1: Calculadora de Combinações

**Tarefa:** Implemente uma calculadora de combinações em TypeScript.

Crie `tests/combinations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

function combinations(n: number, k: number): number {
  // Sua implementação aqui
}

describe('Combinations', () => {
  it('should calculate C(6,6) = 1', () => {
    expect(combinations(6, 6)).toBe(1);
  });

  it('should calculate C(7,6) = 7', () => {
    expect(combinations(7, 6)).toBe(7);
  });

  it('should calculate C(60,6) = 50063860', () => {
    expect(combinations(60, 6)).toBe(50063860);
  });

  it('should handle C(20,10) = 184756', () => {
    expect(combinations(20, 10)).toBe(184756);
  });
});
```

**Rode com:** `bunx vitest tests/combinations.test.ts`

<details>
<summary>Solução</summary>

```typescript
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k; // Otimização

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}
```

</details>

---

## Exercício 2.2: Calculadora de Preço de Apostas

**Tarefa:** Calcule o preço de qualquer tamanho de aposta.

```typescript
// Dado BET_PRICES de lib/constants.ts
export const BET_PRICES: Record<number, number> = {
  6: 6.0,
  7: 42.0,
  // ...
};

function calculateBetPrice(numberCount: number): number {
  // 1. Pegue o preço base (6 números = R$6)
  // 2. Calcule C(numberCount, 6)
  // 3. Retorne preço base × combinações
}
```

**Verifique:** `calculateBetPrice(15)` deve retornar `30030.0`

<details>
<summary>Solução</summary>

```typescript
const BASE_PRICE = 6.0;

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

function calculateBetPrice(numberCount: number): number {
  const combos = combinations(numberCount, 6);
  return combos * BASE_PRICE;
}

// calculateBetPrice(15) = 5005 × 6 = 30030 ✓
```

</details>

---

## Exercício 2.3: Análise de Valor Esperado

**Tarefa:** Calcule se uma aposta é matematicamente lucrativa.

Dados:
- Custo da aposta: R$6,00
- Prêmio médio da Sena: R$5.000.000
- Probabilidade de ganhar: 1/50.063.860

```typescript
function expectedValue(cost: number, prize: number, probability: number): number {
  // Valor esperado = (prêmio × probabilidade) - custo
  // Retorne o lucro/perda esperado por aposta
}
```

**Pergunta:** Um valor esperado positivo é possível?

<details>
<summary>Solução e Análise</summary>

```typescript
function expectedValue(cost: number, prize: number, probability: number): number {
  return (prize * probability) - cost;
}

// Para Mega-Sena:
const ev = expectedValue(
  6.0,
  5_000_000,
  1 / 50_063_860
);
// ≈ -5,90 (você perde R$5,90 por cada aposta de R$6)
```

**Conclusão:** Apostas de loteria sempre têm valor esperado negativo. A casa (CAIXA) lucra matematicamente garantido.

**Curiosidade:** Mesmo com prêmio mínimo (R$1.000.000), o EV é fortemente negativo.
</details>

---

## Aplicação no Mundo Real: Análise de Cobertura

Ao gerar múltiplas apostas, como maximizamos a cobertura de combinações únicas de 6 números?

**Exemplo:** Orçamento de R$126
- Opção A: 21 apostas simples (6 números cada) = 21 combinações cobertas
- Opção B: Uma aposta de 9 números = 84 combinações cobertas de uma vez

**Referência de código:** `lib/analytics/bet-generator.ts:157-268` implementa esta otimização usando programação dinâmica.

---

## Resumo do Capítulo 2

**Você aprendeu:**
- Fatoriais e como eles contam arranjos ordenados
- A diferença entre permutações e combinações
- A fórmula de combinação: C(n,k) = n! / (k! × (n-k)!)
- Por que preços de loteria crescem exponencialmente (C(k,6) × preço base)
- Triângulo de Pascal como ferramenta de visualização
- Como calcular probabilidades exatas de vitória
- Valor esperado e por que loterias são sempre proposições perdedoras

**Referências de código:**
- `lib/constants.ts:83-99` - Contagens de combinações pré-computadas
- `lib/analytics/bet-generator.ts:157-268` - Otimização de orçamento usando combinatória

**Insight chave:** Toda vez que você adiciona um número à sua aposta, não está pagando 1x mais - está pagando (k/6)x mais porque está cobrindo mais combinações de 6 números.

---

## Leitura Complementar

- [Khan Academy: Combinatória](https://www.khanacademy.org/math/precalculus/x9e81a4f98389efdf:combinatorics)
- [Visualizando o Triângulo de Pascal](https://www.mathsisfun.com/pascals-triangle.html)
- [Matemática de loterias na Wikipedia](https://en.wikipedia.org/wiki/Lottery_mathematics)

---

**A seguir:** Capítulo 3 cobre Estatística - como analisamos dados históricos para encontrar padrões (enquanto lembramos que correlação não implica causalidade).
