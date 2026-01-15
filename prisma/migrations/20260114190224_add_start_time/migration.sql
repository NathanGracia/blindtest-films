-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Track" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "acceptedAnswers" TEXT NOT NULL,
    "audioFile" TEXT NOT NULL,
    "imageFile" TEXT,
    "timeLimit" INTEGER NOT NULL DEFAULT 30,
    "startTime" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "Track_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("acceptedAnswers", "audioFile", "categoryId", "id", "imageFile", "timeLimit", "title") SELECT "acceptedAnswers", "audioFile", "categoryId", "id", "imageFile", "timeLimit", "title" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
