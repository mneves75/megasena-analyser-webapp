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

export class ComplexityScoreEngine {
  private primeSet: Set<number>;
  private expectedPrimeCount: number = 1.7; // Average primes per draw (17/60 * 6)
  private expectedSum: number = 183; // Average sum (1+2+...+60)/60 * 6 ≈ 183

  constructor() {
    this.primeSet = new Set(PRIME_NUMBERS);
  }

  calculateComplexityScore(numbers: number[]): ComplexityAnalysis {
    if (numbers.length !== 6) {
      throw new Error('Must provide exactly 6 numbers');
    }

    // Sort numbers for analysis
    const sorted = [...numbers].sort((a, b) => a - b);

    // 1. Consecutive pairs (+10 each)
    const consecutivePairs = this.countConsecutivePairs(sorted);
    const consecutiveScore = consecutivePairs * 10;

    // 2. Prime count deviation (+/- 5 per deviation)
    const primeCount = sorted.filter((n) => this.primeSet.has(n)).length;
    const primeDeviation = Math.abs(primeCount - this.expectedPrimeCount);
    const primeScore = primeDeviation * 5;

    // 3. Sum deviation from mean (+/- 10 per 10 units)
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const sumDeviation = Math.abs(sum - this.expectedSum);
    const sumScore = Math.floor(sumDeviation / 10) * 10;

    // 4. Decade diversity (6 different decades = +20)
    const uniqueDecades = this.countUniqueDecades(sorted);
    const decadeScore = uniqueDecades === 6 ? 20 : uniqueDecades === 5 ? 10 : 0;

    // 5. Parity balance (3-3 = 0, others add score)
    const evenCount = sorted.filter((n) => n % 2 === 0).length;
    const parityDeviation = Math.abs(evenCount - 3);
    const parityScore = parityDeviation * 3;

    // Total complexity score
    const totalScore = consecutiveScore + primeScore + sumScore + decadeScore + parityScore;

    // Categorize
    let category: ComplexityAnalysis['category'];
    let description: string;

    if (totalScore < 20) {
      category = 'simple';
      description = 'Padrão simples e comum';
    } else if (totalScore < 40) {
      category = 'typical';
      description = 'Padrão típico';
    } else if (totalScore < 60) {
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
    if (score < 20) return 'simple';
    if (score < 40) return 'typical';
    if (score < 60) return 'complex';
    return 'very-complex';
  }
}

