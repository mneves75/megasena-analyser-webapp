import "server-only";

import { mulberry32, weightedPick } from "@/lib/random";
import { DEFAULT_BETTING_LIMITS } from "@/services/strategy-limits";
import { getFrequencies } from "@/services/stats";
import {
  MEGASENA_MAX_DEZENA,
  MEGASENA_MIN_DEZENA,
  normalizeSeed,
  resolveKWithLimits,
  type StrategyContext,
  type StrategyResult,
} from "@/services/strategies/types";
import { buildMetadata } from "@/services/strategies/utils";

const HOT_STREAK_DEFAULT_WINDOW = 120;
const MIN_FREQUENCY_WEIGHT = 0.0001;

/**
 * Estratégia "hot-streak": privilegia dezenas que apareceram com maior frequência
 * em uma janela recente. Ao remover itens selecionados a cada iteração, garantimos
 * amostragem sem reposição mantendo o peso relativo atualizado.
 */
export async function hotStreakStrategy(
  context: StrategyContext,
): Promise<StrategyResult> {
  const seed = normalizeSeed(context.seed);
  const limits = context.limits ?? DEFAULT_BETTING_LIMITS;
  const k = resolveKWithLimits(context.k, limits);
  const window = context.window ?? HOT_STREAK_DEFAULT_WINDOW;

  const prng = mulberry32(`${seed}:hot`);

  const frequencies = await getFrequencies({ window, client: context.client });
  const frequencyMap = new Map<number, number>();
  frequencies.items.forEach((item) => {
    frequencyMap.set(item.dezena, item.frequency);
  });

  const pool: number[] = [];
  const weights: number[] = [];

  for (
    let dezena = MEGASENA_MIN_DEZENA;
    dezena <= MEGASENA_MAX_DEZENA;
    dezena += 1
  ) {
    pool.push(dezena);
    const weight = frequencyMap.get(dezena) ?? 0;
    weights.push(weight > 0 ? weight : MIN_FREQUENCY_WEIGHT);
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

  const averageFrequency =
    dezenas.reduce((sum, dezena) => sum + (frequencyMap.get(dezena) ?? 0), 0) /
    dezenas.length;
  const topHits = [...dezenas]
    .sort((a, b) => (frequencyMap.get(b) ?? 0) - (frequencyMap.get(a) ?? 0))
    .slice(0, 3)
    .map((dezena) => ({
      dezena,
      frequency: frequencyMap.get(dezena) ?? 0,
    }));

  return {
    dezenas,
    metadata: buildMetadata(
      "hot-streak",
      seed,
      dezenas,
      {
        window,
        averageFrequency,
        topHits,
      },
      averageFrequency,
    ),
  };
}
