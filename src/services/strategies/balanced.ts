import "server-only";

import type { PrismaClient } from "@prisma/client";

import { mulberry32, weightedPick } from "@/lib/random";
import { BETTING_LIMITS } from "@/services/strategy-limits";
import {
  buildMetadata,
  getNumbersInQuadrant,
} from "@/services/strategies/utils";
import {
  MEGASENA_MAX_DEZENA,
  MEGASENA_MIN_DEZENA,
  QUADRANT_RANGES,
  normalizeSeed,
  resolveK,
  type StrategyContext,
  type StrategyResult,
} from "@/services/strategies/types";
import { getFrequencies, getQuadrants } from "@/services/stats";

type FrequencyMap = Map<number, number>;

type SelectionState = {
  prng: ReturnType<typeof mulberry32>;
  frequencies: FrequencyMap;
  remainingByQuadrant: Map<number, Set<number>>;
  selectedByQuadrant: Map<number, number[]>;
  parityTargets: { even: number; odd: number };
  parityCount: { even: number; odd: number };
};

export async function balancedStrategy(
  context: StrategyContext,
): Promise<StrategyResult> {
  const seed = normalizeSeed(context.seed);
  const k = resolveK(context.k);
  const window = context.window;
  const client = context.client;

  const prng = mulberry32(seed);

  const { frequencies, totalDraws } = await loadFrequencyMap({
    window,
    client,
  });
  const quadrantsStats = await getQuadrants({ window, client });

  const targets = computeQuadrantTargets(quadrantsStats, k);
  const state = createSelectionState(prng, frequencies, targets);

  fillQuadrants(state, targets);

  const dezenas = finalizeSelection(state);

  const averageFrequency =
    dezenas.reduce(
      (sum, dezena) => sum + (state.frequencies.get(dezena) ?? 0),
      0,
    ) / dezenas.length;

  const metadata = buildMetadata(
    "balanced",
    seed,
    dezenas,
    {
      targets,
      totalDraws,
      averageFrequency,
    },
    averageFrequency,
  );

  return {
    dezenas,
    metadata,
  };
}

async function loadFrequencyMap({
  window,
  client,
}: {
  window?: number;
  client?: PrismaClient;
}): Promise<{ frequencies: FrequencyMap; totalDraws: number }> {
  const result = await getFrequencies({ window, client });
  const map: FrequencyMap = new Map();

  for (
    let dezena = MEGASENA_MIN_DEZENA;
    dezena <= MEGASENA_MAX_DEZENA;
    dezena += 1
  ) {
    map.set(dezena, 0);
  }

  for (const item of result.items) {
    map.set(item.dezena, item.frequency);
  }

  return { frequencies: map, totalDraws: result.totalDraws };
}

function computeQuadrantTargets(
  quadrants: { range: string; total: number }[],
  k: number,
): Record<string, number> {
  const base = Math.floor(k / QUADRANT_RANGES.length);
  const remainder = k % QUADRANT_RANGES.length;

  const totals = quadrants.map((q) => q.total);
  const sortedIndices = totals
    .map((total, index) => ({ index, total }))
    .sort((a, b) => b.total - a.total)
    .map((item) => item.index);

  const targets: Record<string, number> = {};

  QUADRANT_RANGES.forEach((quadrant) => {
    targets[quadrant.name] = base;
    if (base === 0) {
      targets[quadrant.name] = 0;
    }
  });

  for (let i = 0; i < remainder; i += 1) {
    const quadrantIndex = sortedIndices[i] ?? i;
    const name = QUADRANT_RANGES[quadrantIndex]?.name;
    if (name) {
      targets[name] = (targets[name] ?? 0) + 1;
      targets[name] = Math.min(targets[name], 10);
    }
  }

  // Garantir que cada quadrante tenha ao menos 1 dezena quando possível (k >= 6)
  if (k >= QUADRANT_RANGES.length) {
    QUADRANT_RANGES.forEach((quadrant) => {
      targets[quadrant.name] = Math.max(targets[quadrant.name] ?? 0, 1);
    });

    let currentTotal = Object.values(targets).reduce(
      (sum, value) => sum + value,
      0,
    );

    const order = [...sortedIndices, ...sortedIndices];
    let cursor = 0;
    while (currentTotal < k) {
      const quadrantIndex = order[cursor % order.length];
      const quadrantName = QUADRANT_RANGES[quadrantIndex]?.name;
      if (quadrantName) {
        targets[quadrantName] += 1;
        targets[quadrantName] = Math.min(targets[quadrantName], 10);
        currentTotal += 1;
      }
      cursor += 1;
    }
  }

  return targets;
}

function createSelectionState(
  prng: ReturnType<typeof mulberry32>,
  frequencies: FrequencyMap,
  targets: Record<string, number>,
): SelectionState {
  const remainingByQuadrant = new Map<number, Set<number>>();
  const selectedByQuadrant = new Map<number, number[]>();

  QUADRANT_RANGES.forEach((range, index) => {
    remainingByQuadrant.set(index, new Set(getNumbersInQuadrant(index)));
    selectedByQuadrant.set(index, []);
    const target = targets[range.name] ?? 0;
    if (target > BETTING_LIMITS.maxTicketsPerBatch) {
      throw new Error("Alvo de quadrante inválido");
    }
  });

  const k = Object.values(targets).reduce((sum, value) => sum + value, 0);
  const targetEven = Math.ceil(k / 2);
  const targetOdd = k - targetEven;

  return {
    prng,
    frequencies,
    remainingByQuadrant,
    selectedByQuadrant,
    parityTargets: { even: targetEven, odd: targetOdd },
    parityCount: { even: 0, odd: 0 },
  };
}

function fillQuadrants(
  state: SelectionState,
  targets: Record<string, number>,
): void {
  QUADRANT_RANGES.forEach((quadrant, index) => {
    const target = targets[quadrant.name] ?? 0;
    for (let i = 0; i < target; i += 1) {
      const value = pickNumberForQuadrant(state, index);
      pushSelection(state, index, value);
    }
  });
}

function pickNumberForQuadrant(
  state: SelectionState,
  quadrantIndex: number,
): number {
  const remaining = state.remainingByQuadrant.get(quadrantIndex);
  if (!remaining || remaining.size === 0) {
    throw new Error(
      `Sem dezenas disponíveis para o quadrante ${quadrantIndex}`,
    );
  }

  const available = Array.from(remaining);
  const parity = decideParity(state);
  const parityCandidates = available.filter((value) => value % 2 === parity);
  const candidates = parityCandidates.length > 0 ? parityCandidates : available;

  const weights = candidates.map(
    (value) => (state.frequencies.get(value) ?? 0) + 1,
  );

  return weightedPick(candidates, weights, state.prng);
}

function decideParity(state: SelectionState): 0 | 1 {
  if (state.parityCount.even >= state.parityTargets.even) {
    return 1;
  }
  if (state.parityCount.odd >= state.parityTargets.odd) {
    return 0;
  }
  return state.prng() < 0.5 ? 0 : 1;
}

function pushSelection(
  state: SelectionState,
  quadrantIndex: number,
  value: number,
): void {
  const remaining = state.remainingByQuadrant.get(quadrantIndex);
  const selected = state.selectedByQuadrant.get(quadrantIndex);

  if (!remaining || !selected) {
    throw new Error(`Quadrante inválido: ${quadrantIndex}`);
  }

  if (!remaining.has(value)) {
    throw new Error(
      `Dezena ${value} já selecionada para o quadrante ${quadrantIndex}`,
    );
  }

  remaining.delete(value);
  selected.push(value);

  if (value % 2 === 0) {
    state.parityCount.even += 1;
  } else {
    state.parityCount.odd += 1;
  }
}

function finalizeSelection(state: SelectionState): number[] {
  const dezenas = Array.from(state.selectedByQuadrant.values()).flat();
  dezenas.sort((a, b) => a - b);
  return dezenas;
}
