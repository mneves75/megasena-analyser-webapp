import { describe, it, expect, beforeEach, vi } from "vitest";

const getFrequenciesMock = vi.fn();

vi.mock("@/services/stats", () => ({
  getFrequencies: getFrequenciesMock,
  getPairs: vi.fn(),
  getTriplets: vi.fn(),
  getRuns: vi.fn(),
  getSums: vi.fn(),
  getQuadrants: vi.fn(),
  getRecency: vi.fn(),
}));

describe("/api/stats/[stat]", () => {
  beforeEach(() => {
    vi.resetModules();
    getFrequenciesMock.mockReset();
  });

  it("retorna frequências com janela padrão", async () => {
    getFrequenciesMock.mockResolvedValue({ totalDraws: 0, items: [] });
    const { GET } = await import("../[stat]/route");
    const request = new Request("http://localhost/api/stats/frequencies");

    const response = await GET(request, {
      params: Promise.resolve({ stat: "frequencies" }),
    });

    expect(response.status).toBe(200);
    expect(getFrequenciesMock).toHaveBeenCalledWith({ window: undefined });
    const json = await response.json();
    expect(json).toEqual({ totalDraws: 0, items: [] });
  });

  it("retorna 404 para estatística desconhecida", async () => {
    const { GET } = await import("../[stat]/route");
    const request = new Request("http://localhost/api/stats/custom");

    const response = await GET(request, {
      params: Promise.resolve({ stat: "custom" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json).toEqual({ message: "Estatística desconhecida: custom" });
  });
});
