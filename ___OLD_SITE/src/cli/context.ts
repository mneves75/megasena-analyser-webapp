import process from "node:process";

import { PrismaClient } from "@prisma/client";

import { childLogger } from "@/lib/logger";

const logger = childLogger({ scope: "cli-context" });

export type CliContext = {
  prisma: PrismaClient;
  close(): Promise<void>;
};

export function assertDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definido. Configure o .env antes de usar a CLI.",
    );
  }

  if (!url.startsWith("file:")) {
    throw new Error(
      `DATABASE_URL esperado com protocolo 'file:'. Valor atual: ${url}. Verifique se cada variável está em sua própria linha no .env`,
    );
  }

  return url;
}

export async function createCliContext(): Promise<CliContext> {
  assertDatabaseUrl();

  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  logger.debug("Prisma client inicializado para CLI");

  return {
    prisma,
    async close() {
      await prisma.$disconnect();
      logger.debug("Prisma client finalizado");
    },
  };
}

export async function withCliContext<T>(run: (ctx: CliContext) => Promise<T>) {
  const ctx = await createCliContext();
  try {
    return await run(ctx);
  } finally {
    await ctx.close();
  }
}
