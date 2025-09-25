import { describe, expect, it } from "vitest";

import type { NormalizedConcurso } from "@/data/caixa-client";
import { buildDrawPayload, determineStart } from "@/services/sync";

const normalized: NormalizedConcurso = {
  concurso: 2550,
  data: new Date("2024-09-01T00:00:00.000Z"),
  dezenas: [3, 16, 29, 37, 45, 60],
  premios: [
    { faixa: "Sena", ganhadores: 0, premio_cents: BigInt(0) },
    { faixa: "Quina", ganhadores: 82, premio_cents: BigInt(3531245) },
    { faixa: "Quadra", ganhadores: 5218, premio_cents: BigInt(78532) },
  ],
  arrecadacao_total_cents: BigInt(8832145750),
  acumulou: true,
  valor_acumulado_cents: BigInt(4850000000),
  valor_estimado_cents: BigInt(5000000000),
  concurso_especial_cents: BigInt(0),
  proximo_concurso: 2551,
  data_proximo: new Date("2024-09-04T00:00:00.000Z"),
  cidade: "SÃO PAULO",
  uf: "SP",
  local: "ESPAÇO DA SORTE",
  observacao: null,
};

describe("determineStart", () => {
  it("retorna início baseado em janela quando banco vazio", () => {
    expect(
      determineStart({
        latest: 100,
        lastStored: null,
        windowSize: 5,
        fullBackfill: false,
      }),
    ).toBe(96);
  });

  it("retorna último concurso + 1 quando há histórico em modo incremental", () => {
    expect(
      determineStart({
        latest: 100,
        lastStored: 90,
        fullBackfill: false,
      }),
    ).toBe(91);
  });

  it("retorna 1 quando fullBackfill está ativo sem limite", () => {
    expect(
      determineStart({
        latest: 100,
        lastStored: 90,
        fullBackfill: true,
      }),
    ).toBe(1);
  });

  it("respeita limite informado em fullBackfill", () => {
    expect(
      determineStart({
        latest: 100,
        lastStored: 90,
        fullBackfill: true,
        windowSize: 25,
      }),
    ).toBe(76);
  });
});

describe("buildDrawPayload", () => {
  it("transforma concurso normalizado em payload Prisma com BigInt", () => {
    const payload = buildDrawPayload(normalized);

    expect(payload.draw.concurso).toBe(2550);
    expect(payload.draw.valor_acumulado).toBe(normalized.valor_acumulado_cents);
    expect(payload.draw.valor_estimado).toBe(normalized.valor_estimado_cents);
    expect(payload.draw.valor_concurso_especial).toBe(
      normalized.concurso_especial_cents,
    );
    expect(payload.draw.arrecadacao_total).toBe(
      normalized.arrecadacao_total_cents,
    );
    expect(payload.dezenas).toHaveLength(6);
    expect(payload.dezenas[0]).toEqual({ dezena: 3, ordem: 1 });
    expect(payload.premios).toHaveLength(3);
    expect(payload.premios[1]).toEqual({
      faixa: "Quina",
      ganhadores: 82,
      premio: BigInt(3531245),
    });
  });
});
