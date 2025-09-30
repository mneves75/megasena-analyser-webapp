import { describe, it, expect, beforeEach, vi } from "vitest";

const listBetsMock = vi.fn();

vi.mock("@/services/bet-store", () => ({
  listBets: listBetsMock,
}));

describe("/api/bets", () => {
  beforeEach(() => {
    vi.resetModules();
    listBetsMock.mockReset();
  });

  it("retorna lista de apostas sem filtros", async () => {
    const sample = [
      {
        id: "bet-1",
        createdAt: new Date("2025-01-01T12:00:00.000Z"),
        strategyName: "balanced",
        ticketCostCents: 600,
        ticketSeed: "ticket-seed",
        metadata: { sum: 210 },
        dezenas: [1, 2, 3, 4, 5, 6],
        batch: {
          id: "batch-1",
          createdAt: new Date("2025-01-01T12:00:00.000Z"),
          budgetCents: 600,
          totalCostCents: 600,
          leftoverCents: 0,
          ticketsGenerated: 1,
          averageTicketCostCents: 600,
          seed: "seed",
          payload: { seed: "seed", totalCostCents: 600 },
        },
      },
    ];
    listBetsMock.mockResolvedValue(sample);
    const { GET } = await import("../route");
    const request = new Request("http://localhost/api/bets");

    const response = await GET(request);
    const json = await response.json();
    console.log("/api/bets response", response.status, json);
    expect(response.status).toBe(200);
    expect(json).toEqual({
      bets: [
        {
          id: "bet-1",
          createdAt: "2025-01-01T12:00:00.000Z",
          strategy: "balanced",
          ticket: {
            costCents: 600,
            seed: "ticket-seed",
            metadata: { sum: 210 },
            dezenas: [1, 2, 3, 4, 5, 6],
          },
          batch: {
            id: "batch-1",
            createdAt: "2025-01-01T12:00:00.000Z",
            budgetCents: 600,
            totalCostCents: 600,
            leftoverCents: 0,
            ticketsGenerated: 1,
            averageTicketCostCents: 600,
            seed: "seed",
            payload: { seed: "seed", totalCostCents: 600 },
          },
        },
      ],
    });
    expect(listBetsMock).toHaveBeenCalledWith({
      strategy: undefined,
      budgetMinCents: undefined,
      budgetMaxCents: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      limit: undefined,
    });
  });

  it("aplica filtros válidos", async () => {
    listBetsMock.mockResolvedValue([]);
    const { GET } = await import("../route");

    const url = new URL("http://localhost/api/bets");
    url.searchParams.set("strategy", "balanced");
    url.searchParams.set("budgetMin", "100");
    url.searchParams.set("budgetMax", "500");
    url.searchParams.set("from", "2025-01-01");
    url.searchParams.set("to", "2025-01-02");
    url.searchParams.set("limit", "10");

    const request = new Request(url.toString());

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(listBetsMock).toHaveBeenCalledWith({
      strategy: "balanced",
      budgetMinCents: 100,
      budgetMaxCents: 500,
      createdFrom: new Date("2025-01-01"),
      createdTo: new Date("2025-01-02"),
      limit: 10,
    });
  });
});
