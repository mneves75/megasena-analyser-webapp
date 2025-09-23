import { NextRequest, NextResponse } from "next/server";

import { childLogger } from "@/lib/logger";
import { syncMegaSena } from "@/services/sync";

const logger = childLogger({ route: "api-sync" });
const token = process.env.SYNC_TOKEN;

type Body = {
  fullBackfill?: boolean;
  limit?: number;
};

export async function POST(request: NextRequest) {
  if (token) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${token}`) {
      logger.warn(
        { reason: "invalid_token" },
        "Tentativa de sync não autorizada",
      );
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  let body: Body = {};
  try {
    body = Object.assign({}, await request.json());
  } catch (error) {
    // Corpo vazio é aceitável; outros erros serão logados.
    if (error instanceof SyntaxError) {
      logger.warn(
        { error: error.message },
        "Payload inválido recebido no sync",
      );
      return NextResponse.json(
        { message: "Payload inválido" },
        { status: 400 },
      );
    }
  }

  const { fullBackfill = false, limit } = body;
  const summary = await syncMegaSena({ fullBackfill, limit });

  return NextResponse.json(summary, { status: 200 });
}
