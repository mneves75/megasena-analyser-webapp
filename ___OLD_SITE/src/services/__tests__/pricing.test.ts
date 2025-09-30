import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  calculateBudgetAllocation,
  calculateTicketCost,
  getPriceForK,
  getPricingMetadata,
} from "@/services/pricing";

const TEST_DB_FILENAME = "pricing-test.db";
const TEST_DB_URL = `file:${path.join(process.cwd(), TEST_DB_FILENAME)}`;
const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let testClient: PrismaClient;

beforeAll(async () => {
  process.env.DATABASE_URL = TEST_DB_URL;
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });

  testClient = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });
});

beforeEach(async () => {
  await seedBasePrices();
});

afterEach(async () => {
  await testClient.price.deleteMany();
  await testClient.meta.deleteMany();
  delete process.env.MEGASENA_BASE_PRICE_CENTS;
  delete process.env.MEGASENA_PRICE_FALLBACK_UPDATED_AT;
});

afterAll(async () => {
  await testClient.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

describe("pricing services", () => {
  it("retorna preço armazenado para k=6", async () => {
    const info = await getPriceForK(6, { client: testClient });

    expect(info.costCents).toBe(600);
    expect(info.fonte).toBe("fonte-teste");
  });

  it("calcula custo combinatório para k=7", async () => {
    const cost = await calculateTicketCost(7, { client: testClient });
    expect(cost).toBe(4_200);
  });

  it("usa fallback do ambiente quando preço não existe", async () => {
    await testClient.price.delete({ where: { k: 15 } });

    process.env.MEGASENA_BASE_PRICE_CENTS = "650";
    process.env.MEGASENA_PRICE_FALLBACK_UPDATED_AT = "2025-09-23T00:00:00Z";

    const info = await getPriceForK(15, { client: testClient });

    expect(info.costCents).toBe(combination(15, 6) * 650);
    expect(info.fonte).toBe("env:MEGASENA_BASE_PRICE_CENTS");
    expect(info.updatedAt.toISOString()).toBe("2025-09-23T00:00:00.000Z");
  });

  it("lança erro quando k está fora do intervalo", async () => {
    await expect(getPriceForK(5, { client: testClient })).rejects.toMatchObject(
      {
        code: "K_OUT_OF_RANGE",
      },
    );
  });

  it("impede orçamento acima do máximo", async () => {
    await expect(
      calculateBudgetAllocation(60_000, { client: testClient }),
    ).rejects.toMatchObject({ code: "BUDGET_ABOVE_MAX" });
  });

  it("calcula alocação respeitando limites", async () => {
    const allocation = await calculateBudgetAllocation(50_000, {
      client: testClient,
    });

    expect(allocation.ticketCostCents).toBe(600);
    expect(allocation.maxTickets).toBe(83);
    expect(allocation.leftoverCents).toBe(200);
    expect(allocation.constrainedByTicketLimit).toBe(false);
  });

  it("marca quando limite de bilhetes é aplicado", async () => {
    await testClient.price.update({
      where: { k: 6 },
      data: { valor_cents: 100 },
    });

    const allocation = await calculateBudgetAllocation(50_000, {
      client: testClient,
    });

    expect(allocation.maxTickets).toBe(100);
    expect(allocation.constrainedByTicketLimit).toBe(true);
  });

  it("exibe metadados consolidados", async () => {
    const metadata = await getPricingMetadata({ client: testClient });

    expect(metadata.lastOfficialUpdate?.toISOString()).toBe(
      "2025-07-12T00:00:00.000Z",
    );
    expect(metadata.lastCheckedAt?.toISOString()).toBe(
      "2025-09-23T00:00:00.000Z",
    );
    expect(metadata.fonte).toBe("fonte-teste");
  });
});

async function seedBasePrices() {
  await testClient.price.deleteMany();
  await testClient.meta.deleteMany();

  const updatedAt = new Date("2025-07-12T00:00:00Z");
  const entries = [6, 7, 15].map((k) => ({
    k,
    valor_cents: combination(k, 6) * 600,
    fonte: "fonte-teste",
    atualizado_em: updatedAt,
  }));

  for (const entry of entries) {
    await testClient.price.upsert({
      where: { k: entry.k },
      update: entry,
      create: entry,
    });
  }

  await testClient.meta.upsert({
    where: { key: "price_last_checked" },
    update: { value: "2025-09-23T00:00:00.000Z" },
    create: {
      key: "price_last_checked",
      value: "2025-09-23T00:00:00.000Z",
    },
  });
}

function combination(n: number, k: number) {
  if (k > n) {
    return 0;
  }

  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - (k - i))) / i;
  }
  return Math.round(result);
}
