"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BatchGenerationError, generateBatch } from "@/services/bets";
import { PricingError } from "@/services/pricing";
import { persistBatch } from "@/services/bet-store";

// TODO: Expose timeout overrides in BetGeneratorForm when orchestration supports manual tweaking.
const formSchema = z.object({
  budgetCents: z.coerce.number().int().positive(),
  seed: z.string().min(1),
  strategy: z
    .enum(["balanced", "uniform", "hot-streak", "cold-surge"])
    .default("balanced"),
  window: z.coerce.number().int().positive().optional(),
  timeoutMs: z.coerce.number().int().positive().optional(),
  spreadBudget: z.boolean().optional(),
});

export async function generateBetsAction(formData: FormData) {
  const parsed = formSchema.safeParse({
    budgetCents: formData.get("budgetCents"),
    seed: formData.get("seed"),
    strategy: formData.get("strategy"),
    window: parseOptionalNumber(formData.get("window")),
    timeoutMs: parseOptionalNumber(formData.get("timeoutMs")),
    spreadBudget: parseCheckbox(formData.get("spreadBudget")),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    } as const;
  }

  const { budgetCents, seed, strategy, window, timeoutMs, spreadBudget } =
    parsed.data;
  const strategies = buildStrategies(strategy, window);

  try {
    const result = await generateBatch({
      budgetCents,
      seed,
      strategies,
      window,
      timeoutMs,
      spreadBudget: spreadBudget ?? false,
    });

    await persistBatch(result);
    revalidatePath("/bets");

    return {
      success: true,
      tickets: result.tickets,
      payload: result.payload,
      warnings: result.warnings,
    } as const;
  } catch (error) {
    if (error instanceof PricingError) {
      const fieldErrors: Record<string, string[]> = {};
      let message = error.message;

      switch (error.code) {
        case "BUDGET_BELOW_MIN":
          message =
            "Orçamento insuficiente para emitir uma aposta com o preço configurado.";
          fieldErrors.budgetCents = [message];
          break;
        case "BUDGET_ABOVE_MAX":
          message =
            "Orçamento acima do limite permitido. Reduza o valor ou ajuste os limites de aposta.";
          fieldErrors.budgetCents = [message];
          break;
        case "PRICE_NOT_FOUND":
          message =
            "Não encontramos o preço configurado para esta combinação. Sincronize a tabela de preços ou defina o fallback.";
          fieldErrors.budgetCents = [message];
          break;
        case "K_OUT_OF_RANGE":
          fieldErrors.strategy = [
            "Quantidade de dezenas fora do intervalo permitido pelas regras de aposta.",
          ];
          break;
        default:
          fieldErrors.budgetCents = [message];
      }

      return {
        success: false as const,
        errors: fieldErrors,
        message,
      };
    }

    if (error instanceof BatchGenerationError) {
      return {
        success: false as const,
        errors: {} as Record<string, string[]>,
        message: error.message,
      };
    }

    console.error("generateBetsAction", error);
    return {
      success: false as const,
      errors: {} as Record<string, string[]>,
      message:
        "Falha inesperada ao gerar apostas. Consulte os logs do servidor e tente novamente.",
    };
  }
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const raw = typeof value === "string" ? value.trim() : String(value);
  if (raw === "") {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "on" || normalized === "true" || normalized === "1";
  }

  return Boolean(value);
}

function buildStrategies(
  primary: "balanced" | "uniform" | "hot-streak" | "cold-surge",
  window?: number,
) {
  const items: {
    name: "balanced" | "uniform" | "hot-streak" | "cold-surge";
    weight: number;
    window?: number;
  }[] = [{ name: primary, weight: 1, window }];

  if (primary !== "uniform") {
    items.push({ name: "uniform", weight: 1 });
  }

  return items;
}
