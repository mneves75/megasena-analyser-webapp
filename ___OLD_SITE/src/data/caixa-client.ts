import { z } from "zod";

import { childLogger } from "@/lib/logger";

const logger = childLogger({ module: "caixa-client" });

assertServerEnvironment();
const rateioSchema = z.object({
  descricaoFaixa: z.string(),
  numeroDeGanhadores: z.number(),
  valorPremio: z.number(),
});

const concursoSchema = z.object({
  numero: z.number(),
  dataApuracao: z.string(),
  listaDezenas: z.array(z.string()),
  listaRateioPremio: z.array(rateioSchema),
  acumulado: z.boolean().optional().default(false),
  valorArrecadado: z.number().nullable().optional(),
  valorAcumuladoProximoConcurso: z.number().nullable().optional(),
  valorEstimadoProximoConcurso: z.number().nullable().optional(),
  valorAcumuladoConcursoEspecial: z.number().nullable().optional(),
  numeroConcursoAnterior: z.number().nullable().optional(),
  numeroConcursoProximo: z.number().nullable().optional(),
  dataProximoConcurso: z.string().nullable().optional(),
  localSorteio: z.string().nullable().optional(),
  nomeMunicipioUFSorteio: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
});

type ApiConcurso = z.infer<typeof concursoSchema>;

export type NormalizedConcurso = {
  concurso: number;
  data: Date;
  dezenas: number[];
  premios: {
    faixa: string;
    ganhadores: number;
    premio_cents: bigint;
  }[];
  arrecadacao_total_cents: bigint | null;
  acumulou: boolean;
  valor_acumulado_cents: bigint | null;
  valor_estimado_cents: bigint | null;
  concurso_especial_cents: bigint | null;
  proximo_concurso: number | null;
  data_proximo: Date | null;
  cidade: string | null;
  uf: string | null;
  local: string | null;
  observacao: string | null;
};

export async function fetchConcurso(
  concurso?: number,
): Promise<NormalizedConcurso> {
  const baseUrl = getBaseUrl();
  const url = concurso ? `${baseUrl}/${concurso}` : baseUrl;
  const data = await fetchWithRetry(url, getMaxRetries(), getRetryDelay());
  const parsed = concursoSchema.parse(data);
  return normalizeConcurso(parsed);
}

function assertServerEnvironment() {
  if (typeof window !== "undefined") {
    throw new Error(
      "caixa-client deve ser usado apenas no ambiente de servidor",
    );
  }
}

function normalizeConcurso(data: ApiConcurso): NormalizedConcurso {
  const [cidade, uf] = (data.nomeMunicipioUFSorteio ?? "")
    .split(",")
    .map((part) => part.trim());

  return {
    concurso: data.numero,
    data: parseCaixaDate(data.dataApuracao),
    dezenas: data.listaDezenas.map((dezena, index) => {
      const value = Number.parseInt(dezena, 10);
      if (Number.isNaN(value)) {
        throw new Error(`Dezena inválida na posição ${index}: ${dezena}`);
      }
      return value;
    }),
    premios: data.listaRateioPremio.map((faixa) => ({
      faixa: faixa.descricaoFaixa,
      ganhadores: faixa.numeroDeGanhadores,
      premio_cents: moneyToCents(faixa.valorPremio),
    })),
    arrecadacao_total_cents: nullableMoneyToCents(data.valorArrecadado),
    acumulou: Boolean(data.acumulado),
    valor_acumulado_cents: nullableMoneyToCents(
      data.valorAcumuladoProximoConcurso,
    ),
    valor_estimado_cents: nullableMoneyToCents(
      data.valorEstimadoProximoConcurso,
    ),
    concurso_especial_cents: nullableMoneyToCents(
      data.valorAcumuladoConcursoEspecial,
    ),
    proximo_concurso: data.numeroConcursoProximo ?? null,
    data_proximo: data.dataProximoConcurso
      ? parseCaixaDate(data.dataProximoConcurso)
      : null,
    cidade: cidade || null,
    uf: uf || null,
    local: data.localSorteio ?? null,
    observacao: data.observacao ?? null,
  };
}

async function fetchWithRetry(url: string, retries: number, baseDelay: number) {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: buildCaixaHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao consultar ${url}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      attempt += 1;
      const delay = baseDelay * 2 ** (attempt - 1);
      logger.warn(
        { url, attempt, delay },
        "Falha na API CAIXA, tentando novamente",
      );
      await wait(delay);
    }
  }

  logger.error(
    { url, error: lastError },
    "Falha definitiva ao consultar API CAIXA",
  );
  throw lastError instanceof Error
    ? lastError
    : new Error("Erro desconhecido ao consultar API CAIXA");
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseCaixaDate(value: string): Date {
  const [day, month, year] = value
    .split("/")
    .map((part) => Number.parseInt(part, 10));
  if ([day, month, year].some((n) => Number.isNaN(n))) {
    throw new Error(`Data da CAIXA inválida: ${value}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function moneyToCents(value: number): bigint {
  return BigInt(Math.round(value * 100));
}

function nullableMoneyToCents(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  return moneyToCents(value);
}

function getBaseUrl() {
  return (
    process.env.CAIXA_API_URL ??
    "https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena"
  );
}

function getMaxRetries() {
  const value = Number(process.env.CAIXA_MAX_RETRIES ?? 3);
  return Number.isNaN(value) ? 3 : value;
}

function getRetryDelay() {
  const value = Number(process.env.CAIXA_RETRY_DELAY_MS ?? 500);
  return Number.isNaN(value) ? 500 : value;
}

function buildCaixaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const userAgent = process.env.CAIXA_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
  const referer = process.env.CAIXA_REFERER?.trim() || DEFAULT_REFERER;
  const origin = process.env.CAIXA_ORIGIN?.trim() || DEFAULT_ORIGIN;
  const acceptLanguage =
    process.env.CAIXA_ACCEPT_LANGUAGE?.trim() || DEFAULT_ACCEPT_LANGUAGE;

  headers["User-Agent"] = userAgent;
  headers.Referer = referer;
  headers.Origin = origin;
  headers["Accept-Language"] = acceptLanguage;

  return headers;
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";
const DEFAULT_REFERER =
  "https://loterias.caixa.gov.br/wps/portal/loterias/landing/megasena/";
const DEFAULT_ORIGIN = "https://loterias.caixa.gov.br";
const DEFAULT_ACCEPT_LANGUAGE = "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7";
