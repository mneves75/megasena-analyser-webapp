import "server-only";

import { PrismaClient, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const statsCache = new Map<string, Promise<unknown>>();

export type WindowedOptions = {
  window?: number;
  client?: PrismaClient;
};

export type TopOptions = WindowedOptions & {
  limit?: number;
};

function getClient(client?: PrismaClient) {
  return client ?? prisma;
}

function cacheKey(name: string, values: unknown[]) {
  return `${name}:${JSON.stringify(values)}`;
}

async function memoize<T>(key: string, loader: () => Promise<T>): Promise<T> {
  let promise = statsCache.get(key) as Promise<T> | undefined;
  if (!promise) {
    promise = loader().catch((error) => {
      statsCache.delete(key);
      throw error;
    });
    statsCache.set(key, promise);
  }

  return promise;
}

async function resolveWindowBounds(client: PrismaClient, window?: number) {
  const latest = await client.draw.findFirst({
    select: { concurso: true },
    orderBy: { concurso: "desc" },
  });
  if (!latest) {
    return { min: null, max: null };
  }

  if (!window || window <= 0) {
    return { min: null, max: latest.concurso };
  }

  return {
    min: Math.max(1, latest.concurso - window + 1),
    max: latest.concurso,
  };
}

function windowCondition(bounds: { min: number | null; max: number | null }) {
  if (!bounds.min) {
    return Prisma.sql``;
  }
  return Prisma.sql`WHERE d.concurso >= ${bounds.min}`;
}

function validateWindow(window?: number) {
  if (window !== undefined && window !== null && window <= 0) {
    throw new Error("Parâmetro window deve ser maior que zero");
  }
}

export function clearStatsCache() {
  statsCache.clear();
}

export async function getFrequencies({
  window,
  client,
}: WindowedOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("frequencies", [window]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);
    const condition = windowCondition(bounds);

    const rows = await prismaClient.$queryRaw<
      {
        dezena: number;
        hits: bigint;
      }[]
    >`
      SELECT dd.dezena AS dezena, COUNT(*) AS hits
      FROM "DrawDezena" dd
      INNER JOIN "Draw" d ON d.concurso = dd.concurso
      ${condition}
      GROUP BY dd.dezena
      ORDER BY hits DESC, dezena ASC
    `;

    const totalDraws = await prismaClient.draw.count({
      where: bounds.min ? { concurso: { gte: bounds.min } } : undefined,
    });

    return {
      totalDraws,
      windowStart: bounds.min,
      items: rows.map((row) => ({
        dezena: row.dezena,
        hits: Number(row.hits),
        frequency: totalDraws > 0 ? Number(row.hits) / totalDraws : 0,
      })),
    };
  });
}

export async function getPairs({
  window,
  limit = 20,
  client,
}: TopOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("pairs", [window, limit]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);
    const condition = windowCondition(bounds);

    const rows = await prismaClient.$queryRaw<
      {
        a: number;
        b: number;
        hits: bigint;
      }[]
    >`
      SELECT dd1.dezena AS a, dd2.dezena AS b, COUNT(*) AS hits
      FROM "DrawDezena" dd1
      INNER JOIN "DrawDezena" dd2
        ON dd1.concurso = dd2.concurso AND dd1.ordem < dd2.ordem
      INNER JOIN "Draw" d ON d.concurso = dd1.concurso
      ${condition}
      GROUP BY dd1.dezena, dd2.dezena
      ORDER BY hits DESC, a ASC, b ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      combination: [row.a, row.b],
      hits: Number(row.hits),
    }));
  });
}

export async function getTriplets({
  window,
  limit = 20,
  client,
}: TopOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("triplets", [window, limit]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);
    const condition = windowCondition(bounds);

    const rows = await prismaClient.$queryRaw<
      {
        a: number;
        b: number;
        c: number;
        hits: bigint;
      }[]
    >`
      SELECT dd1.dezena AS a, dd2.dezena AS b, dd3.dezena AS c, COUNT(*) AS hits
      FROM "DrawDezena" dd1
      INNER JOIN "DrawDezena" dd2
        ON dd1.concurso = dd2.concurso AND dd1.ordem < dd2.ordem
      INNER JOIN "DrawDezena" dd3
        ON dd1.concurso = dd3.concurso AND dd2.ordem < dd3.ordem
      INNER JOIN "Draw" d ON d.concurso = dd1.concurso
      ${condition}
      GROUP BY dd1.dezena, dd2.dezena, dd3.dezena
      ORDER BY hits DESC, a ASC, b ASC, c ASC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      combination: [row.a, row.b, row.c],
      hits: Number(row.hits),
    }));
  });
}

export async function getRuns({
  window,
  client,
}: WindowedOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("runs", [window]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);

    const draws = await prismaClient.draw.findMany({
      where: bounds.min ? { concurso: { gte: bounds.min } } : undefined,
      orderBy: { concurso: "desc" },
      include: {
        dezenas: { orderBy: { ordem: "asc" } },
      },
    });

    const runsMap = new Map<
      string,
      { sequence: number[]; length: number; count: number }
    >();

    for (const draw of draws) {
      const seq = draw.dezenas.map((d) => d.dezena);
      let current: number[] = [];
      for (let i = 0; i < seq.length; i += 1) {
        if (
          current.length === 0 ||
          seq[i] === current[current.length - 1] + 1
        ) {
          current.push(seq[i]);
        } else {
          if (current.length >= 2) {
            const keySeq = current.join("-");
            const entry = runsMap.get(keySeq) ?? {
              sequence: [...current],
              length: current.length,
              count: 0,
            };
            entry.count += 1;
            runsMap.set(keySeq, entry);
          }
          current = [seq[i]];
        }
      }
      if (current.length >= 2) {
        const keySeq = current.join("-");
        const entry = runsMap.get(keySeq) ?? {
          sequence: [...current],
          length: current.length,
          count: 0,
        };
        entry.count += 1;
        runsMap.set(keySeq, entry);
      }
    }

    return [...runsMap.values()].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      if (b.count !== a.count) return b.count - a.count;
      return a.sequence[0] - b.sequence[0];
    });
  });
}

export async function getSums({
  window,
  client,
}: WindowedOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("sums", [window]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);

    const draws = await prismaClient.draw.findMany({
      where: bounds.min ? { concurso: { gte: bounds.min } } : undefined,
      orderBy: { concurso: "desc" },
      include: {
        dezenas: true,
      },
    });

    const histogram = new Map<number, number>();
    let evenCount = 0;
    let oddCount = 0;
    const sums: number[] = [];

    for (const draw of draws) {
      const numbers = draw.dezenas.map((d) => d.dezena);
      const sum = numbers.reduce((acc, n) => acc + n, 0);
      sums.push(sum);
      histogram.set(sum, (histogram.get(sum) ?? 0) + 1);

      const evens = numbers.filter((n) => n % 2 === 0).length;
      evenCount += evens;
      oddCount += numbers.length - evens;
    }

    return {
      totalDraws: draws.length,
      average:
        sums.length > 0 ? sums.reduce((a, b) => a + b, 0) / sums.length : 0,
      histogram: [...histogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sum, count]) => ({ sum, count })),
      parity: {
        even: evenCount,
        odd: oddCount,
      },
    };
  });
}

export async function getQuadrants({
  window,
  client,
}: WindowedOptions = {}) {
  validateWindow(window);
  const prismaClient = getClient(client);
  const key = cacheKey("quadrants", [window]);
  return memoize(key, async () => {
    const bounds = await resolveWindowBounds(prismaClient, window);

    const draws = await prismaClient.draw.findMany({
      where: bounds.min ? { concurso: { gte: bounds.min } } : undefined,
      orderBy: { concurso: "desc" },
      include: { dezenas: true },
    });

    const ranges = [
      { name: "01-10", start: 1, end: 10 },
      { name: "11-20", start: 11, end: 20 },
      { name: "21-30", start: 21, end: 30 },
      { name: "31-40", start: 31, end: 40 },
      { name: "41-50", start: 41, end: 50 },
      { name: "51-60", start: 51, end: 60 },
    ];

    const totals = new Map<string, number>();
    for (const draw of draws) {
      for (const range of ranges) {
        const count = draw.dezenas.filter(
          (d) => d.dezena >= range.start && d.dezena <= range.end,
        ).length;
        totals.set(range.name, (totals.get(range.name) ?? 0) + count);
      }
    }

    return ranges.map((range) => ({
      range: range.name,
      total: totals.get(range.name) ?? 0,
    }));
  });
}

export async function getRecency({ client }: WindowedOptions = {}) {
  const prismaClient = getClient(client);
  const key = cacheKey("recency", []);
  return memoize(key, async () => {
    const latest = await prismaClient.draw.findFirst({
      select: { concurso: true },
      orderBy: { concurso: "desc" },
    });

    if (!latest) {
      return [];
    }

    const rows = await prismaClient.$queryRaw<
      {
        dezena: number;
        ultimo_concurso: number;
      }[]
    >`
      SELECT dd.dezena, MAX(d.concurso) AS ultimo_concurso
      FROM "DrawDezena" dd
      JOIN "Draw" d ON d.concurso = dd.concurso
      GROUP BY dd.dezena
    `;

    const lastMap = new Map<number, number>();
    rows.forEach((row) => lastMap.set(row.dezena, Number(row.ultimo_concurso)));

    return Array.from({ length: 60 }, (_, idx) => idx + 1).map((dezena) => {
      const last = lastMap.get(dezena);
      return {
        dezena,
        contestsSinceLast: last ? latest.concurso - last : null,
      };
    });
  });
}
