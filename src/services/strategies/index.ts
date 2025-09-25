export { uniformStrategy } from "@/services/strategies/uniform";
export { balancedStrategy } from "@/services/strategies/balanced";
export { hotStreakStrategy } from "@/services/strategies/hot-streak";
export { coldSurgeStrategy } from "@/services/strategies/cold-surge";
export type {
  StrategyContext,
  StrategyResult,
} from "@/services/strategies/types";
export type { StrategyMetadata, StrategyName } from "@/types/strategy";
