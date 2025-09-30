import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

import { fetchConcurso, type NormalizedConcurso } from "@/data/caixa-client";
import { childLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clearStatsCache } from "@/services/stats";
import { type SyncConsoleUI } from "@/lib/console-ui";

const logger = childLogger({ service: "sync-megasena" });
const DEFAULT_BACKFILL_WINDOW = Number(process.env.SYNC_BACKFILL_WINDOW ?? 50);

assertServerEnvironment();

export type SyncOptions = {
  fullBackfill?: boolean;
  limit?: number;
  client?: PrismaClient;
  ui?: SyncConsoleUI;
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
  ui,
}: SyncOptions = {}): Promise<SyncResult> {
  const startedAt = new Date();
  const txClient = client instanceof PrismaClient ? client : prisma;

  logger.info(
    { fullBackfill, limit, defaultWindow: DEFAULT_BACKFILL_WINDOW },
    "Iniciando sincronização Mega-Sena",
  );

  // Rich console UI
  if (ui) {
    ui.showHeader();
  }

  // Fetch latest contest from API with spinner
  const latestApi = ui
    ? await ui.withSpinner(
        "Buscando último concurso na API CAIXA",
        fetchConcurso(),
      )
    : await fetchConcurso();

  const latestConcurso = latestApi.concurso;
  logger.info(
    { latestConcurso, data: latestApi.data },
    "Último concurso disponível na API",
  );

  // Check local database
  const lastStored = ui
    ? await ui.withSpinner(
        "Verificando banco local",
        txClient.draw.findFirst({
          orderBy: { concurso: "desc" },
          select: { concurso: true },
        }),
      )
    : await txClient.draw.findFirst({
        orderBy: { concurso: "desc" },
        select: { concurso: true },
      });

  logger.info(
    { lastStoredConcurso: lastStored?.concurso ?? null },
    "Último concurso armazenado localmente",
  );

  const normalizedLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.trunc(limit)
      : undefined;

  const windowSize = fullBackfill
    ? normalizedLimit
    : !lastStored
      ? (normalizedLimit ?? DEFAULT_BACKFILL_WINDOW)
      : undefined;
  const startConcurso = determineStart({
    latest: latestConcurso,
    lastStored: lastStored?.concurso ?? null,
    windowSize,
    fullBackfill,
  });

  const { totalToProcess, endConcurso } = resolveProcessingRange({
    startConcurso,
    latestConcurso,
    limit: normalizedLimit,
  });

  logger.info(
    {
      startConcurso,
      latestConcurso,
      effectiveLatest: endConcurso,
      windowSize,
      totalToProcess,
    },
    "Janela de sincronização determinada",
  );

  // Show sync plan in console
  if (ui) {
    ui.showSyncPlan({
      startConcurso,
      latestConcurso: endConcurso,
      totalToProcess,
      fullBackfill,
      limit,
    });
  }

  if (startConcurso > endConcurso || totalToProcess <= 0) {
    logger.info(
      { latestConcurso, effectiveLatest: endConcurso },
      "Nenhum concurso novo disponível - banco já está atualizado",
    );

    if (ui) {
      ui.showNoNewContests();
    }

    return {
      processed: 0,
      inserted: 0,
      updated: 0,
      latestConcurso: endConcurso,
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

  logger.info({ totalToProcess }, "Iniciando processamento dos concursos");

  // Start progress bar
  if (ui) {
    ui.startProgress(totalToProcess);
  }

  try {
    for (let concurso = startConcurso; concurso <= endConcurso; concurso += 1) {
      const progress = summary.processed + 1;
      const percentage = Math.round((progress / totalToProcess) * 100);

      logger.debug(
        { concurso, progress, totalToProcess, percentage: `${percentage}%` },
        `Processando concurso ${concurso} (${progress}/${totalToProcess})`,
      );

      const isFromCache = cachedLatest.has(concurso);
      const normalized =
        cachedLatest.get(concurso) ?? (await fetchConcurso(concurso));

      if (!isFromCache) {
        logger.debug(
          { concurso, dezenas: normalized.dezenas, data: normalized.data },
          "Dados obtidos da API CAIXA",
        );
      } else {
        logger.debug({ concurso }, "Usando dados do cache");
      }

      const result = await persistConcurso(txClient, normalized);
      summary.processed += 1;
      summary[result === "inserted" ? "inserted" : "updated"] += 1;

      // Update progress bar
      if (ui) {
        ui.updateProgress(progress, concurso, result);
      }

      logger.debug(
        { concurso, action: result, dezenas: normalized.dezenas },
        `Concurso ${concurso} ${result === "inserted" ? "inserido" : "atualizado"} com sucesso`,
      );
    }
  } finally {
    // Always stop progress bar
    if (ui) {
      ui.stopProgress();
    }
  }

  // Update metadata
  if (ui) {
    await ui.withSpinner(
      "Atualizando metadata",
      txClient.meta.upsert({
        where: { key: "last_sync" },
        update: { value: new Date().toISOString() },
        create: { key: "last_sync", value: new Date().toISOString() },
      }),
    );
  } else {
    logger.info("Atualizando timestamp da última sincronização...");
    await txClient.meta.upsert({
      where: { key: "last_sync" },
      update: { value: new Date().toISOString() },
      create: { key: "last_sync", value: new Date().toISOString() },
    });
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const durationSeconds = Math.round(durationMs / 1000);
  const avgTimePerConcurso =
    summary.processed > 0
      ? Math.round(durationMs / summary.processed) + "ms"
      : "0ms";

  logger.info(
    {
      ...summary,
      latestConcurso: endConcurso,
      durationSeconds,
      avgTimePerConcurso,
    },
    `Sincronização concluída em ${durationSeconds}s`,
  );

  // Clear cache with spinner
  if (ui) {
    await ui.withSpinner(
      "Limpando cache de estatísticas",
      new Promise<void>((resolve) => {
        clearStatsCache();
        resolve();
      }),
    );

    // Show results
    ui.showResults({
      processed: summary.processed,
      inserted: summary.inserted,
      updated: summary.updated,
      durationSeconds,
      avgTimePerConcurso,
    });
  } else {
    logger.info("Limpando cache de estatísticas...");
    clearStatsCache();
    logger.info("Cache de estatísticas limpo com sucesso");
  }

  return {
    ...summary,
    latestConcurso: endConcurso,
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

  logger.debug(
    {
      concurso: concurso.concurso,
      action,
      dezenasCount: payload.dezenas.length,
      premiosCount: payload.premios.length,
      acumulou: payload.draw.acumulou,
    },
    `Preparando para ${action === "inserted" ? "inserir" : "atualizar"} concurso ${concurso.concurso}`,
  );

  await client.$transaction(async (tx) => {
    if (existing) {
      logger.debug(
        { concurso: concurso.concurso },
        "Removendo dados antigos do concurso",
      );
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

  logger.debug(
    { concurso: concurso.concurso, action },
    `Concurso ${concurso.concurso} ${action === "inserted" ? "inserido" : "atualizado"} no banco`,
  );

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
  fullBackfill,
}: {
  latest: number;
  lastStored: number | null;
  windowSize?: number;
  fullBackfill: boolean;
}) {
  if (fullBackfill) {
    if (windowSize && windowSize > 0) {
      return Math.max(1, latest - windowSize + 1);
    }
    return 1;
  }

  if (!lastStored) {
    if (windowSize && windowSize > 0) {
      return Math.max(1, latest - windowSize + 1);
    }
    return 1;
  }

  return lastStored + 1;
}

export function resolveProcessingRange({
  startConcurso,
  latestConcurso,
  limit,
}: {
  startConcurso: number;
  latestConcurso: number;
  limit?: number;
}) {
  if (startConcurso > latestConcurso) {
    return { totalToProcess: 0, endConcurso: startConcurso - 1 };
  }

  const totalAvailable = latestConcurso - startConcurso + 1;
  const sanitizedLimit = limit && limit > 0 ? limit : undefined;
  const totalToProcess = sanitizedLimit
    ? Math.min(sanitizedLimit, totalAvailable)
    : totalAvailable;

  if (totalToProcess <= 0) {
    return { totalToProcess: 0, endConcurso: startConcurso - 1 };
  }

  const endConcurso = startConcurso + totalToProcess - 1;
  return { totalToProcess, endConcurso };
}
