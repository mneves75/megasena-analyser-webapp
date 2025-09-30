import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import { uniformStrategy, balancedStrategy } from "@/services/strategies";

const TEST_DB_FILENAME = "strategies-test.db";
const TEST_DB_URL = `file:${path.join(process.cwd(), TEST_DB_FILENAME)}`;
const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let client: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });

  client = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
});

beforeEach(async () => {
  await seedDraws();
});

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

async function seedDraws() {
  await client.betDezena.deleteMany();
  await client.bet.deleteMany();
  await client.prizeFaixa.deleteMany();
  await client.drawDezena.deleteMany();
  await client.draw.deleteMany();

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

describe("strategies", () => {
  it("uniformStrategy gera resultados determinísticos e sem duplicatas", async () => {
    const first = await uniformStrategy({ seed: "TEST-SEED" });
    const second = await uniformStrategy({ seed: "TEST-SEED" });

    expect(first.dezenas).toEqual(second.dezenas);
    expect(new Set(first.dezenas).size).toBe(first.dezenas.length);
    expect(first.dezenas).toEqual([...first.dezenas].sort((a, b) => a - b));
    expect(first.metadata.strategy).toBe("uniform");
  });

  it("balancedStrategy distribui dezenas pelos quadrantes e respeita paridade", async () => {
    const result = await balancedStrategy({
      seed: "BALANCED-SEED",
      client,
      window: 50,
    });

    expect(result.dezenas).toHaveLength(6);
    expect(new Set(result.dezenas).size).toBe(6);
    expect(result.dezenas).toEqual([...result.dezenas].sort((a, b) => a - b));
    expect(result.metadata.quadrants.every((q) => q.count >= 1)).toBe(true);
    expect(
      Math.abs(result.metadata.parity.even - result.metadata.parity.odd),
    ).toBeLessThanOrEqual(2);
    expect(result.metadata.strategy).toBe("balanced");
    expect(result.metadata.details?.averageFrequency).toBeGreaterThanOrEqual(0);
  });
});
