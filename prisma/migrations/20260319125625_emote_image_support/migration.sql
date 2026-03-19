-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Emote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "emoji" TEXT,
    "imageFile" TEXT
);
INSERT INTO "new_Emote" ("code", "emoji", "id") SELECT "code", "emoji", "id" FROM "Emote";
DROP TABLE "Emote";
ALTER TABLE "new_Emote" RENAME TO "Emote";
CREATE UNIQUE INDEX "Emote_code_key" ON "Emote"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
