import "./dev/register-server-only-stub.js";

import process from "node:process";

import { prisma } from "../src/lib/prisma";

async function main() {
  ensureDatabaseUrl();

  const batches = await prisma.betBatch.findMany({
    include: {
      bets: {
        select: {
          ticket_cost_cents: true,
        },
      },
    },
  });

  if (batches.length === 0) {
    console.log("✅ Nenhum lote encontrado. Nada a atualizar.");
    return;
  }

  let updates = 0;

  for (const batch of batches) {
    const sum = batch.bets.reduce(
      (total, ticket) => total + ticket.ticket_cost_cents,
      0,
    );
    const average =
      batch.bets.length > 0 ? Math.round(sum / batch.bets.length) : 0;
    const leftover = Math.max(batch.budget_cents - sum, 0);

    if (
      sum !== batch.total_cost_cents ||
      leftover !== batch.leftover_cents ||
      average !== batch.average_ticket_cost_cents
    ) {
      await prisma.betBatch.update({
        where: { id: batch.id },
        data: {
          total_cost_cents: sum,
          leftover_cents: leftover,
          average_ticket_cost_cents: average,
        },
      });
      updates += 1;
    }
  }

  if (updates === 0) {
    console.log("✅ Todos os lotes já estavam normalizados.");
  } else {
    console.log(`✅ Migração concluída. ${updates} lote(s) atualizados.`);
  }
}

function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definido. Configure o .env antes de rodar o script de migração.",
    );
  }
}

main()
  .catch((error) => {
    console.error("❌ Erro ao normalizar lotes de apostas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
