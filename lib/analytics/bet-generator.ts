import { getDatabase } from '@/lib/db';
import {
  MEGASENA_CONSTANTS,
  BET_PRICES,
  BET_GENERATION_MODE,
  BET_ALLOCATION,
  BET_GENERATION_LIMITS,
  type BetGenerationMode
} from '@/lib/constants';
import {
  type Bet,
  type BetGenerationResult,
  type BetStrategy,
} from '@/lib/analytics/bet-generator.types';

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
  private static readonly MAX_BETS_PER_GENERATION = BET_GENERATION_LIMITS.MAX_BETS_PER_GENERATION;
  private static readonly MIN_MULTIPLE_BET_NUMBERS = 7;

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

  private getBetCost(numberCount: number): number {
    const cost = BET_PRICES[numberCount];
    if (cost === undefined) {
      throw new Error(`Preço da aposta (${numberCount} números) não configurado.`);
    }
    return cost;
  }

  private toCents(value: number): number {
    return Math.round(value * 100);
  }

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

  private resolveCostUnitCents(): number {
    const costs = Object.values(BET_PRICES)
      .map((price) => this.toCents(price))
      .filter((price) => Number.isFinite(price) && price > 0);

    const first = costs[0];
    if (!first) {
      return this.toCents(this.getBetCost(6));
    }

    return costs.slice(1).reduce((acc, cost) => this.gcd(acc, cost), first);
  }

  private buildOptimizedBetSizes(budget: number): number[] {
    const costUnitCents = this.resolveCostUnitCents();
    const budgetUnits = Math.floor(this.toCents(budget) / costUnitCents);

    const options = Object.entries(BET_PRICES)
      .map(([numbers, price]) => {
        const numberCount = parseInt(numbers, 10);
        return {
          numberCount,
          costUnits: Math.round(this.toCents(price) / costUnitCents),
        };
      })
      .filter((option) =>
        option.numberCount >= MEGASENA_CONSTANTS.MIN_NUMBERS_MULTIPLE &&
        option.numberCount <= MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE &&
        option.costUnits > 0
      )
      .sort((a, b) => a.costUnits - b.costUnits);

    // DP over (coverage, cost) with the bet count as the MINIMIZED value rather
    // than a third dimension. Coverage must stay in the state because capping it
    // at 60 is what forces a plan like 3333 units to use 7 bets instead of the
    // 6-bet plan that only reaches 54 numbers.
    //
    // The value stored per cell is the lexicographic pair
    // (fewest bets, then most raw numbers), which is exactly the tie-break order
    // the final selection applies, so a per-cell optimum stays globally optimal.
    // Keeping bet count out of the state matters: the earlier (betCount,
    // coverage) -> Map<cost> formulation allocated ~106 MB of plan objects at the
    // R$20.000 cap, enough for a couple of concurrent requests to OOM the
    // 384 MB production container.
    const MAX_COVERAGE = MEGASENA_CONSTANTS.MAX_NUMBER;
    const MAX_BETS = BetGenerator.MAX_BETS_PER_GENERATION;
    const UNREACHABLE = -1;

    const width = budgetUnits + 1;
    const cellCount = (MAX_COVERAGE + 1) * width;
    const index = (coverage: number, cost: number): number => coverage * width + cost;

    // minBets fits Int16 (capped at 200); totalNumbers fits Int16 (<= 200 * 20).
    const minBets = new Int16Array(cellCount).fill(UNREACHABLE);
    const maxTotalNumbers = new Int16Array(cellCount).fill(UNREACHABLE);
    // Predecessor edge: the bet size chosen to enter this cell (0 = start cell).
    const chosenSize = new Uint8Array(cellCount);

    minBets[index(0, 0)] = 0;
    maxTotalNumbers[index(0, 0)] = 0;

    // Cost strictly increases on every transition (every option costs >= 1 unit),
    // so a single ascending pass over cost visits each cell after its predecessors.
    for (let cost = 0; cost <= budgetUnits; cost++) {
      for (let coverage = 0; coverage <= MAX_COVERAGE; coverage++) {
        const from = index(coverage, cost);
        const bets = minBets[from]!;
        if (bets === UNREACHABLE || bets >= MAX_BETS) {
          continue;
        }

        const totalNumbers = maxTotalNumbers[from]!;

        for (const option of options) {
          const nextCost = cost + option.costUnits;
          if (nextCost > budgetUnits) {
            // options are sorted by ascending cost, so nothing cheaper follows.
            break;
          }

          const nextTotalNumbers = totalNumbers + option.numberCount;
          const nextCoverage = Math.min(MAX_COVERAGE, nextTotalNumbers);
          const to = index(nextCoverage, nextCost);
          const nextBets = bets + 1;
          const currentBets = minBets[to]!;

          if (
            currentBets === UNREACHABLE ||
            nextBets < currentBets ||
            (nextBets === currentBets && nextTotalNumbers > maxTotalNumbers[to]!)
          ) {
            minBets[to] = nextBets;
            maxTotalNumbers[to] = nextTotalNumbers;
            chosenSize[to] = option.numberCount;
          }
        }
      }
    }

    let bestCoverage = -1;
    let bestCost = -1;

    for (let coverage = MAX_COVERAGE; coverage >= 0; coverage--) {
      for (let cost = budgetUnits; cost >= 0; cost--) {
        if (minBets[index(coverage, cost)]! > 0) {
          bestCoverage = coverage;
          bestCost = cost;
          break;
        }
      }
      if (bestCoverage >= 0) {
        break;
      }
    }

    if (bestCoverage < 0 || bestCost < 0) {
      return [];
    }

    const sizes: number[] = [];
    let coverage = bestCoverage;
    let cost = bestCost;
    let totalNumbers = maxTotalNumbers[index(coverage, cost)]!;

    while (cost > 0 || coverage > 0) {
      const size = chosenSize[index(coverage, cost)]!;
      if (size === 0) {
        break;
      }
      sizes.push(size);
      cost -= Math.round(this.toCents(this.getBetCost(size)) / costUnitCents);
      totalNumbers -= size;
      coverage = Math.min(MAX_COVERAGE, totalNumbers);
    }

    return sizes.reverse();
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
    const simpleBetCost = this.getBetCost(6);
    const minimumMultipleBetCost = this.getBetCost(BetGenerator.MIN_MULTIPLE_BET_NUMBERS);

    if (budget < simpleBetCost) {
      throw new Error(`Orçamento insuficiente. Mínimo: R$ ${simpleBetCost.toFixed(2)}`);
    }

    if (mode === BET_GENERATION_MODE.MULTIPLE_ONLY && budget < minimumMultipleBetCost) {
      throw new Error(
        `Orçamento insuficiente para aposta múltipla. Mínimo: R$ ${minimumMultipleBetCost.toFixed(2)}`
      );
    }

    if (mode === BET_GENERATION_MODE.OPTIMIZED && budget > BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET) {
      throw new Error(
        `Orçamento otimizado limitado a R$ ${BET_GENERATION_LIMITS.OPTIMIZED_MAX_BUDGET.toLocaleString(
          'pt-BR'
        )},00. Use outro modo para valores maiores.`
      );
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
    const simpleBetCost = this.getBetCost(6);
    const maxBets = Math.min(
      Math.floor(budget / simpleBetCost),
      BetGenerator.MAX_BETS_PER_GENERATION
    );
    const bets: Bet[] = [];
    const seenSignatures = new Set<string>();
    const usedNumbers = new Set<number>();

    for (let i = 0; i < maxBets; i++) {
      const bet = this.generateUniqueBet(6, strategy, pools, seenSignatures, usedNumbers);
      if (bet) {
        bets.push({
          id: this.generateBetId(),
          numbers: bet.numbers,
          cost: simpleBetCost,
          type: 'simple',
          numberCount: 6,
          strategy: this.labelFor(strategy, 6, bet.usedFallback),
        });
      }
    }

    return bets;
  }

  /**
   * Generates the largest possible multiple bet within budget
   */
  private generateLargestMultipleBet(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    let selectedNumberCount = BetGenerator.MIN_MULTIPLE_BET_NUMBERS;

    // Find the largest multiple bet within budget (up to 20 numbers)
    for (
      let count = MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE;
      count >= BetGenerator.MIN_MULTIPLE_BET_NUMBERS;
      count--
    ) {
      const cost = BET_PRICES[count];
      if (cost !== undefined && cost <= budget) {
        selectedNumberCount = count;
        break;
      }
    }

    const seenSignatures = new Set<string>();
    const usedNumbers = new Set<number>();
    const bet = this.generateUniqueBet(
      selectedNumberCount,
      strategy,
      pools,
      seenSignatures,
      usedNumbers
    );

    const selectedCost = this.getBetCost(selectedNumberCount);

    if (!bet) {
      // Fallback to pure random if strategy failed
      return [{
        id: this.generateBetId(),
        numbers: this.selectRandomFromPool(pools.all, selectedNumberCount).sort((a, b) => a - b),
        cost: selectedCost,
        type: 'multiple',
        numberCount: selectedNumberCount,
        strategy: `multiple_${strategy}_fallback`,
      }];
    }

    return [{
      id: this.generateBetId(),
      numbers: bet.numbers,
      cost: selectedCost,
      type: 'multiple',
      numberCount: selectedNumberCount,
      strategy: this.labelFor(strategy, selectedNumberCount, bet.usedFallback),
    }];
  }

  /**
   * Generates a balanced mix of simple and multiple bets
   * Ensures no duplicate bets are generated
   */
  private generateMixedBets(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    const bets: Bet[] = [];
    const seenSignatures = new Set<string>();
    const usedNumbers = new Set<number>();
    let remainingBudget = budget;
    const simpleBetCost = this.getBetCost(6);
    const minimumMultipleCost = this.getBetCost(7);

    // Allocate percentage to multiple bets
    const multipleAllocation = budget * BET_ALLOCATION.MIXED_MULTIPLE_PERCENTAGE;

    // Generate one multiple bet
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
        const bet = this.generateUniqueBet(
          bestMultipleSize,
          strategy,
          pools,
          seenSignatures,
          usedNumbers
        );
        if (bet) {
          bets.push({
            id: this.generateBetId(),
            numbers: bet.numbers,
            cost: bestMultipleCost,
            type: 'multiple',
            numberCount: bestMultipleSize,
            strategy: this.labelFor(strategy, bestMultipleSize, bet.usedFallback),
          });
          remainingBudget -= bestMultipleCost;
        }
      }
    }

    // Fill remaining budget with simple bets (deduplicated)
    const remainingSlots = Math.max(0, BetGenerator.MAX_BETS_PER_GENERATION - bets.length);
    const maxSimpleBets = Math.min(
      Math.floor(remainingBudget / simpleBetCost),
      remainingSlots
    );
    for (let i = 0; i < maxSimpleBets; i++) {
      const bet = this.generateUniqueBet(6, strategy, pools, seenSignatures, usedNumbers);
      if (bet) {
        bets.push({
          id: this.generateBetId(),
          numbers: bet.numbers,
          cost: simpleBetCost,
          type: 'simple',
          numberCount: 6,
          strategy: this.labelFor(strategy, 6, bet.usedFallback),
        });
      }
    }

    return bets;
  }

  /**
   * Optimized algorithm that minimizes budget waste and prioritizes coverage
   * Uses dynamic programming to choose bet sizes within budget and max bet limit
   * Ensures no duplicate bets are generated
   */
  private generateOptimizedMix(budget: number, strategy: BetStrategy, pools: CandidatePool): Bet[] {
    const bets: Bet[] = [];
    const seenSignatures = new Set<string>();
    // Shared across the plan so each bet prefers numbers the earlier ones did not
    // take, which is what turns the DP's planned coverage into real coverage.
    const usedNumbers = new Set<number>();
    const optimizedSizes = this.buildOptimizedBetSizes(budget);

    for (const numberCount of optimizedSizes) {
      const bet = this.generateUniqueBet(numberCount, strategy, pools, seenSignatures, usedNumbers);
      if (!bet) {
        continue;
      }
      const cost = this.getBetCost(numberCount);
      bets.push({
        id: this.generateBetId(),
        numbers: bet.numbers,
        cost,
        type: numberCount > 6 ? 'multiple' : 'simple',
        numberCount,
        strategy: this.labelFor(strategy, numberCount, bet.usedFallback),
      });
    }

    return bets;
  }

  /**
   * Splits `candidates` into numbers the session has not used yet and numbers it
   * has, shuffles each group, and takes `count` preferring the unused ones.
   *
   * This is what makes the optimizer's plan real: the DP picks bet sizes so that
   * the sizes sum past 60, but bets drawn independently repeat numbers heavily,
   * so a plan "covering 61 spots" used to return around 40 distinct numbers.
   */
  private pickPreferringUnused(
    candidates: number[],
    count: number,
    usedNumbers: Set<number>
  ): number[] {
    const unused: number[] = [];
    const used: number[] = [];

    for (const candidate of candidates) {
      (usedNumbers.has(candidate) ? used : unused).push(candidate);
    }

    return [...this.shuffle(unused), ...this.shuffle(used)].slice(0, count);
  }

  /**
   * Generates a unique bet that hasn't been seen before.
   *
   * Returns the numbers plus whether the strategic pool had to be abandoned, so
   * the caller can label the bet honestly instead of presenting a purely random
   * set as "hot numbers".
   */
  private generateUniqueBet(
    count: number,
    strategy: BetStrategy,
    pools: CandidatePool,
    seenSignatures: Set<string>,
    usedNumbers: Set<number>
  ): { numbers: number[]; usedFallback: boolean } | null {
    let attempts = 0;
    let useFallback = false;

    while (attempts < BetGenerator.MAX_DEDUP_ATTEMPTS) {
      // After FALLBACK_THRESHOLD attempts, switch to pure random
      if (attempts >= BetGenerator.FALLBACK_THRESHOLD) {
        useFallback = true;
      }

      const numbers = useFallback
        ? this.pickPreferringUnused(pools.all, count, usedNumbers)
        : this.generateNumberSetFromPools(count, strategy, pools, usedNumbers);

      const signature = this.getBetSignature(numbers);

      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        numbers.forEach((number) => usedNumbers.add(number));
        return { numbers: numbers.sort((a, b) => a - b), usedFallback: useFallback };
      }

      attempts++;
    }

    // Last resort: pure random with guaranteed uniqueness attempt
    for (let i = 0; i < 10; i++) {
      const numbers = this.pickPreferringUnused(pools.all, count, usedNumbers);
      const signature = this.getBetSignature(numbers);
      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        numbers.forEach((number) => usedNumbers.add(number));
        return { numbers: numbers.sort((a, b) => a - b), usedFallback: true };
      }
    }

    return null; // Could not generate unique bet
  }

  /** Appends `strategy` with the fallback marker the UI renders explicitly. */
  private labelFor(strategy: BetStrategy, numberCount: number, usedFallback: boolean): string {
    const base = numberCount > 6 ? `multiple_${strategy}` : `${strategy}`;
    return usedFallback ? `${base}_fallback` : base;
  }

  /**
   * Generates numbers from pre-fetched pools based on strategy
   * No database queries - uses cached pools
   */
  private generateNumberSetFromPools(
    count: number,
    strategy: BetStrategy,
    pools: CandidatePool,
    usedNumbers: Set<number>
  ): number[] {
    switch (strategy) {
      case 'hot_numbers':
        return this.selectFromRankedPool(count, pools.hot, pools.all, usedNumbers);
      case 'cold_numbers':
        return this.selectFromRankedPool(count, pools.cold, pools.all, usedNumbers);
      case 'balanced':
        return this.selectBalancedFromPools(count, pools, usedNumbers);
      case 'fibonacci':
        return this.generateFibonacciNumbers(count, usedNumbers);
      default:
        return this.pickPreferringUnused(pools.all, count, usedNumbers);
    }
  }

  /**
   * Selects `count` numbers from a frequency-ranked pool (hot or cold).
   *
   * The FIRST bet of a session takes the top N deterministically, which is the
   * most faithful answer to "the hottest numbers" for a single bet. Every later
   * bet samples from the same pool preferring numbers not yet used, because the
   * deterministic slice returns an identical set every time: the dedup loop then
   * burned its ten attempts and silently fell back to picking from all 60
   * numbers while the bet was still labelled hot or cold.
   */
  private selectFromRankedPool(
    count: number,
    rankedPool: number[],
    allNumbers: number[],
    usedNumbers: Set<number>
  ): number[] {
    if (usedNumbers.size === 0) {
      const selected = rankedPool.slice(0, Math.min(count, rankedPool.length));
      if (selected.length < count) {
        const remaining = allNumbers.filter((number) => !selected.includes(number));
        selected.push(...this.shuffle(remaining).slice(0, count - selected.length));
      }
      return selected;
    }

    const selected = this.pickPreferringUnused(rankedPool, count, usedNumbers);
    if (selected.length < count) {
      const chosen = new Set(selected);
      const remaining = allNumbers.filter((number) => !chosen.has(number));
      selected.push(
        ...this.pickPreferringUnused(remaining, count - selected.length, usedNumbers)
      );
    }

    return selected;
  }

  /**
   * Selects balanced mix of hot and cold numbers
   */
  private selectBalancedFromPools(
    count: number,
    pools: CandidatePool,
    usedNumbers: Set<number>
  ): number[] {
    const hotCount = Math.ceil(count * BET_ALLOCATION.BALANCED_HOT_PERCENTAGE);

    const selected = new Set<number>(this.pickPreferringUnused(pools.hot, hotCount, usedNumbers));

    for (const num of this.pickPreferringUnused(pools.cold, count, usedNumbers)) {
      if (selected.size >= count) break;
      selected.add(num);
    }

    // Fill remaining with numbers from anywhere, still preferring unused ones.
    if (selected.size < count) {
      const remaining = pools.all.filter((number) => !selected.has(number));
      for (const num of this.pickPreferringUnused(remaining, count - selected.size, usedNumbers)) {
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

  private generateFibonacciNumbers(count: number, usedNumbers: Set<number> = new Set()): number[] {
    // Generate Fibonacci sequence up to 60
    const fibonacci: number[] = [1, 2];

    while (fibonacci.length >= 2) {
      const last = fibonacci[fibonacci.length - 1];
      const previous = fibonacci[fibonacci.length - 2];
      if (last === undefined || previous === undefined) {
        break;
      }
      if (last >= MEGASENA_CONSTANTS.MAX_NUMBER) {
        break;
      }
      const next = last + previous;
      if (next <= MEGASENA_CONSTANTS.MAX_NUMBER) {
        fibonacci.push(next);
      } else {
        break;
      }
    }

    // Shuffle and select from Fibonacci numbers
    const shuffled = this.shuffle(fibonacci);
    const selected = shuffled.slice(0, Math.min(count, fibonacci.length));

    // Fill remaining with numbers outside the sequence, preferring unused ones so
    // successive bets in one plan keep widening the covered set.
    if (selected.length < count) {
      const remaining = Array.from({ length: MEGASENA_CONSTANTS.MAX_NUMBER }, (_, i) => i + 1)
        .filter(n => !selected.includes(n));
      selected.push(
        ...this.pickPreferringUnused(remaining, count - selected.length, usedNumbers)
      );
    }

    return selected;
  }

  calculateBetCost(numberCount: number): number {
    return BET_PRICES[numberCount] || 0;
  }

  getAvailableMultipleBets(budget: number): Array<{ numbers: number; cost: number }> {
    const available: Array<{ numbers: number; cost: number }> = [];

    for (
      let count = BetGenerator.MIN_MULTIPLE_BET_NUMBERS;
      count <= MEGASENA_CONSTANTS.MAX_NUMBERS_MULTIPLE;
      count++
    ) {
      const cost = BET_PRICES[count];
      if (cost && cost <= budget) {
        available.push({ numbers: count, cost });
      }
    }

    return available;
  }
}
