import "./dev/register-server-only-stub.js";

import process from "node:process";

import { prisma } from "../src/lib/prisma";
import type { StrategyPayload } from "../src/services/bets";

async function main() {
  ensureDatabaseUrl();

  const bets = await prisma.bet.findMany({
    select: {
      id: true,
      total_cost_cents: true,
      strategy_payload: true,
    },
  });

  const updates: { id: string; total: number }[] = [];

  for (const bet of bets) {
    const payload = bet.strategy_payload as StrategyPayload | null;
    const payloadTotal = Number(payload?.totalCostCents ?? 0);
    if (payloadTotal > 0 && bet.total_cost_cents < payloadTotal) {
      updates.push({ id: bet.id, total: payloadTotal });
    }
  }

  if (updates.length === 0) {
    console.log(
      "✅ Nenhuma atualização necessária: todos os registros já possuem o custo total correto.",
    );
    return;
  }

  console.log(
    `🔄 Atualizando ${updates.length} registro(s) com custo total normalizado...`,
  );

  for (const entry of updates) {
    await prisma.bet.update({
      where: { id: entry.id },
      data: { total_cost_cents: entry.total },
    });
  }

  console.log("✅ Migração concluída com sucesso.");
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
    console.error("❌ Erro ao atualizar custos totais:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
