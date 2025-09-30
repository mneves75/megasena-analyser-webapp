import { logger } from "@/lib/logger";

type MetricPayload = Record<string, unknown>;

export function reportMetric(name: string, payload: MetricPayload) {
  logger.info({ metric: name, ...payload }, "Metric event");
}
