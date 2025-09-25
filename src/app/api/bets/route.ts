import { NextResponse } from "next/server";
import { z } from "zod";

import { listBets } from "@/services/bet-store";

const querySchema = z.object({
  strategy: z.string().optional(),
  budgetMin: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value), {
      message: "budgetMin inválido",
    }),
  budgetMax: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || Number.isFinite(value), {
      message: "budgetMax inválido",
    }),
  from: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
      message: "from inválido",
    }),
  to: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
      message: "to inválido",
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine(
      (value) => value === undefined || (Number.isFinite(value) && value > 0),
      {
        message: "limit deve ser maior que zero",
      },
    ),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const getParam = (key: string) => {
    const value = searchParams.get(key);
    return value === null ? undefined : value;
  };
  const parsed = querySchema.safeParse({
    strategy: getParam("strategy"),
    budgetMin: getParam("budgetMin"),
    budgetMax: getParam("budgetMax"),
    from: getParam("from"),
    to: getParam("to"),
    limit: getParam("limit"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.format() },
      { status: 400 },
    );
  }

  const filters = parsed.data;

  const bets = await listBets({
    strategy: filters.strategy ?? undefined,
    budgetMinCents: filters.budgetMin,
    budgetMaxCents: filters.budgetMax,
    createdFrom: filters.from,
    createdTo: filters.to,
    limit: filters.limit,
  });

  return NextResponse.json({ bets });
}
