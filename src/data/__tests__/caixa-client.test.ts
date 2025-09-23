import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchConcurso } from "@/data/caixa-client";
import sample from "../../../docs/fixtures/sample-draw.json";

const SAMPLE_RESPONSE = sample as unknown as Record<string, unknown>;

describe("fetchConcurso", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normaliza o payload da CAIXA em centavos e datas ISO", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => SAMPLE_RESPONSE,
    } as unknown as Response);

    const result = await fetchConcurso();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena",
      expect.objectContaining({ cache: "no-store" }),
    );

    expect(result.concurso).toBe(sample.numero);
    expect(result.dezenas).toEqual(sample.listaDezenas.map((d) => Number(d)));
    expect(result.premios[1]?.faixa).toBe(
      sample.listaRateioPremio[1].descricaoFaixa,
    );
    expect(result.premios[1]?.premio_cents).toBe(
      BigInt(Math.round(sample.listaRateioPremio[1].valorPremio * 100)),
    );
    expect(result.arrecadacao_total_cents).toBe(
      BigInt(Math.round((sample.valorArrecadado ?? 0) * 100)),
    );
    expect(result.valor_estimado_cents).toBe(
      BigInt(Math.round((sample.valorEstimadoProximoConcurso ?? 0) * 100)),
    );
    expect(result.data.toISOString()).toBe("2024-09-01T00:00:00.000Z");
    expect(result.data_proximo?.toISOString()).toBe("2024-09-04T00:00:00.000Z");
    expect(result.cidade).toBe("SÃO PAULO");
    expect(result.uf).toBe("SP");
  });

  it("lança erro quando a API responde com status inválido", async () => {
    const originalRetries = process.env.CAIXA_MAX_RETRIES;
    process.env.CAIXA_MAX_RETRIES = "0";

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    try {
      await expect(fetchConcurso()).rejects.toThrow(/HTTP 500/);
    } finally {
      process.env.CAIXA_MAX_RETRIES = originalRetries;
    }
  });
});
