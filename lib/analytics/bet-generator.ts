import { getDatabase } from '@/lib/db';
import { MEGASENA_CONSTANTS, BET_PRICES, BET_GENERATION_MODE, BET_ALLOCATION, type BetGenerationMode } from '@/lib/constants';

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
  budgetUtilization: number | null; // percentage
  totalNumbers: number; // unique numbers covered
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

export class BetGenerator {
  private db: ReturnType<typeof getDatabase>;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Generates optimized bets based on budget and mode
   * Minimizes budget waste by using intelligent combination of simple and multiple bets
   */
  generateOptimizedBets(
    budget: number,
    mode: BetGenerationMode = BET_GENERATION_MODE.OPTIMIZED,
    strategy: BetStrategy = 'balanced'
  ): BetGenerationResult {
    const simpleBetCost = BET_PRICES[6];

    if (budget < simpleBetCost) {
      throw new Error(`Orçamento insuficiente. Mínimo: R$ ${simpleBetCost.toFixed(2)}`);
    }

    let bets: Bet[] = [];
    let remainingBudget = budget;

    switch (mode) {
      case BET_GENERATION_MODE.SIMPLE_ONLY:
        bets = this.generateSimpleBets(remainingBudget, strategy);
        break;
      case BET_GENERATION_MODE.MULTIPLE_ONLY:
        bets = this.generateLargestMultipleBet(remainingBudget, strategy);
        break;
      case BET_GENERATION_MODE.MIXED:
        bets = this.generateMixedBets(remainingBudget, strategy);
        break;
      case BET_GENERATION_MODE.OPTIMIZED:
      default:
        bets = this.generateOptimizedMix(remainingBudget, strategy);
        break;
    }

    const totalCost = bets.reduce((sum, bet) => sum + bet.cost, 0);
    remainingBudget = budget - totalCost;
    const budgetUtilization = (totalCost / budget) * 100;

    // Calculate unique numbers covered
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

  /**
   * Generates only simple bets (6 numbers each)
   */
  private generateSimpleBets(budget: number, strategy: BetStrategy): Bet[] {
    const simpleBetCost = BET_PRICES[6];
    const numberOfBets = Math.floor(budget / simpleBetCost);
    const bets: Bet[] = [];

    for (let i = 0; i < numberOfBets; i++) {
      const numbers = this.generateNumberSet(6, strategy);
      bets.push({
        id: this.generateBetId(),
        numbers,
        cost: simpleBetCost,
        type: 'simple',
        numberCount: 6,
        strategy,
      });
    }

    return bets;
  }

  /**
   * Generates the largest possible multiple bet within budget
   */
  private generateLargestMultipleBet(budget: number, strategy: BetStrategy): Bet[] {
    let selectedNumberCount = 6;

    // Find the largest multiple bet within budget (up to 15 numbers)
    for (let count = 15; count >= 6; count--) {
      if (BET_PRICES[count] && BET_PRICES[count] <= budget) {
        selectedNumberCount = count;
        break;
      }
    }

    const numbers = this.generateNumberSet(selectedNumberCount, strategy);
    const cost = BET_PRICES[selectedNumberCount];

    return [
      {
        id: this.generateBetId(),
        numbers,
        cost,
        type: selectedNumberCount > 6 ? 'multiple' : 'simple',
        numberCount: selectedNumberCount,
        strategy: `multiple_${strategy}`,
      },
    ];
  }

  /**
   * Generates a balanced mix of simple and multiple bets
   */
  private generateMixedBets(budget: number, strategy: BetStrategy): Bet[] {
    const bets: Bet[] = [];
    let remainingBudget = budget;
    const simpleBetCost = BET_PRICES[6];

    // Allocate percentage to multiple bets
    const multipleAllocation = budget * BET_ALLOCATION.MIXED_MULTIPLE_PERCENTAGE;

    // Generate one multiple bet
    if (multipleAllocation >= BET_PRICES[7]) {
      let bestMultipleSize = 6;
      for (let count = 15; count >= 7; count--) {
        if (BET_PRICES[count] && BET_PRICES[count] <= multipleAllocation) {
          bestMultipleSize = count;
          break;
        }
      }

      if (bestMultipleSize > 6) {
        const numbers = this.generateNumberSet(bestMultipleSize, strategy);
        bets.push({
          id: this.generateBetId(),
          numbers,
          cost: BET_PRICES[bestMultipleSize],
          type: 'multiple',
          numberCount: bestMultipleSize,
          strategy: `multiple_${strategy}`,
        });
        remainingBudget -= BET_PRICES[bestMultipleSize];
      }
    }

    // Fill remaining budget with simple bets
    const numberOfSimpleBets = Math.floor(remainingBudget / simpleBetCost);
    for (let i = 0; i < numberOfSimpleBets; i++) {
      const numbers = this.generateNumberSet(6, strategy);
      bets.push({
        id: this.generateBetId(),
        numbers,
        cost: simpleBetCost,
        type: 'simple',
        numberCount: 6,
        strategy,
      });
    }

    return bets;
  }

  /**
   * Optimized algorithm that minimizes budget waste
   * Uses dynamic programming approach to find best combination
   */
  private generateOptimizedMix(budget: number, strategy: BetStrategy): Bet[] {
    const bets: Bet[] = [];
    let remainingBudget = budget;

    // Get all available bet sizes sorted by efficiency (combinations per R$)
    const availableBets = Object.entries(BET_PRICES)
      .filter(([_, price]) => price <= budget)
      .map(([numbers, price]) => ({
        numberCount: parseInt(numbers),
        price,
      }))
      .sort((a, b) => a.price - b.price);

    // Greedy approach with backtracking to minimize waste
    while (remainingBudget >= BET_PRICES[6]) {
      let bestBet = null;
      let bestWaste = Infinity;

      // Find bet that minimizes future waste
      for (const bet of availableBets) {
        if (bet.price <= remainingBudget) {
          const futureWaste = (remainingBudget - bet.price) % BET_PRICES[6];
          if (futureWaste < bestWaste) {
            bestWaste = futureWaste;
            bestBet = bet;
          }
        }
      }

      if (!bestBet) break;

      const numbers = this.generateNumberSet(bestBet.numberCount, strategy);
      bets.push({
        id: this.generateBetId(),
        numbers,
        cost: bestBet.price,
        type: bestBet.numberCount > 6 ? 'multiple' : 'simple',
        numberCount: bestBet.numberCount,
        strategy: bestBet.numberCount > 6 ? `multiple_${strategy}` : strategy,
      });

      remainingBudget -= bestBet.price;
    }

    return bets;
  }

  private generateBetId(): string {
    // Use crypto.randomUUID() for guaranteed unique IDs
    // Available in both Node.js (v14.17.0+) and Bun
    return `bet_${crypto.randomUUID()}`;
  }

  /**
   * Legacy method - generates simple bets only
   * @deprecated Use generateOptimizedBets instead
   */
  generateBets(budget: number, strategy: BetStrategy = 'balanced'): BetGenerationResult {
    return this.generateOptimizedBets(budget, BET_GENERATION_MODE.SIMPLE_ONLY, strategy);
  }

  /**
   * Legacy method - generates largest multiple bet only
   * @deprecated Use generateOptimizedBets with MULTIPLE_ONLY mode instead
   */
  generateMultipleBet(budget: number, strategy: BetStrategy = 'balanced'): BetGenerationResult {
    return this.generateOptimizedBets(budget, BET_GENERATION_MODE.MULTIPLE_ONLY, strategy);
  }

  private generateSingleBet(strategy: BetStrategy): number[] {
    return this.generateNumberSet(6, strategy);
  }

  private generateNumberSet(count: number, strategy: BetStrategy): number[] {
    let numbers: number[] = [];

    switch (strategy) {
      case 'hot_numbers':
        numbers = this.generateHotNumbers(count);
        break;
      case 'cold_numbers':
        numbers = this.generateColdNumbers(count);
        break;
      case 'balanced':
        numbers = this.generateBalancedNumbers(count);
        break;
      case 'fibonacci':
        numbers = this.generateFibonacciNumbers(count);
        break;
      default:
        numbers = this.generateRandomNumbers(count);
    }

    return numbers.sort((a, b) => a - b);
  }

  private generateRandomNumbers(count: number): number[] {
    const numbers = new Set<number>();
    
    while (numbers.size < count) {
      const num = Math.floor(Math.random() * MEGASENA_CONSTANTS.MAX_NUMBER) + 1;
      numbers.add(num);
    }

    return Array.from(numbers);
  }

  private generateHotNumbers(count: number): number[] {
    const frequencies = this.db
      .prepare(
        'SELECT number FROM number_frequency ORDER BY frequency DESC, RANDOM() LIMIT ?'
      )
      .all(count) as Array<{ number: number }>;

    return frequencies.map((f) => f.number);
  }

  private generateColdNumbers(count: number): number[] {
    const frequencies = this.db
      .prepare(
        'SELECT number FROM number_frequency ORDER BY frequency ASC, RANDOM() LIMIT ?'
      )
      .all(count) as Array<{ number: number }>;

    return frequencies.map((f) => f.number);
  }

  private generateBalancedNumbers(count: number): number[] {
    // Mix of hot and cold numbers
    const hotCount = Math.ceil(count * BET_ALLOCATION.BALANCED_HOT_PERCENTAGE);
    const coldCount = count - hotCount;

    const hot = this.db
      .prepare(
        'SELECT number FROM number_frequency ORDER BY frequency DESC, RANDOM() LIMIT ?'
      )
      .all(hotCount) as Array<{ number: number }>;

    const cold = this.db
      .prepare(
        'SELECT number FROM number_frequency ORDER BY frequency ASC, RANDOM() LIMIT ?'
      )
      .all(coldCount) as Array<{ number: number }>;

    return [...hot.map((h) => h.number), ...cold.map((c) => c.number)];
  }

  private generateFibonacciNumbers(count: number): number[] {
    // Generate Fibonacci sequence up to 60
    const fibonacci: number[] = [1, 2];
    
    while (fibonacci[fibonacci.length - 1] < MEGASENA_CONSTANTS.MAX_NUMBER) {
      const next =
        fibonacci[fibonacci.length - 1] + fibonacci[fibonacci.length - 2];
      if (next <= MEGASENA_CONSTANTS.MAX_NUMBER) {
        fibonacci.push(next);
      } else {
        break;
      }
    }

    // Randomly select from Fibonacci numbers
    const selected = new Set<number>();
    const maxAttempts = count * 10; // Prevent infinite loops
    let attempts = 0;
    
    // Fill with Fibonacci numbers first (up to available count)
    while (selected.size < Math.min(count, fibonacci.length) && attempts < maxAttempts) {
      const idx = Math.floor(Math.random() * fibonacci.length);
      selected.add(fibonacci[idx]);
      attempts++;
    }

    // Fill remaining with random numbers if needed
    while (selected.size < count) {
      const num = Math.floor(Math.random() * MEGASENA_CONSTANTS.MAX_NUMBER) + 1;
      selected.add(num);
    }

    return Array.from(selected);
  }

  calculateBetCost(numberCount: number): number {
    return BET_PRICES[numberCount] || 0;
  }

  getAvailableMultipleBets(budget: number): Array<{ numbers: number; cost: number }> {
    const available: Array<{ numbers: number; cost: number }> = [];

    for (let count = 6; count <= MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE; count++) {
      const cost = BET_PRICES[count];
      if (cost && cost <= budget) {
        available.push({ numbers: count, cost });
      }
    }

    return available;
  }
}

