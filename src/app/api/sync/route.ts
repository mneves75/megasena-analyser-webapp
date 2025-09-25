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
    const raw = await request.text();
    if (raw && raw.trim().length > 0) {
      body = Object.assign({}, JSON.parse(raw));
    }
  } catch (error) {
    // Em caso de erro real de parsing (conteúdo malformado), retornamos 400.
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Payload inválido recebido no sync",
    );
    return NextResponse.json({ message: "Payload inválido" }, { status: 400 });
  }

  const { fullBackfill = false, limit } = body;
  const summary = await syncMegaSena({ fullBackfill, limit });

  return NextResponse.json(summary, { status: 200 });
}
