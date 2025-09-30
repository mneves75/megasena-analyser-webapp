-- CreateTable
CREATE TABLE "Draw" (
    "concurso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "arrecadacao_total" INTEGER,
    "acumulou" BOOLEAN NOT NULL DEFAULT false,
    "proximo_concurso" INTEGER,
    "valor_acumulado" INTEGER,
    "valor_estimado" INTEGER,
    "valor_concurso_especial" INTEGER,
    "data_proximo_concurso" DATETIME,
    "localSorteio" TEXT,
    "observacao" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DrawDezena" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "concurso" INTEGER NOT NULL,
    "dezena" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "DrawDezena_concurso_fkey" FOREIGN KEY ("concurso") REFERENCES "Draw" ("concurso") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizeFaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "concurso" INTEGER NOT NULL,
    "faixa" TEXT NOT NULL,
    "ganhadores" INTEGER NOT NULL,
    "premio" INTEGER NOT NULL,
    CONSTRAINT "PrizeFaixa_concurso_fkey" FOREIGN KEY ("concurso") REFERENCES "Draw" ("concurso") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BettingLimitAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origin" TEXT NOT NULL,
    "actor" TEXT,
    "note" TEXT,
    "previous" JSONB NOT NULL,
    "next" JSONB NOT NULL,
    "overrides" JSONB
);

-- CreateTable
CREATE TABLE "Price" (
    "k" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "valor_cents" INTEGER NOT NULL,
    "fonte" TEXT NOT NULL,
    "atualizado_em" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BetBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "budget_cents" INTEGER NOT NULL,
    "total_cost_cents" INTEGER NOT NULL,
    "leftover_cents" INTEGER NOT NULL,
    "tickets_generated" INTEGER NOT NULL,
    "average_ticket_cost_cents" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "payload" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_cost_cents" INTEGER NOT NULL,
    "strategy_name" TEXT NOT NULL,
    "ticket_metadata" JSONB NOT NULL,
    "ticket_seed" TEXT NOT NULL,
    "concurso_referencia" INTEGER,
    "batch_id" TEXT NOT NULL,
    CONSTRAINT "Bet_concurso_referencia_fkey" FOREIGN KEY ("concurso_referencia") REFERENCES "Draw" ("concurso") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bet_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "BetBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BetDezena" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bet_id" TEXT NOT NULL,
    "dezena" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    CONSTRAINT "BetDezena_bet_id_fkey" FOREIGN KEY ("bet_id") REFERENCES "Bet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Draw_data_idx" ON "Draw"("data");

-- CreateIndex
CREATE INDEX "Draw_acumulou_idx" ON "Draw"("acumulou");

-- CreateIndex
CREATE INDEX "DrawDezena_dezena_idx" ON "DrawDezena"("dezena");

-- CreateIndex
CREATE UNIQUE INDEX "DrawDezena_concurso_ordem_key" ON "DrawDezena"("concurso", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeFaixa_concurso_faixa_key" ON "PrizeFaixa"("concurso", "faixa");

-- CreateIndex
CREATE UNIQUE INDEX "BetDezena_bet_id_ordem_key" ON "BetDezena"("bet_id", "ordem");

-- CreateIndex
CREATE INDEX "BettingLimitAudit_created_at_idx" ON "BettingLimitAudit"("created_at");

-- CreateIndex
CREATE INDEX "BetBatch_created_at_idx" ON "BetBatch"("created_at");
