import "../../../scripts/dev/register-server-only-stub.js";

import { describe, expect, it, beforeEach, vi } from "vitest";

import type { StrategyMetadata } from "@/types/strategy";

const { balancedStrategyMock, uniformStrategyMock } = vi.hoisted(() => ({
  balancedStrategyMock: vi.fn(),
  uniformStrategyMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => {
  const noop = () => void 0;
  const logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  };

  return {
    logger,
    childLogger: () => logger,
  };
});

vi.mock("@/services/strategy-limits", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/strategy-limits")
  >("@/services/strategy-limits");
  return {
    ...actual,
    getBettingLimits: vi.fn().mockResolvedValue(actual.DEFAULT_BETTING_LIMITS),
  };
});

vi.mock("@/services/pricing", async () => {
  const actual =
    await vi.importActual<typeof import("@/services/pricing")>(
      "@/services/pricing",
    );
  return {
    ...actual,
    calculateBudgetAllocation: vi.fn(),
    calculateTicketCost: vi.fn().mockImplementation(async (k: number) => {
      return k <= 6 ? 600 : 1_200;
    }),
  };
});

vi.mock("@/services/strategies", async () => {
  const actual = await vi.importActual<typeof import("@/services/strategies")>(
    "@/services/strategies",
  );
  return {
    ...actual,
    balancedStrategy: balancedStrategyMock,
    uniformStrategy: uniformStrategyMock,
  };
});

import {
  calculateBudgetAllocation,
  calculateTicketCost,
} from "@/services/pricing";
import { generateBatch } from "@/services/bets";

function buildMetadata(
  strategy: "balanced" | "uniform",
  seed: string,
): StrategyMetadata {
  return {
    strategy,
    seed,
    k: 6,
    sum: 90,
    parity: { even: 3, odd: 3 },
    quadrants: [
      { range: "01-10", count: 1 },
      { range: "11-20", count: 1 },
      { range: "21-30", count: 1 },
      { range: "31-40", count: 1 },
      { range: "41-50", count: 1 },
      { range: "51-60", count: 1 },
    ],
  };
}

describe("generateBatch fallback", () => {
  beforeEach(() => {
    balancedStrategyMock.mockReset();
    uniformStrategyMock.mockReset();
    vi.mocked(calculateBudgetAllocation).mockReset();
    vi.mocked(calculateBudgetAllocation).mockResolvedValue({
      budgetCents: 600,
      ticketCostCents: 600,
      maxTickets: 1,
      leftoverCents: 0,
      constrainedByTicketLimit: false,
    });
    vi.mocked(calculateTicketCost).mockClear();
  });

  it("uses uniform strategy as fallback when primary strategy fails", async () => {
    balancedStrategyMock.mockRejectedValueOnce(new Error("balanced failed"));
    uniformStrategyMock.mockResolvedValueOnce({
      dezenas: [1, 2, 3, 4, 5, 6],
      metadata: buildMetadata("uniform", "seed:fallback"),
    });

    const result = await generateBatch({
      budgetCents: 600,
      seed: "seed",
      strategies: [{ name: "balanced", weight: 1 }],
    });

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0].strategy).toBe("uniform");
    expect(uniformStrategyMock).toHaveBeenCalled();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("fallback uniforme")]),
    );
  });

  it("calcula leftover real quando nenhuma aposta é gerada", async () => {
    vi.mocked(calculateBudgetAllocation).mockResolvedValueOnce({
      budgetCents: 600,
      ticketCostCents: 600,
      maxTickets: 1,
      leftoverCents: 0,
      constrainedByTicketLimit: false,
    });

    balancedStrategyMock.mockRejectedValue(new Error("balanced failed"));
    uniformStrategyMock.mockRejectedValue(new Error("uniform failed"));

    const result = await generateBatch({
      budgetCents: 600,
      seed: "seed",
      strategies: [{ name: "balanced", weight: 1 }],
    });

    expect(result.tickets).toHaveLength(0);
    expect(result.leftoverCents).toBe(600);
    expect(result.payload.leftoverCents).toBe(600);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Lote gerou 0 de 1")]),
    );
  });
});
