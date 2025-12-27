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

/**
 * Candidate pool for strategy-based number selection
 * Pre-fetched once per generation session for efficiency
 */
interface CandidatePool {
  hot: number[];
  cold: number[];
  all: number[];
}

export class BetGenerator {
  private db: ReturnType<typeof getDatabase>;
  private static readonly MAX_DEDUP_ATTEMPTS = 50;
  private static readonly STRATEGY_POOL_SIZE = 30; // Top 30 hot/cold numbers
  private static readonly FALLBACK_THRESHOLD = 10; // Fallback to random after N failed attempts

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Creates a canonical signature for a bet's numbers (for deduplication)
   * Sorted numbers joined by hyphen ensures consistent comparison
   */
  private getBetSignature(numbers: number[]): string {
    return [...numbers].sort((a, b) => a - b).join('-');
  }

  /**
   * Pre-fetches candidate pools for hot/cold number strategies
   * Called once per generation session for efficiency
   */
  private fetchCandidatePools(): CandidatePool {
    const hot = this.db
      .prepare(
        `SELECT number FROM number_frequency
         ORDER BY frequency DESC
         LIMIT ?`
      )
      .all(BetGenerator.STRATEGY_POOL_SIZE) as Array<{ number: number }>;

    const cold = this.db
      .prepare(
        `SELECT number FROM number_frequency
         ORDER BY frequency ASC
         LIMIT ?`
      )
      .all(BetGenerator.STRATEGY_POOL_SIZE) as Array<{ number: number }>;

    // All numbers 1-60
    const all = Array.from({ length: MEGASENA_CONSTANTS.MAX_NUMBER }, (_, i) => i + 1);

    return {
      hot: hot.map(h => h.number),
      cold: cold.map(c => c.number),
      all,
    };
  }

  /**
   * Fisher-Yates shuffle - returns a new shuffled array
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
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
      throw new Error(`Orcamento insuficiente. Minimo: R$ ${simpleBetCost.toFixed(2)}`);
    }

    // Pre-fetch candidate pools once for this generation session
    const pools = this.fetchCandidatePools();

    let bets: Bet[] = [];

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

    const totalCost = bets.reduce((sum, bet) => sum + bet.cost, 0);
    const remainingBudget = budget - totalCost;
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
   * Ensures no duplicate bets are generated
   */
  private generateSimpleBets(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    const simpleBetCost = BET_PRICES[6];
    const maxBets = Math.floor(budget / simpleBetCost);
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

  /**
   * Generates the largest possible multiple bet within budget
   */
  private generateLargestMultipleBet(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    let selectedNumberCount = 6;

    // Find the largest multiple bet within budget (up to 15 numbers)
    for (let count = 15; count >= 6; count--) {
      if (BET_PRICES[count] && BET_PRICES[count] <= budget) {
        selectedNumberCount = count;
        break;
      }
    }

    const seenSignatures = new Set<string>();
    const numbers = this.generateUniqueBet(selectedNumberCount, strategy, pools, seenSignatures);

    if (!numbers) {
      // Fallback to pure random if strategy failed
      return [{
        id: this.generateBetId(),
        numbers: this.selectRandomFromPool(pools.all, selectedNumberCount),
        cost: BET_PRICES[selectedNumberCount],
        type: selectedNumberCount > 6 ? 'multiple' : 'simple',
        numberCount: selectedNumberCount,
        strategy: `multiple_${strategy}_fallback`,
      }];
    }

    return [{
      id: this.generateBetId(),
      numbers,
      cost: BET_PRICES[selectedNumberCount],
      type: selectedNumberCount > 6 ? 'multiple' : 'simple',
      numberCount: selectedNumberCount,
      strategy: `multiple_${strategy}`,
    }];
  }

  /**
   * Generates a balanced mix of simple and multiple bets
   * Ensures no duplicate bets are generated
   */
  private generateMixedBets(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    const bets: Bet[] = [];
    const seenSignatures = new Set<string>();
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
        const numbers = this.generateUniqueBet(bestMultipleSize, strategy, pools, seenSignatures);
        if (numbers) {
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
    }

    // Fill remaining budget with simple bets (deduplicated)
    const maxSimpleBets = Math.floor(remainingBudget / simpleBetCost);
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

  /**
   * Optimized algorithm that minimizes budget waste
   * Uses greedy approach to find best combination
   * Ensures no duplicate bets are generated
   *
   * CRITICAL: Only deducts budget when bet is successfully added
   */
  private generateOptimizedMix(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    const bets: Bet[] = [];
    const seenSignatures = new Set<string>();
    let remainingBudget = budget;
    let consecutiveFailures = 0;

    // Get all available bet sizes sorted by price
    const availableBets = Object.entries(BET_PRICES)
      .filter(([_, price]) => price <= budget)
      .map(([numbers, price]) => ({
        numberCount: parseInt(numbers),
        price,
      }))
      .sort((a, b) => a.price - b.price);

    // Greedy approach to minimize waste
    while (remainingBudget >= BET_PRICES[6] && consecutiveFailures < 3) {
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

      // Generate unique bet
      const numbers = this.generateUniqueBet(bestBet.numberCount, strategy, pools, seenSignatures);

      if (numbers) {
        bets.push({
          id: this.generateBetId(),
          numbers,
          cost: bestBet.price,
          type: bestBet.numberCount > 6 ? 'multiple' : 'simple',
          numberCount: bestBet.numberCount,
          strategy: bestBet.numberCount > 6 ? `multiple_${strategy}` : strategy,
        });
        // CRITICAL: Only deduct budget when bet is actually added
        remainingBudget -= bestBet.price;
        consecutiveFailures = 0;
      } else {
        // Could not generate unique bet - try smaller bet or exit
        consecutiveFailures++;
        // Exit after 2 failures to prevent infinite loop without wasting budget
        if (consecutiveFailures >= 2) {
          break;
        }
      }
    }

    return bets;
  }

  /**
   * Generates a unique bet that hasn't been seen before
   * Uses strategy-based selection with fallback to random
   * Returns null if unable to generate unique bet after max attempts
   */
  private generateUniqueBet(
    count: number,
    strategy: BetStrategy,
    pools: CandidatePool,
    seenSignatures: Set<string>
  ): number[] | null {
    let attempts = 0;
    let useFallback = false;

    while (attempts < BetGenerator.MAX_DEDUP_ATTEMPTS) {
      // After FALLBACK_THRESHOLD attempts, switch to pure random
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

    // Last resort: pure random with guaranteed uniqueness attempt
    for (let i = 0; i < 10; i++) {
      const numbers = this.selectRandomFromPool(pools.all, count);
      const signature = this.getBetSignature(numbers);
      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        return numbers.sort((a, b) => a - b);
      }
    }

    return null; // Could not generate unique bet
  }

  /**
   * Generates numbers from pre-fetched pools based on strategy
   * No database queries - uses cached pools
   */
  private generateNumberSetFromPools(count: number, strategy: BetStrategy, pools: CandidatePool): number[] {
    switch (strategy) {
      case 'hot_numbers':
        return this.selectFromHotPool(count, pools);
      case 'cold_numbers':
        return this.selectFromColdPool(count, pools);
      case 'balanced':
        return this.selectBalancedFromPools(count, pools);
      case 'fibonacci':
        return this.generateFibonacciNumbers(count);
      default:
        return this.selectRandomFromPool(pools.all, count);
    }
  }

  /**
   * Selects numbers from hot pool (deterministic - top N hottest)
   */
  private selectFromHotPool(count: number, pools: CandidatePool): number[] {
    // Take top N hot numbers deterministically (already sorted by frequency DESC)
    const selected = pools.hot.slice(0, Math.min(count, pools.hot.length));

    // If hot pool doesn't have enough, fill with random
    if (selected.length < count) {
      const remaining = pools.all.filter(n => !selected.includes(n));
      const shuffledRemaining = this.shuffle(remaining);
      selected.push(...shuffledRemaining.slice(0, count - selected.length));
    }

    return selected;
  }

  /**
   * Selects numbers from cold pool (deterministic - top N coldest)
   */
  private selectFromColdPool(count: number, pools: CandidatePool): number[] {
    // Take top N cold numbers deterministically (already sorted by frequency ASC)
    const selected = pools.cold.slice(0, Math.min(count, pools.cold.length));

    if (selected.length < count) {
      const remaining = pools.all.filter(n => !selected.includes(n));
      const shuffledRemaining = this.shuffle(remaining);
      selected.push(...shuffledRemaining.slice(0, count - selected.length));
    }

    return selected;
  }

  /**
   * Selects balanced mix of hot and cold numbers
   */
  private selectBalancedFromPools(count: number, pools: CandidatePool): number[] {
    const hotCount = Math.ceil(count * BET_ALLOCATION.BALANCED_HOT_PERCENTAGE);
    const coldCount = count - hotCount;

    const shuffledHot = this.shuffle(pools.hot);
    const shuffledCold = this.shuffle(pools.cold);

    const selected = new Set<number>();

    // Add hot numbers
    for (const num of shuffledHot) {
      if (selected.size >= hotCount) break;
      selected.add(num);
    }

    // Add cold numbers (avoiding duplicates)
    for (const num of shuffledCold) {
      if (selected.size >= count) break;
      if (!selected.has(num)) {
        selected.add(num);
      }
    }

    // Fill remaining with random if needed
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

  /**
   * Selects random numbers from any pool
   */
  private selectRandomFromPool(pool: number[], count: number): number[] {
    const shuffled = this.shuffle(pool);
    return shuffled.slice(0, count);
  }

  private generateBetId(): string {
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

  private generateFibonacciNumbers(count: number): number[] {
    // Generate Fibonacci sequence up to 60
    const fibonacci: number[] = [1, 2];

    while (fibonacci[fibonacci.length - 1] < MEGASENA_CONSTANTS.MAX_NUMBER) {
      const next = fibonacci[fibonacci.length - 1] + fibonacci[fibonacci.length - 2];
      if (next <= MEGASENA_CONSTANTS.MAX_NUMBER) {
        fibonacci.push(next);
      } else {
        break;
      }
    }

    // Shuffle and select from Fibonacci numbers
    const shuffled = this.shuffle(fibonacci);
    const selected = shuffled.slice(0, Math.min(count, fibonacci.length));

    // Fill remaining with random numbers if needed
    if (selected.length < count) {
      const remaining = Array.from({ length: MEGASENA_CONSTANTS.MAX_NUMBER }, (_, i) => i + 1)
        .filter(n => !selected.includes(n));
      const shuffledRemaining = this.shuffle(remaining);
      selected.push(...shuffledRemaining.slice(0, count - selected.length));
    }

    return selected;
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
