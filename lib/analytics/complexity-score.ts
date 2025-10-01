import { PRIME_NUMBERS } from '@/lib/constants';

export interface ComplexityAnalysis {
  totalScore: number;
  breakdown: {
    consecutivePairs: { count: number; score: number };
    primeCount: { count: number; deviation: number; score: number };
    sumDeviation: { sum: number; deviation: number; score: number };
    decadeDiversity: { uniqueDecades: number; score: number };
    parityBalance: { evenCount: number; score: number };
  };
  category: 'simple' | 'typical' | 'complex' | 'very-complex';
  description: string;
}

// Scoring weights for complexity calculation
const COMPLEXITY_WEIGHTS = {
  CONSECUTIVE_PAIR: 10,
  PRIME_DEVIATION: 5,
  SUM_DEVIATION_UNIT: 10,
  SUM_DEVIATION_DIVISOR: 10,
  DECADE_DIVERSITY_FULL: 20,
  DECADE_DIVERSITY_PARTIAL: 10,
  PARITY_DEVIATION: 3,
} as const;

// Complexity score thresholds
const COMPLEXITY_THRESHOLDS = {
  SIMPLE: 20,
  TYPICAL: 40,
  COMPLEX: 60,
} as const;

export class ComplexityScoreEngine {
  private primeSet: Set<number>;
  // 17 primes in 1-60 range, expected in 6-number draw: (17/60) * 6 ≈ 1.7
  private readonly EXPECTED_PRIME_COUNT: number = (PRIME_NUMBERS.length / 60) * 6;
  // Average of 1-60 is 30.5, expected sum of 6 numbers: 30.5 * 6 = 183
  private readonly EXPECTED_SUM: number = ((1 + 60) / 2) * 6;

  constructor() {
    this.primeSet = new Set(PRIME_NUMBERS);
  }

  calculateComplexityScore(numbers: number[]): ComplexityAnalysis {
    if (numbers.length !== 6) {
      throw new Error('Must provide exactly 6 numbers');
    }

    // Sort numbers for analysis
    const sorted = [...numbers].sort((a, b) => a - b);

    // 1. Consecutive pairs (each pair adds points)
    const consecutivePairs = this.countConsecutivePairs(sorted);
    const consecutiveScore = consecutivePairs * COMPLEXITY_WEIGHTS.CONSECUTIVE_PAIR;

    // 2. Prime count deviation (further from expected = more complex)
    const primeCount = sorted.filter((n) => this.primeSet.has(n)).length;
    const primeDeviation = Math.abs(primeCount - this.EXPECTED_PRIME_COUNT);
    const primeScore = primeDeviation * COMPLEXITY_WEIGHTS.PRIME_DEVIATION;

    // 3. Sum deviation from mean (further from average = more complex)
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const sumDeviation = Math.abs(sum - this.EXPECTED_SUM);
    const sumScore = 
      Math.floor(sumDeviation / COMPLEXITY_WEIGHTS.SUM_DEVIATION_DIVISOR) * 
      COMPLEXITY_WEIGHTS.SUM_DEVIATION_UNIT;

    // 4. Decade diversity (spread across decades = more complex)
    const uniqueDecades = this.countUniqueDecades(sorted);
    const decadeScore = uniqueDecades === 6 
      ? COMPLEXITY_WEIGHTS.DECADE_DIVERSITY_FULL 
      : uniqueDecades === 5 
        ? COMPLEXITY_WEIGHTS.DECADE_DIVERSITY_PARTIAL 
        : 0;

    // 5. Parity balance (deviation from 3-3 split = more complex)
    const evenCount = sorted.filter((n) => n % 2 === 0).length;
    const parityDeviation = Math.abs(evenCount - 3);
    const parityScore = parityDeviation * COMPLEXITY_WEIGHTS.PARITY_DEVIATION;

    // Total complexity score
    const totalScore = consecutiveScore + primeScore + sumScore + decadeScore + parityScore;

    // Categorize based on defined thresholds
    let category: ComplexityAnalysis['category'];
    let description: string;

    if (totalScore < COMPLEXITY_THRESHOLDS.SIMPLE) {
      category = 'simple';
      description = 'Padrão simples e comum';
    } else if (totalScore < COMPLEXITY_THRESHOLDS.TYPICAL) {
      category = 'typical';
      description = 'Padrão típico';
    } else if (totalScore < COMPLEXITY_THRESHOLDS.COMPLEX) {
      category = 'complex';
      description = 'Padrão complexo';
    } else {
      category = 'very-complex';
      description = 'Padrão muito complexo';
    }

    return {
      totalScore,
      breakdown: {
        consecutivePairs: {
          count: consecutivePairs,
          score: consecutiveScore,
        },
        primeCount: {
          count: primeCount,
          deviation: Math.round(primeDeviation * 100) / 100,
          score: primeScore,
        },
        sumDeviation: {
          sum,
          deviation: Math.round(sumDeviation),
          score: sumScore,
        },
        decadeDiversity: {
          uniqueDecades,
          score: decadeScore,
        },
        parityBalance: {
          evenCount,
          score: parityScore,
        },
      },
      category,
      description,
    };
  }

  private countConsecutivePairs(sortedNumbers: number[]): number {
    let count = 0;
    for (let i = 0; i < sortedNumbers.length - 1; i++) {
      if (sortedNumbers[i + 1] === sortedNumbers[i] + 1) {
        count++;
      }
    }
    return count;
  }

  private countUniqueDecades(numbers: number[]): number {
    const decades = new Set<number>();
    for (const num of numbers) {
      const decade = Math.floor((num - 1) / 10);
      decades.add(decade);
    }
    return decades.size;
  }

  getComplexityCategory(score: number): ComplexityAnalysis['category'] {
    if (score < COMPLEXITY_THRESHOLDS.SIMPLE) return 'simple';
    if (score < COMPLEXITY_THRESHOLDS.TYPICAL) return 'typical';
    if (score < COMPLEXITY_THRESHOLDS.COMPLEX) return 'complex';
    return 'very-complex';
  }
}

