import { describe, it, expect, beforeEach, vi } from "vitest";

import type { BatchGenerationResult } from "@/services/bets";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const persistBatchMock = vi.fn();
const generateBatchMock = vi.fn();

vi.mock("@/services/bet-store", () => ({
  persistBatch: persistBatchMock,
}));

vi.mock("@/services/bets", () => {
  class MockBatchGenerationError extends Error {}
  return {
    BatchGenerationError: MockBatchGenerationError,
    generateBatch: generateBatchMock,
  };
});

const fakeResult: BatchGenerationResult = {
  tickets: [
    {
      strategy: "balanced",
      dezenas: [1, 2, 3, 4, 5, 6],
      metadata: {
        strategy: "balanced",
        seed: "derived-seed",
        k: 6,
        sum: 21,
        parity: { even: 3, odd: 3 },
        quadrants: [],
      },
      costCents: 600,
      seed: "derived-seed",
    },
  ],
  ticketCostCents: 600,
  averageTicketCostCents: 600,
  ticketCostBreakdown: [{ k: 6, costCents: 600, planned: 1, emitted: 1 }],
  totalCostCents: 600,
  budgetCents: 600,
  leftoverCents: 0,
  payload: {
    version: "1.0",
    seed: "primary-seed",
    requestedBudgetCents: 600,
    ticketCostCents: 600,
    averageTicketCostCents: 600,
    ticketCostBreakdown: [{ k: 6, costCents: 600, planned: 1, emitted: 1 }],
    totalCostCents: 600,
    leftoverCents: 0,
    ticketsGenerated: 1,
    strategies: [],
    metrics: {
      averageSum: 21,
      averageScore: 0,
      paritySpread: 0,
      quadrantCoverage: {
        min: 0,
        max: 0,
        average: 0,
      },
    },
    config: {
      strategies: [],
      k: 6,
      window: undefined,
      timeoutMs: 3000,
      spreadBudget: false,
    },
    warnings: [],
  },
  warnings: [],
};

let generateBetsAction: typeof import("../actions").generateBetsAction;

describe("generateBetsAction", () => {
  beforeEach(async () => {
    vi.resetModules();
    generateBatchMock.mockReset();
    persistBatchMock.mockReset();
    generateBatchMock.mockResolvedValue(fakeResult);
    persistBatchMock.mockResolvedValue(undefined);

    const actionsModule = await import("../actions");
    generateBetsAction = actionsModule.generateBetsAction;
  });

  it("inclui fallback uniforme quando a estratégia balanceada é selecionada", async () => {
    const form = new FormData();
    form.set("budgetCents", "600");
    form.set("seed", "primary-seed");
    form.set("strategy", "balanced");

    const result = await generateBetsAction(form);

    expect(result.success).toBe(true);
    expect(generateBatchMock).toHaveBeenCalledTimes(1);
    const callArgs = generateBatchMock.mock.calls[0][0];
    expect(callArgs.strategies).toEqual([
      { name: "balanced", weight: 1, window: undefined },
      { name: "uniform", weight: 1 },
    ]);
    expect(callArgs.spreadBudget).toBe(false);
    expect(persistBatchMock).toHaveBeenCalledWith(fakeResult);
  });

  it("não duplica fallback quando uniforme já é a estratégia primária", async () => {
    const form = new FormData();
    form.set("budgetCents", "600");
    form.set("seed", "primary-seed");
    form.set("strategy", "uniform");

    await generateBetsAction(form);

    const callArgs = generateBatchMock.mock.calls[0][0];
    expect(callArgs.strategies).toEqual([
      { name: "uniform", weight: 1, window: undefined },
    ]);
    expect(callArgs.spreadBudget).toBe(false);
  });
});
