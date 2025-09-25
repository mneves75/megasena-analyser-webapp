import type { StrategyName } from "@/types/strategy";

const STRATEGY_LABELS: Record<StrategyName, string> = {
  balanced: "Balanceada",
  uniform: "Uniforme",
  "hot-streak": "Sequência aquecida",
  "cold-surge": "Onda fria",
};

export function getStrategyLabel(value: string): string {
  return STRATEGY_LABELS[value as StrategyName] ?? value;
}

export const strategyLabels = STRATEGY_LABELS;
