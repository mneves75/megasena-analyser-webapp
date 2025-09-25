import "../../../scripts/dev/register-server-only-stub.js";

import { describe, it, expect, beforeEach, vi } from "vitest";

const { getFrequenciesMock, getRecencyMock } = vi.hoisted(() => ({
  getFrequenciesMock: vi.fn(),
  getRecencyMock: vi.fn(),
}));

vi.mock("@/services/stats", () => ({
  getFrequencies: getFrequenciesMock,
  getRecency: getRecencyMock,
}));

import { hotStreakStrategy } from "@/services/strategies/hot-streak";
import { coldSurgeStrategy } from "@/services/strategies/cold-surge";

describe("novas estratégias", () => {
  beforeEach(() => {
    getFrequenciesMock.mockReset();
    getRecencyMock.mockReset();
  });

  it("hot-streak prioriza dezenas com maior frequência recente", async () => {
    getFrequenciesMock.mockResolvedValue({
      items: Array.from({ length: 60 }, (_, index) => ({
        dezena: index + 1,
        hits: index < 6 ? 900 : 1,
        frequency: index < 6 ? 0.9 : 0.0001,
      })),
      totalDraws: 1000,
      windowStart: 1,
    });

    const result = await hotStreakStrategy({ seed: "HOT-SEED" });

    expect(result.dezenas).toHaveLength(6);
    expect(new Set(result.dezenas)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(result.metadata.details).toMatchObject({
      window: expect.any(Number),
      topHits: expect.any(Array),
    });
  });

  it("cold-surge favorece dezenas com maior atraso", async () => {
    getRecencyMock.mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => ({
        dezena: index + 1,
        contestsSinceLast: index < 6 ? 90 : 1,
      })),
    );

    const result = await coldSurgeStrategy({ seed: "COLD-SEED" });

    expect(result.dezenas).toHaveLength(6);
    // Os seis primeiros números têm atraso muito maior; a estratégia deve selecioná-los.
    expect(new Set(result.dezenas)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(result.metadata.details).toMatchObject({
      recencySample: expect.any(Array),
    });
  });
});
