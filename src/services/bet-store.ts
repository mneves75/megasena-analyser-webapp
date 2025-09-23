import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  BatchGenerationResult,
  StrategyPayload,
  StrategyTicket,
} from "@/services/bets";
import type { StrategyName } from "@/services/strategies/types";

export type PersistBatchOptions = {
  client?: PrismaClient;
};

export async function persistBatch(
  batch: BatchGenerationResult,
  { client = prisma }: PersistBatchOptions = {},
): Promise<void> {
  await client.$transaction(async (tx) => {
    for (const ticket of batch.tickets) {
      await tx.bet.create({
        data: {
          budget_cents: batch.budgetCents,
          total_cost_cents: ticket.costCents,
          strategy_name: ticket.strategy,
          strategy_payload: buildTicketPayload(
            batch.payload,
            ticket,
          ) as Prisma.JsonObject,
          numeros: {
            create: ticket.dezenas.map((dezena, index) => ({
              dezena,
              ordem: index + 1,
            })),
          },
        },
      });
    }
  });
}

export type ListBetsFilters = {
  strategy?: StrategyName | string;
  budgetMinCents?: number;
  budgetMaxCents?: number;
  createdFrom?: Date;
  createdTo?: Date;
  limit?: number;
};

export type StoredBet = {
  id: string;
  createdAt: Date;
  strategyName: string;
  budgetCents: number;
  totalCostCents: number;
  dezenas: number[];
  payload: StrategyPayload;
};

export async function listBets(
  filters: ListBetsFilters = {},
  { client = prisma }: PersistBatchOptions = {},
): Promise<StoredBet[]> {
  const {
    strategy,
    budgetMinCents,
    budgetMaxCents,
    createdFrom,
    createdTo,
    limit = 50,
  } = filters;

  const bets = await client.bet.findMany({
    where: {
      strategy_name: strategy ? strategy.toLowerCase() : undefined,
      budget_cents: {
        gte: budgetMinCents,
        lte: budgetMaxCents,
      },
      created_at: {
        gte: createdFrom,
        lte: createdTo,
      },
    },
    orderBy: { created_at: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      numeros: {
        orderBy: { ordem: "asc" },
      },
    },
  });

  return bets.map((bet) => ({
    id: bet.id,
    createdAt: bet.created_at,
    strategyName: bet.strategy_name,
    budgetCents: bet.budget_cents,
    totalCostCents: bet.total_cost_cents,
    dezenas: bet.numeros.map((numero) => numero.dezena),
    payload: bet.strategy_payload as StrategyPayload,
  }));
}

function buildTicketPayload(
  payload: StrategyPayload,
  ticket: StrategyTicket,
): StrategyPayload {
  return {
    ...payload,
    ticket: {
      strategy: ticket.strategy,
      metadata: ticket.metadata,
      seed: ticket.seed,
      costCents: ticket.costCents,
    },
  };
}
