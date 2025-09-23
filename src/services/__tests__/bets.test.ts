import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  generateBatch,
  type StrategyRequest,
  BatchGenerationError,
} from "@/services/bets";

const TEST_DB_FILENAME = "bets-test.db";
const TEST_DB_URL = `file:${path.join(process.cwd(), TEST_DB_FILENAME)}`;
const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let client: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
  client = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
});

beforeEach(async () => {
  await resetDatabase();
  await seedPrices();
  await seedDraws();
});

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

describe("generateBatch", () => {
  it("gera bilhetes determinísticos com estratégia uniforme", async () => {
    const result = await generateBatch({
      budgetCents: 2_400,
      seed: "BATCH-SEED",
      strategies: [{ name: "uniform", weight: 1 }],
      client,
    });

    expect(result.tickets).toHaveLength(4);
    const combinations = result.tickets.map((ticket) =>
      ticket.dezenas.join("-"),
    );
    const unique = new Set(combinations);
    expect(unique.size).toBe(4);

    result.tickets.forEach((ticket) => {
      expect([...ticket.dezenas]).toEqual(
        [...ticket.dezenas].sort((a, b) => a - b),
      );
      expect(ticket.strategy).toBe("uniform");
    });

    expect(
      result.payload.strategies.find((s) => s.name === "uniform")?.generated,
    ).toBe(4);
    expect(result.payload.metrics.averageSum).toBeGreaterThan(0);
    expect(result.payload.config.k).toBe(6);
  });

  it("combina estratégias e coleta métricas agregadas", async () => {
    const strategies: StrategyRequest[] = [
      { name: "balanced", weight: 2, window: 50 },
      { name: "uniform", weight: 1 },
    ];

    const result = await generateBatch({
      budgetCents: 3_000,
      seed: "HYBRID-SEED",
      strategies,
      window: 50,
      client,
    });

    expect(result.tickets).toHaveLength(5);
    const summary = result.payload.strategies;
    const balancedSummary = summary.find((item) => item.name === "balanced");
    const uniformSummary = summary.find((item) => item.name === "uniform");

    expect(balancedSummary?.generated).toBeGreaterThan(0);
    expect(uniformSummary?.generated).toBeGreaterThan(0);
    expect(result.payload.metrics.quadrantCoverage.max).toBeLessThanOrEqual(6);
    expect(result.payload.metrics.paritySpread).toBeLessThanOrEqual(3);
    expect(result.payload.metrics.averageScore).toBeGreaterThanOrEqual(0);
    expect(result.payload.config.strategies).toHaveLength(2);
  });

  it("propaga erro de orçamento insuficiente", async () => {
    await expect(
      generateBatch({
        budgetCents: 500,
        seed: "LOW-BUDGET",
        strategies: [{ name: "uniform" }],
        client,
      }),
    ).rejects.toMatchObject({ code: "BUDGET_BELOW_MIN" });
  });

  it("interrompe geração quando timeout é atingido", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1_000);
    nowSpy.mockImplementation(() => 5_000);

    const promise = generateBatch({
      budgetCents: 3_000,
      seed: "TIMEOUT-SEED",
      strategies: [{ name: "uniform" }],
      timeoutMs: 10,
      client,
    });

    await expect(promise).rejects.toBeInstanceOf(BatchGenerationError);

    nowSpy.mockRestore();
  });
});

async function resetDatabase() {
  await client.betDezena.deleteMany();
  await client.bet.deleteMany();
  await client.prizeFaixa.deleteMany();
  await client.drawDezena.deleteMany();
  await client.draw.deleteMany();
  await client.price.deleteMany();
}

async function seedPrices() {
  const updatedAt = new Date("2025-07-12T00:00:00Z");
  await client.price.upsert({
    where: { k: 6 },
    update: {
      valor_cents: 600,
      fonte: "fonte-teste",
      atualizado_em: updatedAt,
    },
    create: {
      k: 6,
      valor_cents: 600,
      fonte: "fonte-teste",
      atualizado_em: updatedAt,
    },
  });
}

async function seedDraws() {
  const draws = [
    {
      concurso: 1200,
      data: new Date("2024-01-01T00:00:00Z"),
      dezenas: [2, 7, 13, 22, 35, 41],
    },
    {
      concurso: 1201,
      data: new Date("2024-01-04T00:00:00Z"),
      dezenas: [5, 12, 19, 28, 43, 57],
    },
    {
      concurso: 1202,
      data: new Date("2024-01-08T00:00:00Z"),
      dezenas: [1, 11, 23, 36, 44, 60],
    },
    {
      concurso: 1203,
      data: new Date("2024-01-11T00:00:00Z"),
      dezenas: [4, 8, 29, 34, 45, 59],
    },
  ];

  for (const draw of draws) {
    await client.draw.create({
      data: {
        concurso: draw.concurso,
        data: draw.data,
        arrecadacao_total: BigInt(500_000_00),
        acumulou: false,
        dezenas: {
          create: draw.dezenas.map((dezena, index) => ({
            dezena,
            ordem: index + 1,
          })),
        },
        premios: {
          create: [
            { faixa: "Sena", ganhadores: 0, premio: BigInt(0) },
            { faixa: "Quina", ganhadores: 10, premio: BigInt(1_000_00) },
          ],
        },
      },
    });
  }
}
