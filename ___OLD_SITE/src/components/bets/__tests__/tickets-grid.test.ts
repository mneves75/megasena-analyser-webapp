import { describe, expect, it } from "vitest";

import { getStrategyLabel } from "@/services/strategies/labels";

describe("getStrategyLabel", () => {
  it("returns localized label for known strategies", () => {
    expect(getStrategyLabel("balanced")).toBe("Balanceada");
    expect(getStrategyLabel("uniform")).toBe("Uniforme");
    expect(getStrategyLabel("hot-streak")).toBe("Sequência aquecida");
    expect(getStrategyLabel("cold-surge")).toBe("Onda fria");
  });

  it("falls back to original value for unknown strategies", () => {
    expect(getStrategyLabel("experimental")).toBe("experimental");
  });
});
