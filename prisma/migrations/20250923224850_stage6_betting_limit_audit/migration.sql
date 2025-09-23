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

-- CreateIndex
CREATE INDEX "BettingLimitAudit_created_at_idx" ON "BettingLimitAudit"("created_at");
