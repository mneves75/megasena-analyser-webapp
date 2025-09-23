export const strategyPayloadSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://megasena.local/data-contracts/strategy_payload.schema.json",
  title: "StrategyPayload",
  type: "object",
  required: [
    "version",
    "seed",
    "requestedBudgetCents",
    "ticketCostCents",
    "totalCostCents",
    "leftoverCents",
    "ticketsGenerated",
    "strategies",
    "metrics",
    "config",
  ],
  properties: {
    version: {
      type: "string",
      const: "1.0",
    },
    seed: {
      type: "string",
      minLength: 1,
    },
    requestedBudgetCents: {
      type: "integer",
      minimum: 0,
    },
    ticketCostCents: {
      type: "integer",
      minimum: 0,
    },
    totalCostCents: {
      type: "integer",
      minimum: 0,
    },
    leftoverCents: {
      type: "integer",
      minimum: 0,
    },
    ticketsGenerated: {
      type: "integer",
      minimum: 0,
    },
    strategies: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "weight", "generated", "attempts", "failures"],
        properties: {
          name: { type: "string" },
          weight: { type: "number", minimum: 0 },
          generated: { type: "integer", minimum: 0 },
          attempts: { type: "integer", minimum: 0 },
          failures: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
    metrics: {
      type: "object",
      required: [
        "averageSum",
        "averageScore",
        "paritySpread",
        "quadrantCoverage",
      ],
      properties: {
        averageSum: { type: "number" },
        averageScore: { type: "number" },
        paritySpread: { type: "number" },
        quadrantCoverage: {
          type: "object",
          required: ["min", "max", "average"],
          properties: {
            min: { type: "number" },
            max: { type: "number" },
            average: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    config: {
      type: "object",
      required: ["strategies", "k", "timeoutMs"],
      properties: {
        strategies: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              weight: { type: "number" },
              window: { type: "integer" },
            },
            additionalProperties: false,
          },
        },
        k: { type: "integer", minimum: 6, maximum: 15 },
        window: { type: "integer", minimum: 1 },
        timeoutMs: { type: "integer", minimum: 1 },
      },
      additionalProperties: false,
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    ticket: {
      type: "object",
      required: ["strategy", "metadata", "seed", "costCents"],
      properties: {
        strategy: { type: "string" },
        seed: { type: "string" },
        costCents: { type: "integer", minimum: 0 },
        metadata: {
          type: "object",
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;

export type StrategyPayloadSchema = typeof strategyPayloadSchema;
