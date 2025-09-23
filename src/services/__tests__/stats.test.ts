import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  getFrequencies,
  getPairs,
  getQuadrants,
  getRecency,
  clearStatsCache,
} from "@/services/stats";

const TEST_DB_FILENAME = "stats-test.db";
const TEST_DB_URL = `file:${path.join(process.cwd(), TEST_DB_FILENAME)}`;
const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let testClient: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });

  testClient = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  await seedFixtures();
});

afterEach(() => {
  clearStatsCache();
});

afterAll(async () => {
  await testClient.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

async function seedFixtures() {
  await testClient.betDezena.deleteMany();
  await testClient.bet.deleteMany();
  await testClient.prizeFaixa.deleteMany();
  await testClient.drawDezena.deleteMany();
  await testClient.draw.deleteMany();

  const draws = [
    {
      concurso: 100,
      data: new Date("2024-01-01T00:00:00Z"),
      dezenas: [1, 2, 3, 4, 5, 6],
    },
    {
      concurso: 101,
      data: new Date("2024-01-08T00:00:00Z"),
      dezenas: [5, 6, 7, 8, 9, 10],
    },
    {
      concurso: 102,
      data: new Date("2024-01-15T00:00:00Z"),
      dezenas: [2, 7, 11, 12, 13, 14],
    },
  ];

  for (const draw of draws) {
    await testClient.draw.create({
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

describe("stats services", () => {
  it("calcula frequências totais", async () => {
    const frequencies = await getFrequencies({ client: testClient });
    expect(frequencies.totalDraws).toBe(3);
    const top = frequencies.items[0];
    expect(top.hits).toBeGreaterThan(0);
    expect(frequencies.items.find((f) => f.dezena === 5)?.hits).toBe(2);
  });

  it("retorna pares mais comuns", async () => {
    const pairs = await getPairs({ client: testClient, limit: 5 });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].combination.length).toBe(2);
  });

  it("calcula quadrantes agregados", async () => {
    const quadrants = await getQuadrants({ client: testClient });
    expect(quadrants).toHaveLength(6);
    const faixaUm = quadrants.find((q) => q.range === "01-10");
    expect(faixaUm?.total).toBeGreaterThan(0);
  });

  it("calcula recência corretamente", async () => {
    const recency = await getRecency({ client: testClient });
    const dezena14 = recency.find((r) => r.dezena === 14);
    expect(dezena14?.contestsSinceLast).toBe(0);
    const dezena1 = recency.find((r) => r.dezena === 1);
    expect(dezena1?.contestsSinceLast).toBe(2);
  });
});
