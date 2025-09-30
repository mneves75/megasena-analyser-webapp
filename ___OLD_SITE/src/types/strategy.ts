export type StrategyName = "uniform" | "balanced" | "hot-streak" | "cold-surge";

export type QuadrantRange = {
  name: string;
  start: number;
  end: number;
};

export type QuadrantDistribution = {
  range: QuadrantRange["name"];
  count: number;
};

export type ParityDistribution = {
  even: number;
  odd: number;
};

export type StrategyMetadata = {
  strategy: StrategyName;
  seed: string;
  k: number;
  sum: number;
  parity: ParityDistribution;
  quadrants: QuadrantDistribution[];
  score?: number;
  details?: Record<string, unknown>;
};
