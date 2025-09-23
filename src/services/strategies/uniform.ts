import "server-only";

import { mulberry32, sampleUniqueIntegers } from "@/lib/random";
import { buildMetadata } from "@/services/strategies/utils";
import {
  MEGASENA_MAX_DEZENA,
  MEGASENA_MIN_DEZENA,
  normalizeSeed,
  resolveK,
  type StrategyContext,
  type StrategyResult,
} from "@/services/strategies/types";

export async function uniformStrategy(
  context: StrategyContext,
): Promise<StrategyResult> {
  const seed = normalizeSeed(context.seed);
  const k = resolveK(context.k);

  const prng = mulberry32(seed);
  const dezenas = sampleUniqueIntegers(prng, {
    min: MEGASENA_MIN_DEZENA,
    max: MEGASENA_MAX_DEZENA,
    count: k,
  });

  return {
    dezenas,
    metadata: buildMetadata("uniform", seed, dezenas, {
      source: "mulberry32",
    }),
  };
}
