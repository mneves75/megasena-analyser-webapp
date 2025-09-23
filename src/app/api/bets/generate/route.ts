import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { childLogger } from "@/lib/logger";
import { generateBatch } from "@/services/bets";
import { persistBatch } from "@/services/bet-store";

const logger = childLogger({ route: "api-bets-generate" });
const token = process.env.SYNC_TOKEN;

const strategySchema = z.object({
  name: z.enum(["uniform", "balanced"]),
  weight: z.number().optional(),
  window: z.number().optional(),
});

const bodySchema = z.object({
  budgetCents: z.number().int().positive(),
  seed: z.string().min(1),
  strategies: z.array(strategySchema).optional(),
  k: z.number().int().min(6).max(15).optional(),
  window: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  if (token) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${token}`) {
      logger.warn({ reason: "invalid_token" }, "Tentativa não autorizada");
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  let parsedBody: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsedBody = bodySchema.parse(json);
  } catch (error) {
    logger.warn({ error }, "Payload inválido recebido em /api/bets/generate");
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 });
  }

  const result = await generateBatch(parsedBody);
  await persistBatch(result);

  logger.info(
    {
      ticketsGenerated: result.tickets.length,
      warnings: result.warnings,
    },
    "Apostas geradas via API",
  );

  return NextResponse.json({
    tickets: result.tickets,
    payload: result.payload,
    warnings: result.warnings,
  });
}
