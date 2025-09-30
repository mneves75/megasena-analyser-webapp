import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { childLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export type BettingLimits = {
  minDezenaCount: number;
  maxDezenaCount: number;
  defaultDezenaCount: number;
  maxTicketsPerBatch: number;
  maxBudgetCents: number;
  minBudgetCents: number;
};

export const DEFAULT_BETTING_LIMITS: Readonly<BettingLimits> = {
  minDezenaCount: 6,
  maxDezenaCount: 15,
  defaultDezenaCount: 6,
  maxTicketsPerBatch: 100,
  maxBudgetCents: 50_000,
  minBudgetCents: 600,
};

export const BETTING_LIMIT_KEYS = [
  "minDezenaCount",
  "maxDezenaCount",
  "defaultDezenaCount",
  "maxTicketsPerBatch",
  "maxBudgetCents",
  "minBudgetCents",
] as const;

export type BettingLimitKey = (typeof BETTING_LIMIT_KEYS)[number];
export type LimitOverrides = Partial<Record<BettingLimitKey, number>>;

export type BettingLimitsOptions = {
  client?: PrismaClient;
};

export type BettingLimitAuditContext = {
  origin?: string;
  actor?: string;
  note?: string;
};

export type MutateBettingLimitsOptions = BettingLimitsOptions & {
  audit?: BettingLimitAuditContext;
};

const logger = childLogger({ service: "strategy-limits" });
const BETTING_LIMITS_META_KEY = "betting_limits";

export async function getBettingLimits({
  client = prisma,
}: BettingLimitsOptions = {}): Promise<BettingLimits> {
  const record = await client.meta.findUnique({
    where: { key: BETTING_LIMITS_META_KEY },
  });

  if (!record) {
    return DEFAULT_BETTING_LIMITS;
  }

  try {
    const parsed = JSON.parse(record.value) as LimitOverrides;
    return mergeLimits(parsed);
  } catch (error) {
    logger.warn(
      { error },
      "Falha ao interpretar betting_limits; retornando padrão",
    );
    return DEFAULT_BETTING_LIMITS;
  }
}

export async function upsertBettingLimits(
  overrides: LimitOverrides,
  { client = prisma, audit }: MutateBettingLimitsOptions = {},
): Promise<BettingLimits> {
  const current = await getBettingLimits({ client });
  const sanitizedInput = sanitizeOverrides(overrides);
  const merged = mergeLimits({
    ...extractOverrides(current),
    ...sanitizedInput,
  });
  const diff = diffLimits(current, merged);

  await client.$transaction(async (tx) => {
    await tx.meta.upsert({
      where: { key: BETTING_LIMITS_META_KEY },
      update: { value: JSON.stringify(extractOverrides(merged)) },
      create: {
        key: BETTING_LIMITS_META_KEY,
        value: JSON.stringify(extractOverrides(merged)),
      },
    });

    await tx.bettingLimitAudit.create({
      data: buildAuditEntry({
        origin: audit?.origin ?? "service",
        actor: audit?.actor,
        note: audit?.note,
        previous: current,
        next: merged,
        overrides: diff,
      }),
    });
  });

  logger.info(
    {
      overrides: diff,
      actor: audit?.actor,
      origin: audit?.origin ?? "service",
    },
    "Limites de aposta atualizados",
  );

  return merged;
}

export async function resetBettingLimits({
  client = prisma,
  audit,
}: MutateBettingLimitsOptions = {}): Promise<BettingLimits> {
  const current = await getBettingLimits({ client });
  const defaults = { ...DEFAULT_BETTING_LIMITS };
  const diff = diffLimits(current, defaults);

  await client.$transaction(async (tx) => {
    try {
      await tx.meta.delete({ where: { key: BETTING_LIMITS_META_KEY } });
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    await tx.bettingLimitAudit.create({
      data: buildAuditEntry({
        origin: audit?.origin ?? "service",
        actor: audit?.actor,
        note: audit?.note ?? "reset_to_defaults",
        previous: current,
        next: defaults,
        overrides: diff,
      }),
    });
  });

  logger.info(
    {
      actor: audit?.actor,
      origin: audit?.origin ?? "service",
    },
    "Limites de aposta resetados para padrão",
  );

  return defaults;
}

function mergeLimits(overrides: LimitOverrides): BettingLimits {
  const base = { ...DEFAULT_BETTING_LIMITS };

  const result = {
    ...base,
    ...sanitizeOverrides(overrides),
  } satisfies BettingLimits;

  if (result.defaultDezenaCount < result.minDezenaCount) {
    result.defaultDezenaCount = result.minDezenaCount;
  }
  if (result.defaultDezenaCount > result.maxDezenaCount) {
    result.defaultDezenaCount = result.maxDezenaCount;
  }

  return result;
}

function sanitizeOverrides(overrides: LimitOverrides): LimitOverrides {
  const sanitized: LimitOverrides = {};

  for (const key of BETTING_LIMIT_KEYS) {
    const value = overrides[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      sanitized[key] = Math.trunc(value);
    }
  }

  return sanitized;
}

function extractOverrides(limits: BettingLimits): LimitOverrides {
  const overrides: LimitOverrides = {};
  for (const key of BETTING_LIMIT_KEYS) {
    if (limits[key] !== DEFAULT_BETTING_LIMITS[key]) {
      overrides[key] = limits[key];
    }
  }
  return overrides;
}

function diffLimits(
  previous: BettingLimits,
  next: BettingLimits,
): LimitOverrides {
  const diff: LimitOverrides = {};
  for (const key of BETTING_LIMIT_KEYS) {
    if (previous[key] !== next[key]) {
      diff[key] = next[key];
    }
  }
  return diff;
}

type AuditEntryInput = {
  origin: string;
  actor?: string;
  note?: string | null;
  previous: BettingLimits;
  next: BettingLimits;
  overrides: LimitOverrides;
};

type AuditEntryPayload = {
  origin: string;
  actor?: string;
  note?: string;
  previous: BettingLimits;
  next: BettingLimits;
  overrides?: LimitOverrides;
};

function buildAuditEntry({
  origin,
  actor,
  note,
  previous,
  next,
  overrides,
}: AuditEntryInput): AuditEntryPayload {
  const payload: AuditEntryPayload = {
    origin,
    actor,
    note: note ?? undefined,
    previous,
    next,
  };

  if (Object.keys(overrides).length > 0) {
    payload.overrides = overrides;
  }

  return payload;
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}
