import { PrismaClient } from "@prisma/client";

import { generateBatch } from "@/services/bets";

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await generateBatch({
      budgetCents: 3_000,
      seed: "FIXTURE-SEED",
      strategies: [
        { name: "balanced", weight: 2, window: 50 },
        { name: "uniform", weight: 1 },
      ],
      window: 50,
      client: prisma,
    });

    console.log(
      JSON.stringify(
        {
          tickets: result.tickets,
          payload: result.payload,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
