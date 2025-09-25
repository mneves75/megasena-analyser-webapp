import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";

import { registerSummaryCommand } from "@/cli/commands/summary";
import { registerStatsCommand } from "@/cli/commands/stats";
import { registerSyncCommand } from "@/cli/commands/sync";
import { registerBetsCommand } from "@/cli/commands/bets";
import { registerLimitsCommand } from "@/cli/commands/limits";
import { SilentSyncUI } from "@/lib/console-ui";
import type { StrategyPayload } from "@/services/bets";

type CliContext = { prisma: typeof prismaStub };
type CliCallback<T = unknown> = (ctx: CliContext) => Promise<T> | T;

const prismaStub = {
  bettingLimitAudit: {
    findMany: vi.fn(),
  },
} as const;
const withCliContextMock = vi.hoisted(() =>
  vi.fn(async <T>(cb: CliCallback<T>) => cb({ prisma: prismaStub })),
);

vi.mock("@/cli/context", () => ({
  withCliContext: (cb: CliCallback) => withCliContextMock(cb),
}));

const loadHomeSummaryMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/dashboard/home-summary", () => ({
  loadHomeSummary: (...args: unknown[]) => loadHomeSummaryMock(...args),
}));

const statsMocks = vi.hoisted(() => ({
  getFrequencies: vi.fn(),
  getPairs: vi.fn(),
  getTriplets: vi.fn(),
  getRuns: vi.fn(),
  getSums: vi.fn(),
  getQuadrants: vi.fn(),
  getRecency: vi.fn(),
}));
vi.mock("@/services/stats", () => statsMocks);

const syncMegaSenaMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/sync", () => ({
  syncMegaSena: (...args: unknown[]) => syncMegaSenaMock(...args),
}));

const generateBatchMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/bets", async (importOriginal) => {
  const original =
    await importOriginal<Promise<typeof import("@/services/bets")>>();
  return {
    ...original,
    generateBatch: (...args: unknown[]) => generateBatchMock(...args),
  };
});

const persistBatchMock = vi.hoisted(() => vi.fn());
const listBetsMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/bet-store", () => ({
  persistBatch: (...args: unknown[]) => persistBatchMock(...args),
  listBets: (...args: unknown[]) => listBetsMock(...args),
}));

const limitsMocks = vi.hoisted(() => ({
  BETTING_LIMIT_KEYS: ["maxTicketsPerBatch", "maxTicketsPerStrategy"] as const,
  getBettingLimits: vi.fn(),
  resetBettingLimits: vi.fn(),
  upsertBettingLimits: vi.fn(),
}));
vi.mock("@/services/strategy-limits", () => limitsMocks);

function createProgram() {
  const program = new Command();
  program.exitOverride();
  return program;
}

describe("CLI commands", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
  let sharedPayload: StrategyPayload;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy.mockClear();
    infoSpy.mockClear();
    prismaStub.bettingLimitAudit.findMany.mockReset();

    const summaryData = {
      highlights: [{ label: "Concursos", value: "100", description: "teste" }],
      topNumbers: [],
      totalDraws: 100,
      averageSum: 150,
      lastSyncDate: new Date("2025-01-01T00:00:00Z"),
      paritySummary: "50%",
      windowSize: 200,
    } as const;
    loadHomeSummaryMock.mockResolvedValue(summaryData);

    statsMocks.getFrequencies.mockResolvedValue({
      items: [
        { dezena: 10, hits: 5, frequency: 0.05 },
        { dezena: 11, hits: 4, frequency: 0.04 },
      ],
      totalDraws: 200,
      windowStart: 1200,
    });
    statsMocks.getPairs.mockResolvedValue([]);
    statsMocks.getTriplets.mockResolvedValue([]);
    statsMocks.getRuns.mockResolvedValue([]);
    statsMocks.getSums.mockResolvedValue({
      totalDraws: 200,
      parity: { even: 300, odd: 300 },
      average: 180,
      histogram: [],
    });
    statsMocks.getQuadrants.mockResolvedValue([]);
    statsMocks.getRecency.mockResolvedValue([]);

    syncMegaSenaMock.mockResolvedValue({
      processed: 5,
      inserted: 3,
      updated: 2,
      latestConcurso: 1234,
      startedAt: new Date("2025-01-01T00:00:00Z"),
      finishedAt: new Date("2025-01-01T00:05:00Z"),
    });

    sharedPayload = {
      version: "1.0" as const,
      seed: "cli-seed",
      requestedBudgetCents: 10_000,
      ticketCostCents: 600,
      averageTicketCostCents: 600,
      ticketCostBreakdown: [{ k: 6, costCents: 600, planned: 1, emitted: 1 }],
      totalCostCents: 600,
      leftoverCents: 9_400,
      ticketsGenerated: 1,
      strategies: [
        { name: "balanced", weight: 1, generated: 1, attempts: 1, failures: 0 },
      ],
      metrics: {
        averageSum: 150,
        averageScore: 0,
        paritySpread: 0.5,
        quadrantCoverage: { min: 1, max: 3, average: 2 },
      },
      config: {
        strategies: [{ name: "balanced", weight: 1 }],
        k: 6,
        window: undefined,
        timeoutMs: 3_000,
        spreadBudget: false,
      },
      warnings: [] as string[],
    };

    generateBatchMock.mockResolvedValue({
      tickets: [
        {
          strategy: "balanced",
          dezenas: [1, 2, 3, 4, 5, 6],
          metadata: { score: 100 },
          costCents: 600,
          seed: "cli-seed",
        },
      ],
      ticketCostCents: 600,
      averageTicketCostCents: 600,
      ticketCostBreakdown: sharedPayload.ticketCostBreakdown,
      totalCostCents: 600,
      budgetCents: 10_000,
      leftoverCents: 9_400,
      payload: sharedPayload,
      warnings: [],
    });
    persistBatchMock.mockResolvedValue(undefined);

    listBetsMock.mockResolvedValue([
      {
        id: "bet-1",
        createdAt: new Date("2025-01-02T00:00:00Z"),
        strategyName: "balanced",
        budgetCents: 10_000,
        totalCostCents: 9_600,
        ticketCostCents: 600,
        dezenas: [1, 2, 3, 4, 5, 6],
        payload: {
          ...sharedPayload,
          ticketCostBreakdown: [
            { k: 6, costCents: 600, planned: 1, emitted: 1 },
          ],
        },
      },
    ]);

    limitsMocks.getBettingLimits.mockResolvedValue({
      maxTicketsPerBatch: 120,
      maxTicketsPerStrategy: 60,
    });
    limitsMocks.resetBettingLimits.mockResolvedValue(undefined);
    limitsMocks.upsertBettingLimits.mockResolvedValue(undefined);
    prismaStub.bettingLimitAudit.findMany.mockResolvedValue([
      {
        id: "audit-1",
        created_at: new Date("2025-01-02T10:00:00Z"),
        overrides: { maxTicketsPerBatch: 150 },
        origin: "cli",
        actor: "test",
        note: "ajuste",
      },
    ]);
  });

  afterAll(() => {
    logSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("emits JSON payload for summary command", async () => {
    const summaryData = {
      highlights: [{ label: "Concursos", value: "100", description: "teste" }],
      topNumbers: [],
      totalDraws: 100,
      averageSum: 150,
      lastSyncDate: new Date("2025-01-01T00:00:00Z"),
      paritySummary: "50%",
      windowSize: 200,
    } as const;
    loadHomeSummaryMock.mockResolvedValueOnce(summaryData);

    const program = createProgram();
    registerSummaryCommand(program);

    await program.parseAsync(["node", "megasena", "summary", "--json"]);

    expect(loadHomeSummaryMock).toHaveBeenCalledWith({
      windowSize: undefined,
      client: prismaStub,
    });

    const printed = logSpy.mock.calls.map((args) => args[0]);
    expect(printed).toContain(JSON.stringify(summaryData));
  });

  it("prints top frequencies in human-readable mode", async () => {
    const program = createProgram();
    registerStatsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "stats",
      "frequencies",
      "--limit",
      "1",
    ]);

    expect(statsMocks.getFrequencies).toHaveBeenCalledWith({
      window: undefined,
      client: prismaStub,
    });
    const printedLines = logSpy.mock.calls.flat();
    expect(
      printedLines.some((line) =>
        String(line).includes("Frequência de dezenas"),
      ),
    ).toBe(true);
    expect(printedLines.some((line) => String(line).includes("10"))).toBe(true);
  });

  it("forwards silent UI when json flag is provided in sync command", async () => {
    const program = createProgram();
    registerSyncCommand(program);

    await program.parseAsync(["node", "megasena", "sync", "--json"]);

    expect(syncMegaSenaMock).toHaveBeenCalled();
    const callArgs = syncMegaSenaMock.mock.calls[0][0] as { ui: unknown };
    expect(callArgs.ui).toBeInstanceOf(SilentSyncUI);
  });

  it("generates bets and persiste por padrão", async () => {
    const program = createProgram();
    registerBetsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "bets",
      "generate",
      "--budget",
      "100",
      "--seed",
      "cli-seed",
    ]);

    expect(generateBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        budgetCents: 10_000,
        seed: "cli-seed",
        client: prismaStub,
        spreadBudget: false,
        timeoutMs: 3_000,
      }),
    );
    expect(persistBatchMock).toHaveBeenCalledWith(expect.any(Object), {
      client: prismaStub,
    });
  });

  it("não persiste quando --dry-run é informado", async () => {
    const program = createProgram();
    registerBetsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "bets",
      "generate",
      "--budget",
      "100",
      "--seed",
      "cli-seed",
      "--dry-run",
    ]);

    expect(persistBatchMock).not.toHaveBeenCalled();
  });

  it("propaga spread-budget when flag is set", async () => {
    const program = createProgram();
    registerBetsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "bets",
      "generate",
      "--budget",
      "120",
      "--spread-budget",
    ]);

    const call = generateBatchMock.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(call?.spreadBudget).toBe(true);
  });

  it("propaga override de k", async () => {
    const program = createProgram();
    registerBetsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "bets",
      "generate",
      "--budget",
      "120",
      "--k",
      "7",
    ]);

    const call = generateBatchMock.mock.calls.at(-1)?.[0] as {
      k?: number;
      strategies: Array<{ kOverride?: number }>;
    };
    expect(call?.k).toBe(7);
    expect(call?.strategies[0]?.kOverride).toBe(7);
  });

  it("lista apostas e respeita limite padrão", async () => {
    const program = createProgram();
    registerBetsCommand(program);

    await program.parseAsync(["node", "megasena", "bets", "list"]);

    expect(listBetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        budgetMinCents: undefined,
        budgetMaxCents: undefined,
      }),
      { client: prismaStub },
    );
    expect(logSpy).toHaveBeenCalled();
  });

  it("aplica overrides de limites e imprime histórico", async () => {
    const program = createProgram();
    registerLimitsCommand(program);

    await program.parseAsync([
      "node",
      "megasena",
      "limits",
      "--set",
      "maxTicketsPerBatch=150",
      "--history",
      "1",
      "--json",
    ]);

    expect(limitsMocks.upsertBettingLimits).toHaveBeenCalledWith(
      { maxTicketsPerBatch: 150 },
      expect.objectContaining({ audit: expect.any(Object) }),
    );
    expect(prismaStub.bettingLimitAudit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
