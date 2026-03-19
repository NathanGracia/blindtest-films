-- CreateTable
CREATE TABLE "Emote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "emoji" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Emote_code_key" ON "Emote"("code");
