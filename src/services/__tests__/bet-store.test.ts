import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import { generateBatch } from "@/services/bets";
import { persistBatch, listBets } from "@/services/bet-store";

const TEST_DB_FILENAME = "bet-store-test.db";
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
  await client.betDezena.deleteMany();
  await client.bet.deleteMany();
  await client.prizeFaixa.deleteMany();
  await client.drawDezena.deleteMany();
  await client.draw.deleteMany();
  await client.price.deleteMany();
  await seedPrices();
  await seedDraws();
});

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

describe("bet-store", () => {
  it("persiste e lista apostas", async () => {
    const batch = await generateBatch({
      budgetCents: 3_000,
      seed: "STORE-SEED",
      strategies: [
        { name: "balanced", weight: 2 },
        { name: "uniform", weight: 1 },
      ],
      window: 50,
      client,
    });

    await persistBatch(batch, { client });

    const stored = await listBets(
      {
        strategy: "balanced",
        limit: 10,
      },
      { client },
    );

    expect(stored.length).toBeGreaterThan(0);
    const first = stored[0];
    expect(first.dezenas).toHaveLength(6);
    expect(first.payload.version).toBe("1.0");
    expect(first.payload.ticket?.metadata.sum).toBeGreaterThan(0);
  });
});

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
      concurso: 1300,
      data: new Date("2024-02-01T00:00:00Z"),
      dezenas: [3, 11, 22, 34, 45, 59],
    },
    {
      concurso: 1301,
      data: new Date("2024-02-03T00:00:00Z"),
      dezenas: [6, 18, 25, 33, 42, 51],
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
            { faixa: "Quina", ganhadores: 8, premio: BigInt(1_200_00) },
          ],
        },
      },
    });
  }
}
