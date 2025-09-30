import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { BatchGenerationResult, StrategyPayload } from "@/services/bets";
import type { StrategyMetadata, StrategyName } from "@/types/strategy";

export type PersistBatchOptions = {
  client?: PrismaClient;
};

export async function persistBatch(
  batch: BatchGenerationResult,
  { client = prisma }: PersistBatchOptions = {},
): Promise<void> {
  await client.$transaction(async (tx) => {
    const batchRecord = await tx.betBatch.create({
      data: {
        budget_cents: batch.budgetCents,
        total_cost_cents: batch.totalCostCents,
        leftover_cents: batch.leftoverCents,
        tickets_generated: batch.tickets.length,
        average_ticket_cost_cents: batch.averageTicketCostCents,
        seed: batch.payload.seed,
        payload: batch.payload as Prisma.JsonObject,
      },
    });

    for (const ticket of batch.tickets) {
      await tx.bet.create({
        data: {
          batch_id: batchRecord.id,
          ticket_cost_cents: ticket.costCents,
          strategy_name: ticket.strategy,
          ticket_metadata: (ticket.metadata ?? {}) as Prisma.JsonObject,
          ticket_seed: ticket.seed,
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
  ticketCostCents: number;
  ticketSeed: string;
  metadata: StrategyMetadata | null;
  dezenas: number[];
  batch: {
    id: string;
    createdAt: Date;
    budgetCents: number;
    totalCostCents: number;
    leftoverCents: number;
    ticketsGenerated: number;
    averageTicketCostCents: number;
    seed: string;
    payload: StrategyPayload;
  };
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

  const batchRelationFilter =
    budgetMinCents !== undefined || budgetMaxCents !== undefined
      ? {
          budget_cents: {
            gte: budgetMinCents,
            lte: budgetMaxCents,
          },
        }
      : undefined;

  const bets = await client.bet.findMany({
    where: {
      strategy_name: strategy ? strategy.toLowerCase() : undefined,
      created_at: {
        gte: createdFrom,
        lte: createdTo,
      },
      batch: batchRelationFilter,
    },
    orderBy: { created_at: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      numeros: {
        orderBy: { ordem: "asc" },
      },
      batch: true,
    },
  });

  return bets.map((bet) => {
    const payload = bet.batch.payload as StrategyPayload;
    const metadata = bet.ticket_metadata as StrategyMetadata | undefined;

    return {
      id: bet.id,
      createdAt: bet.created_at,
      strategyName: bet.strategy_name,
      ticketCostCents: bet.ticket_cost_cents,
      ticketSeed: bet.ticket_seed,
      metadata: metadata ?? null,
      dezenas: bet.numeros.map((numero) => numero.dezena),
      batch: {
        id: bet.batch.id,
        createdAt: bet.batch.created_at,
        budgetCents: bet.batch.budget_cents,
        totalCostCents: bet.batch.total_cost_cents,
        leftoverCents: bet.batch.leftover_cents,
        ticketsGenerated: bet.batch.tickets_generated,
        averageTicketCostCents: bet.batch.average_ticket_cost_cents,
        seed: bet.batch.seed,
        payload,
      },
    } satisfies StoredBet;
  });
}
