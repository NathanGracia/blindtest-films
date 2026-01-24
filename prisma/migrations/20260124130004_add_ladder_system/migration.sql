-- CreateTable
CREATE TABLE "LadderEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pseudo" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "weekId" TEXT NOT NULL,
    "lastGameAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 1
);

-- CreateIndex
CREATE INDEX "LadderEntry_weekId_bestScore_idx" ON "LadderEntry"("weekId", "bestScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LadderEntry_pseudo_weekId_key" ON "LadderEntry"("pseudo", "weekId");
