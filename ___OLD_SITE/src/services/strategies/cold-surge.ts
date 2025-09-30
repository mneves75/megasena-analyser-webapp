import "server-only";

import { mulberry32, weightedPick } from "@/lib/random";
import { DEFAULT_BETTING_LIMITS } from "@/services/strategy-limits";
import { getRecency } from "@/services/stats";
import {
  MEGASENA_MAX_DEZENA,
  MEGASENA_MIN_DEZENA,
  normalizeSeed,
  resolveKWithLimits,
  type StrategyContext,
  type StrategyResult,
} from "@/services/strategies/types";
import { buildMetadata } from "@/services/strategies/utils";

const NULL_RECENCY_REWARD = 50; // incentivo alto para dezenas nunca vistas na base.
const MIN_RECENCY_WEIGHT = 1;

/**
 * Estratégia "cold-surge": favorece dezenas "frias" (mais tempo sem aparecer).
 * Converte o atraso em pesos positivos e incentiva diversidade removendo itens após seleção.
 */
export async function coldSurgeStrategy(
  context: StrategyContext,
): Promise<StrategyResult> {
  const seed = normalizeSeed(context.seed);
  const limits = context.limits ?? DEFAULT_BETTING_LIMITS;
  const k = resolveKWithLimits(context.k, limits);

  const prng = mulberry32(`${seed}:cold`);

  const recency = await getRecency({ client: context.client });
  const recencyMap = new Map<number, number | null>();
  recency.forEach((entry) => {
    recencyMap.set(entry.dezena, entry.contestsSinceLast);
  });

  const pool: number[] = [];
  const weights: number[] = [];

  for (
    let dezena = MEGASENA_MIN_DEZENA;
    dezena <= MEGASENA_MAX_DEZENA;
    dezena += 1
  ) {
    pool.push(dezena);
    const contestsSinceLast = recencyMap.has(dezena)
      ? (recencyMap.get(dezena) ?? null)
      : null;
    const weight =
      contestsSinceLast === null
        ? NULL_RECENCY_REWARD
        : Math.max(contestsSinceLast, MIN_RECENCY_WEIGHT);
    weights.push(weight);
  }

  const dezenas: number[] = [];
  const mutablePool = [...pool];
  const mutableWeights = [...weights];

  for (let selection = 0; selection < k; selection += 1) {
    const picked = weightedPick(mutablePool, mutableWeights, prng);
    dezenas.push(picked);

    const index = mutablePool.indexOf(picked);
    if (index >= 0) {
      mutablePool.splice(index, 1);
      mutableWeights.splice(index, 1);
    }

    if (mutablePool.length === 0) {
      break;
    }
  }

  dezenas.sort((a, b) => a - b);

  const recencySample = dezenas.map((dezena) => {
    const value = recencyMap.has(dezena)
      ? (recencyMap.get(dezena) ?? null)
      : null;
    return {
      dezena,
      contestsSinceLast: value,
      weight:
        value === null
          ? NULL_RECENCY_REWARD
          : Math.max(value, MIN_RECENCY_WEIGHT),
    };
  });

  const averageDelay =
    recencySample.reduce(
      (sum, item) => sum + (item.contestsSinceLast ?? NULL_RECENCY_REWARD),
      0,
    ) / recencySample.length;

  return {
    dezenas,
    metadata: buildMetadata(
      "cold-surge",
      seed,
      dezenas,
      {
        averageDelay,
        recencySample,
      },
      averageDelay,
    ),
  };
}
