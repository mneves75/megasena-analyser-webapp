import "server-only";

import type { PrismaClient } from "@prisma/client";

import { getFrequencies, getSums, getRecency } from "@/services/stats";
import { getPriceForK, getPricingMetadata } from "@/services/pricing";
import { prisma } from "@/lib/prisma";

import type { StatListItem } from "@/components/dashboard/stat-list";

const DEFAULT_WINDOW_SIZE = 200;

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const SOURCE_LABELS: Record<string, string> = {
  "caixanoticias.caixa.gov.br": "CAIXA Notícias",
  "loterias.caixa.gov.br": "Loterias CAIXA",
};

export type HomeHighlight = {
  label: string;
  value: string;
  description: string;
};

export type HomeSummary = {
  highlights: HomeHighlight[];
  topNumbers: StatListItem[];
  totalDraws: number;
  averageSum: number;
  lastSyncDate: Date | null;
  paritySummary: string;
  windowSize: number;
};

export type LoadHomeSummaryOptions = {
  windowSize?: number;
  client?: PrismaClient;
};

export async function loadHomeSummary(
  options: LoadHomeSummaryOptions = {},
): Promise<HomeSummary> {
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  const prismaClient = options.client ?? prisma;

  const [
    frequencies,
    sums,
    pricingMeta,
    priceK6,
    recency,
    lastSyncMeta,
    latestDraw,
  ] = await Promise.all([
    getFrequencies({ window: windowSize, client: options.client }),
    getSums({ window: windowSize, client: options.client }),
    getPricingMetadata({ client: prismaClient }),
    getPriceForK(6, { client: prismaClient }),
    getRecency({ client: options.client }),
    prismaClient.meta.findUnique({ where: { key: "last_sync" } }),
    prismaClient.draw.findFirst({
      orderBy: { data: "desc" },
      select: { data: true, concurso: true },
    }),
  ]);

  const parsedLastSync = lastSyncMeta?.value
    ? new Date(lastSyncMeta.value)
    : null;
  const lastSyncDate =
    parsedLastSync && !Number.isNaN(parsedLastSync.getTime())
      ? parsedLastSync
      : null;

  const recencyMap = new Map(
    recency.map((item) => [item.dezena, item.contestsSinceLast]),
  );

  const totalParity = sums.parity.even + sums.parity.odd;
  const paritySummary = totalParity
    ? `${Math.round((sums.parity.even / totalParity) * 100)}% pares · ${Math.round(
        (sums.parity.odd / totalParity) * 100,
      )}% ímpares`
    : "Sem dados suficientes";

  const hasAverageSum =
    typeof sums.average === "number" && !Number.isNaN(sums.average);
  const averageSumValue = hasAverageSum ? Math.round(sums.average) : null;

  const highlights: HomeHighlight[] = [
    {
      label: "Concursos processados",
      value: numberFormatter.format(frequencies.totalDraws),
      description: frequencies.windowStart
        ? `Cobertura a partir do concurso ${frequencies.windowStart}`
        : "Sincronize para ampliar a cobertura.",
    },
    {
      label: "Última sincronização",
      value: formatLongDate(lastSyncDate),
      description: latestDraw?.data
        ? `Concurso ${latestDraw.concurso} em ${formatLongDate(latestDraw.data)}`
        : "Nenhum concurso carregado ainda.",
    },
    {
      label: "Preço base oficial",
      value: currencyFormatter.format(priceK6.costCents / 100),
      description: pricingMeta.lastOfficialUpdate
        ? `Atualizado em ${formatShortDate(pricingMeta.lastOfficialUpdate)}${
            priceK6.fonte ? ` · Fonte: ${formatSource(priceK6.fonte)}` : ""
          }`
        : "Use \`npm run db:seed\` para registrar os valores.",
    },
    {
      label: `Soma média (janela ${windowSize})`,
      value:
        averageSumValue !== null
          ? numberFormatter.format(averageSumValue)
          : "–",
      description: paritySummary,
    },
  ];

  const topNumbers: StatListItem[] = frequencies.items
    .slice(0, 6)
    .map((item) => ({
      dezena: item.dezena,
      hits: item.hits,
      percentage: item.frequency,
      contestsSinceLast: recencyMap.get(item.dezena) ?? null,
    }));

  return {
    highlights,
    topNumbers,
    totalDraws: frequencies.totalDraws,
    averageSum: averageSumValue ?? 0,
    lastSyncDate,
    paritySummary,
    windowSize,
  };
}

export const HOME_SUMMARY_DEFAULT_WINDOW = DEFAULT_WINDOW_SIZE;

function formatSource(urlOrLabel: string | null | undefined) {
  if (!urlOrLabel) {
    return "Fonte oficial";
  }

  try {
    const parsed = new URL(urlOrLabel);
    const hostname = parsed.hostname.replace(/^www\./, "");
    return SOURCE_LABELS[hostname] ?? hostname;
  } catch {
    const normalized = urlOrLabel.trim();
    return SOURCE_LABELS[normalized.toLowerCase()] ?? normalized;
  }
}

function formatLongDate(value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return "ainda não sincronizado";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatShortDate(value: Date | null | undefined) {
  if (!value) {
    return "–";
  }
  const timestamp = value instanceof Date ? value.getTime() : Number.NaN;
  if (Number.isNaN(timestamp)) {
    return "–";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}
