import "server-only";

import { prisma } from "@/lib/prisma";

export async function getDrawByConcurso(concurso: number) {
  return prisma.draw.findUnique({
    where: { concurso },
    include: {
      dezenas: {
        orderBy: { ordem: "asc" },
      },
      premios: {
        orderBy: { faixa: "asc" },
      },
    },
  });
}

export async function getLatestDraw() {
  return prisma.draw.findFirst({
    orderBy: { concurso: "desc" },
    include: { dezenas: true, premios: true },
  });
}

export async function listDraws(limit = 20) {
  return prisma.draw.findMany({
    orderBy: { concurso: "desc" },
    take: limit,
    include: {
      dezenas: {
        orderBy: { ordem: "asc" },
      },
    },
  });
}
