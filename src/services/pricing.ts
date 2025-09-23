import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { BETTING_LIMITS } from "@/services/strategy-limits";

const DEFAULT_BASE_PRICE_CENTS = 600;

export type PricingErrorCode =
  | "K_OUT_OF_RANGE"
  | "PRICE_NOT_FOUND"
  | "BUDGET_BELOW_MIN"
  | "BUDGET_ABOVE_MAX";

export class PricingError extends Error {
  readonly code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}

export type PriceInfo = {
  k: number;
  costCents: number;
  fonte: string;
  updatedAt: Date;
};

export type GetPriceOptions = {
  client?: PrismaClient;
};

export type PricingMetadata = {
  lastOfficialUpdate: Date | null;
  lastCheckedAt: Date | null;
  fonte: string | null;
};

export async function getPricingMetadata({
  client = prisma,
}: GetPriceOptions = {}): Promise<PricingMetadata> {
  assertServerEnvironment();

  const [latestPrice, lastChecked] = await Promise.all([
    client.price.findFirst({
      orderBy: { atualizado_em: "desc" },
      select: { atualizado_em: true, fonte: true },
    }),
    client.meta.findUnique({
      where: { key: "price_last_checked" },
      select: { value: true },
    }),
  ]);

  return {
    lastOfficialUpdate: latestPrice?.atualizado_em ?? null,
    lastCheckedAt: lastChecked?.value ? parseDateSafe(lastChecked.value) : null,
    fonte: latestPrice?.fonte ?? null,
  };
}

export async function getPriceForK(
  k: number,
  { client = prisma }: GetPriceOptions = {},
): Promise<PriceInfo> {
  assertServerEnvironment();
  assertKInRange(k);

  const priceRecord = await client.price.findUnique({ where: { k } });

  if (priceRecord) {
    return {
      k: priceRecord.k,
      costCents: priceRecord.valor_cents,
      fonte: priceRecord.fonte,
      updatedAt: priceRecord.atualizado_em,
    };
  }

  const fallbackCost = calculateCombinationCost(k, getBasePriceCents());

  return {
    k,
    costCents: fallbackCost,
    fonte: "env:MEGASENA_BASE_PRICE_CENTS",
    updatedAt: getFallbackUpdatedAt(),
  };
}

export async function calculateTicketCost(
  k: number,
  options?: GetPriceOptions,
): Promise<number> {
  const info = await getPriceForK(k, options);
  return info.costCents;
}

export type BudgetAllocationResult = {
  budgetCents: number;
  ticketCostCents: number;
  maxTickets: number;
  leftoverCents: number;
  constrainedByTicketLimit: boolean;
};

export type BudgetAllocationOptions = {
  k?: number;
  client?: PrismaClient;
};

export async function calculateBudgetAllocation(
  budgetCents: number,
  {
    k = BETTING_LIMITS.defaultDezenaCount,
    client,
  }: BudgetAllocationOptions = {},
): Promise<BudgetAllocationResult> {
  assertServerEnvironment();
  assertBudgetWithinRange(budgetCents);
  assertKInRange(k);

  const ticketCostCents = await calculateTicketCost(k, { client });
  const maxTicketsByBudget = Math.floor(budgetCents / ticketCostCents);

  if (maxTicketsByBudget <= 0) {
    throw new PricingError(
      "BUDGET_BELOW_MIN",
      `Orçamento insuficiente para gerar aposta de ${k} dezenas`,
    );
  }

  const maxTickets = Math.min(
    maxTicketsByBudget,
    BETTING_LIMITS.maxTicketsPerBatch,
  );

  const leftoverCents = budgetCents - maxTickets * ticketCostCents;

  return {
    budgetCents,
    ticketCostCents,
    maxTickets,
    leftoverCents,
    constrainedByTicketLimit: maxTickets < maxTicketsByBudget,
  };
}

function combination(n: number, k: number): number {
  if (k > n) {
    return 0;
  }

  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - (k - i))) / i;
  }

  return Math.round(result);
}

function calculateCombinationCost(k: number, basePriceCents: number): number {
  return combination(k, BETTING_LIMITS.minDezenaCount) * basePriceCents;
}

function assertServerEnvironment() {
  if (typeof window !== "undefined") {
    throw new Error("Serviço de preços deve rodar apenas no servidor");
  }
}

function assertKInRange(k: number) {
  if (
    Number.isNaN(k) ||
    k < BETTING_LIMITS.minDezenaCount ||
    k > BETTING_LIMITS.maxDezenaCount
  ) {
    throw new PricingError(
      "K_OUT_OF_RANGE",
      `Valor de k inválido: ${k}. Permitido entre ${BETTING_LIMITS.minDezenaCount} e ${BETTING_LIMITS.maxDezenaCount}.`,
    );
  }
}

function assertBudgetWithinRange(budgetCents: number) {
  if (Number.isNaN(budgetCents)) {
    throw new PricingError("BUDGET_BELOW_MIN", "Orçamento inválido");
  }

  if (budgetCents < BETTING_LIMITS.minBudgetCents) {
    throw new PricingError(
      "BUDGET_BELOW_MIN",
      `Orçamento mínimo é ${BETTING_LIMITS.minBudgetCents} centavos`,
    );
  }

  if (budgetCents > BETTING_LIMITS.maxBudgetCents) {
    throw new PricingError(
      "BUDGET_ABOVE_MAX",
      `Orçamento máximo permitido é ${BETTING_LIMITS.maxBudgetCents} centavos`,
    );
  }
}

function getBasePriceCents(): number {
  const value = Number(
    process.env.MEGASENA_BASE_PRICE_CENTS ?? DEFAULT_BASE_PRICE_CENTS,
  );

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_BASE_PRICE_CENTS;
  }

  return Math.round(value);
}

function getFallbackUpdatedAt(): Date {
  const fallbackDateEnv = process.env.MEGASENA_PRICE_FALLBACK_UPDATED_AT;
  if (!fallbackDateEnv) {
    return new Date();
  }

  const parsed = new Date(fallbackDateEnv);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function parseDateSafe(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}
