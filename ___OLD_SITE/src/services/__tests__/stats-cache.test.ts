import { describe, expect, it, vi } from "vitest";

import {
  clearStatsCache,
  getFrequencies,
} from "@/services/stats";
import type { PrismaClient } from "@prisma/client";

function createClientMock() {
  const drawFindFirst = vi.fn().mockResolvedValue({ concurso: 200 });
  const drawCount = vi.fn().mockResolvedValue(20);
  const queryRaw = vi
    .fn()
    .mockResolvedValue([
      { dezena: 1, hits: BigInt(5) },
      { dezena: 2, hits: BigInt(3) },
    ]);

  const client = {
    $queryRaw: queryRaw,
    draw: {
      findFirst: drawFindFirst,
      count: drawCount,
    },
  } as unknown as PrismaClient;

  return { client, drawCount };
}

describe("stats cache invalidation", () => {
  it("limpa memoização após clearStatsCache", async () => {
    const { client, drawCount } = createClientMock();

    await getFrequencies({ client });
    await getFrequencies({ client });
    expect(drawCount).toHaveBeenCalledTimes(1);

    clearStatsCache();

    await getFrequencies({ client });
    expect(drawCount).toHaveBeenCalledTimes(2);
  });
});
