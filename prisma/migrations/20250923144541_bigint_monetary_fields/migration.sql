/*
  Warnings:

  - You are about to alter the column `arrecadacao_total` on the `Draw` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `valor_acumulado` on the `Draw` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `valor_concurso_especial` on the `Draw` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `valor_estimado` on the `Draw` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `premio` on the `PrizeFaixa` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Draw" (
    "concurso" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "arrecadacao_total" BIGINT,
    "acumulou" BOOLEAN NOT NULL DEFAULT false,
    "proximo_concurso" INTEGER,
    "valor_acumulado" BIGINT,
    "valor_estimado" BIGINT,
    "valor_concurso_especial" BIGINT,
    "data_proximo_concurso" DATETIME,
    "localSorteio" TEXT,
    "observacao" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Draw" ("acumulou", "arrecadacao_total", "cidade", "concurso", "created_at", "data", "data_proximo_concurso", "localSorteio", "observacao", "proximo_concurso", "uf", "updated_at", "valor_acumulado", "valor_concurso_especial", "valor_estimado") SELECT "acumulou", "arrecadacao_total", "cidade", "concurso", "created_at", "data", "data_proximo_concurso", "localSorteio", "observacao", "proximo_concurso", "uf", "updated_at", "valor_acumulado", "valor_concurso_especial", "valor_estimado" FROM "Draw";
DROP TABLE "Draw";
ALTER TABLE "new_Draw" RENAME TO "Draw";
CREATE INDEX "Draw_data_idx" ON "Draw"("data");
CREATE INDEX "Draw_acumulou_idx" ON "Draw"("acumulou");
CREATE TABLE "new_PrizeFaixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "concurso" INTEGER NOT NULL,
    "faixa" TEXT NOT NULL,
    "ganhadores" INTEGER NOT NULL,
    "premio" BIGINT NOT NULL,
    CONSTRAINT "PrizeFaixa_concurso_fkey" FOREIGN KEY ("concurso") REFERENCES "Draw" ("concurso") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PrizeFaixa" ("concurso", "faixa", "ganhadores", "id", "premio") SELECT "concurso", "faixa", "ganhadores", "id", "premio" FROM "PrizeFaixa";
DROP TABLE "PrizeFaixa";
ALTER TABLE "new_PrizeFaixa" RENAME TO "PrizeFaixa";
CREATE UNIQUE INDEX "PrizeFaixa_concurso_faixa_key" ON "PrizeFaixa"("concurso", "faixa");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
