import { describe, expect, it } from "vitest";

import { summarizeTicketBreakdown } from "@/cli/commands/bets";

describe("summarizeTicketBreakdown", () => {
  it("usa valores emitidos quando presentes", () => {
    const result = summarizeTicketBreakdown([
      { k: 6, emitted: 3, planned: 4 },
      { k: 7, emitted: 1 },
    ]);
    expect(result).toContain("3x6");
    expect(result).toContain("1x7");
  });

  it("regride para planned quando emitted ausente", () => {
    const result = summarizeTicketBreakdown([{ k: 8, planned: 2 }]);
    expect(result).toContain("2x8");
  });

  it("retorna vazio quando todos os valores são zero", () => {
    const result = summarizeTicketBreakdown([{ k: 6, emitted: 0 }]);
    expect(result).toBe("");
  });
});
