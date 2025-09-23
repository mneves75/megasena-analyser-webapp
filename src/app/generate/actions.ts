"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generateBatch } from "@/services/bets";
import { persistBatch } from "@/services/bet-store";

const formSchema = z.object({
  budgetCents: z.coerce.number().int().positive(),
  seed: z.string().min(1),
  strategy: z.enum(["balanced", "uniform"]).default("balanced"),
  window: z.coerce.number().int().positive().optional(),
  timeoutMs: z.coerce.number().int().positive().optional(),
});

export async function generateBetsAction(formData: FormData) {
  const parsed = formSchema.safeParse({
    budgetCents: formData.get("budgetCents"),
    seed: formData.get("seed"),
    strategy: formData.get("strategy"),
    window: formData.get("window"),
    timeoutMs: formData.get("timeoutMs"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    } as const;
  }

  const { budgetCents, seed, strategy, window, timeoutMs } = parsed.data;

  const result = await generateBatch({
    budgetCents,
    seed,
    strategies: [{ name: strategy, weight: 1, window }],
    window,
    timeoutMs,
  });

  await persistBatch(result);
  revalidatePath("/bets");

  return {
    success: true,
    tickets: result.tickets,
    payload: result.payload,
    warnings: result.warnings,
  } as const;
}
