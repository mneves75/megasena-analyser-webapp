import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  DEFAULT_BETTING_LIMITS,
  getBettingLimits,
  resetBettingLimits,
  upsertBettingLimits,
} from "@/services/strategy-limits";

const TEST_DB_FILENAME = "limits-test.db";
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
  await client.meta.deleteMany({ where: { key: "betting_limits" } });
  await client.bettingLimitAudit.deleteMany();
});

afterAll(async () => {
  await client.$disconnect();
  fs.rmSync(path.join(process.cwd(), TEST_DB_FILENAME), { force: true });
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
});

describe("strategy-limits", () => {
  it("retorna limites default quando não há override", async () => {
    const limits = await getBettingLimits({ client });
    expect(limits).toEqual(DEFAULT_BETTING_LIMITS);
  });

  it("aplica overrides válidos", async () => {
    const updated = await upsertBettingLimits(
      {
        maxTicketsPerBatch: 80,
        maxBudgetCents: 100_000,
      },
      { client, audit: { origin: "test", actor: "vitest" } },
    );

    expect(updated.maxTicketsPerBatch).toBe(80);
    expect(updated.maxBudgetCents).toBe(100_000);

    const fetched = await getBettingLimits({ client });
    expect(fetched.maxTicketsPerBatch).toBe(80);
    expect(fetched.maxBudgetCents).toBe(100_000);

    const audits = await client.bettingLimitAudit.findMany();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.origin).toBe("test");
    expect(audits[0]?.actor).toBe("vitest");
    expect(audits[0]?.overrides).toMatchObject({
      maxTicketsPerBatch: 80,
      maxBudgetCents: 100_000,
    });
  });

  it("sanitiza overrides inválidos", async () => {
    const updated = await upsertBettingLimits(
      {
        maxTicketsPerBatch: -5,
        minBudgetCents: 100,
      },
      { client, audit: { origin: "test" } },
    );

    expect(updated.maxTicketsPerBatch).toBe(
      DEFAULT_BETTING_LIMITS.maxTicketsPerBatch,
    );
    expect(updated.minBudgetCents).toBe(100);

    const audits = await client.bettingLimitAudit.findMany({
      orderBy: { created_at: "desc" },
    });
    expect(audits[0]?.overrides).toMatchObject({ minBudgetCents: 100 });
  });

  it("reseta limites para os valores padrão e registra auditoria", async () => {
    await upsertBettingLimits(
      { maxTicketsPerBatch: 42 },
      { client, audit: { origin: "test", actor: "initial" } },
    );

    const reset = await resetBettingLimits({
      client,
      audit: { origin: "test", actor: "reset", note: "rollback" },
    });

    expect(reset).toEqual(DEFAULT_BETTING_LIMITS);

    const audits = await client.bettingLimitAudit.findMany({
      orderBy: { created_at: "asc" },
    });

    expect(audits).toHaveLength(2);
    expect(audits[1]?.origin).toBe("test");
    expect(audits[1]?.actor).toBe("reset");
    expect(audits[1]?.note).toBe("rollback");
    expect(audits[1]?.overrides).toEqual({ maxTicketsPerBatch: 100 });
  });
});
