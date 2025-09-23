import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getFrequencies,
  getPairs,
  getTriplets,
  getRuns,
  getSums,
  getQuadrants,
  getRecency,
} from "@/services/stats";

const querySchema = z.object({
  window: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || value > 0, {
      message: "window deve ser maior que zero",
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || value > 0, {
      message: "limit deve ser maior que zero",
    }),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { stat: string } },
) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    window: searchParams.get("window"),
    limit: searchParams.get("limit"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { errors: parsed.error.format() },
      { status: 400 },
    );
  }

  const { window, limit } = parsed.data;
  const stat = params.stat.toLowerCase();

  switch (stat) {
    case "frequencies":
      return NextResponse.json(await getFrequencies({ window }));
    case "pairs":
      return NextResponse.json(await getPairs({ window, limit }));
    case "triplets":
      return NextResponse.json(await getTriplets({ window, limit }));
    case "runs":
      return NextResponse.json(await getRuns({ window }));
    case "sums":
      return NextResponse.json(await getSums({ window }));
    case "quadrants":
      return NextResponse.json(await getQuadrants({ window }));
    case "recency":
      return NextResponse.json(await getRecency({}));
    default:
      return NextResponse.json(
        { message: `Estatística desconhecida: ${params.stat}` },
        { status: 404 },
      );
  }
}
