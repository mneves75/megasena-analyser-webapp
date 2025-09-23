import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listBets } from "@/services/bet-store";

const querySchema = z.object({
  strategy: z.string().optional(),
  budgetMin: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  budgetMax: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined)),
  from: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  to: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || value > 0, {
      message: "limit deve ser maior que zero",
    }),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    strategy: searchParams.get("strategy"),
    budgetMin: searchParams.get("budgetMin"),
    budgetMax: searchParams.get("budgetMax"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    limit: searchParams.get("limit"),
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
