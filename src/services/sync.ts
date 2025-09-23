import { Prisma, PrismaClient } from "@prisma/client";

import { fetchConcurso, type NormalizedConcurso } from "@/data/caixa-client";
import { childLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clearStatsCache } from "@/services/stats";

const logger = childLogger({ service: "sync-megasena" });
const DEFAULT_BACKFILL_WINDOW = Number(process.env.SYNC_BACKFILL_WINDOW ?? 50);

assertServerEnvironment();

export type SyncOptions = {
  fullBackfill?: boolean;
  limit?: number;
  client?: PrismaClient;
};

export type SyncResult = {
  processed: number;
  inserted: number;
  updated: number;
  latestConcurso: number | null;
  startedAt: Date;
  finishedAt: Date;
};

export async function syncMegaSena({
  fullBackfill = false,
  limit,
  client = prisma,
}: SyncOptions = {}): Promise<SyncResult> {
  const startedAt = new Date();
  const txClient = client instanceof PrismaClient ? client : prisma;

  const latestApi = await fetchConcurso();
  const latestConcurso = latestApi.concurso;
  const lastStored = await txClient.draw.findFirst({
    orderBy: { concurso: "desc" },
    select: { concurso: true },
  });

  const windowSize =
    fullBackfill || !lastStored
      ? (limit ?? DEFAULT_BACKFILL_WINDOW)
      : undefined;
  const startConcurso = determineStart({
    latest: latestConcurso,
    lastStored: lastStored?.concurso ?? null,
    windowSize,
  });

  if (startConcurso > latestConcurso) {
    logger.info({ latestConcurso }, "Nenhum concurso novo disponível");
    return {
      processed: 0,
      inserted: 0,
      updated: 0,
      latestConcurso,
      startedAt,
      finishedAt: new Date(),
    };
  }

  const summary = { processed: 0, inserted: 0, updated: 0 };
  const cachedLatest = new Map<
    number,
    Awaited<ReturnType<typeof fetchConcurso>>
  >();
  cachedLatest.set(latestApi.concurso, latestApi);

  for (
    let concurso = startConcurso;
    concurso <= latestConcurso;
    concurso += 1
  ) {
    const normalized =
      cachedLatest.get(concurso) ?? (await fetchConcurso(concurso));

    const result = await persistConcurso(txClient, normalized);
    summary.processed += 1;
    summary[result === "inserted" ? "inserted" : "updated"] += 1;
  }

  await txClient.meta.upsert({
    where: { key: "last_sync" },
    update: { value: new Date().toISOString() },
    create: { key: "last_sync", value: new Date().toISOString() },
  });

  const finishedAt = new Date();
  logger.info({ ...summary, latestConcurso }, "Sincronização concluída");
  clearStatsCache();

  return {
    ...summary,
    latestConcurso,
    startedAt,
    finishedAt,
  };
}

function assertServerEnvironment() {
  if (typeof window !== "undefined") {
    throw new Error("Serviço de sync deve rodar apenas no servidor");
  }
}

type PersistResult = "inserted" | "updated";

async function persistConcurso(
  client: PrismaClient,
  concurso: NormalizedConcurso,
): Promise<PersistResult> {
  const payload = buildDrawPayload(concurso);

  const existing = await client.draw.findUnique({
    where: { concurso: concurso.concurso },
    select: { concurso: true },
  });

  const action: PersistResult = existing ? "updated" : "inserted";

  await client.$transaction(async (tx) => {
    if (existing) {
      await tx.drawDezena.deleteMany({
        where: { concurso: concurso.concurso },
      });
      await tx.prizeFaixa.deleteMany({
        where: { concurso: concurso.concurso },
      });
    }

    await tx.draw.upsert({
      where: { concurso: concurso.concurso },
      update: {
        ...payload.draw,
        dezenas: {
          create: payload.dezenas,
        },
        premios: {
          create: payload.premios,
        },
      },
      create: {
        ...payload.draw,
        dezenas: {
          create: payload.dezenas,
        },
        premios: {
          create: payload.premios,
        },
      },
    });
  });

  return action;
}

type DrawPayload = {
  draw: Prisma.DrawCreateInput;
  dezenas: Prisma.DrawDezenaCreateWithoutDrawInput[];
  premios: Prisma.PrizeFaixaCreateWithoutDrawInput[];
};

export function buildDrawPayload(concurso: NormalizedConcurso): DrawPayload {
  const dezenas: Prisma.DrawDezenaCreateWithoutDrawInput[] =
    concurso.dezenas.map((dezena, index) => ({
      dezena,
      ordem: index + 1,
    }));

  const premios: Prisma.PrizeFaixaCreateWithoutDrawInput[] =
    concurso.premios.map((premio) => ({
      faixa: premio.faixa,
      ganhadores: premio.ganhadores,
      premio: premio.premio_cents,
    }));

  return {
    draw: {
      concurso: concurso.concurso,
      data: concurso.data,
      cidade: concurso.cidade,
      uf: concurso.uf,
      arrecadacao_total: concurso.arrecadacao_total_cents,
      acumulou: concurso.acumulou,
      proximo_concurso: concurso.proximo_concurso,
      valor_acumulado: concurso.valor_acumulado_cents,
      valor_estimado: concurso.valor_estimado_cents,
      valor_concurso_especial: concurso.concurso_especial_cents,
      data_proximo_concurso: concurso.data_proximo,
      localSorteio: concurso.local,
      observacao: concurso.observacao,
    },
    dezenas,
    premios,
  };
}

export function determineStart({
  latest,
  lastStored,
  windowSize,
}: {
  latest: number;
  lastStored: number | null;
  windowSize?: number;
}) {
  if (!lastStored) {
    if (!windowSize) return 1;
    return Math.max(1, latest - windowSize + 1);
  }
  return lastStored + 1;
}
