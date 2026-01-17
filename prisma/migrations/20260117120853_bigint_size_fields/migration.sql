-- CreateTable
CREATE TABLE "GeneratedRuleset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "tvdbId" INTEGER NOT NULL,
    "showName" TEXT NOT NULL,
    "germanName" TEXT,
    "matchingStrategy" TEXT NOT NULL DEFAULT 'SeasonAndEpisodeNumber',
    "filters" TEXT NOT NULL DEFAULT '[{"attribute":"duration","type":"GreaterThan","value":"15"}]',
    "episodeRegex" TEXT NOT NULL DEFAULT '(?<=[E/])(\d{2})(?=\))',
    "seasonRegex" TEXT NOT NULL DEFAULT '(?<=[S(])(\d{2})(?=[/E])',
    "titleRegexRules" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Download" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "size" BIGINT NOT NULL DEFAULT 0,
    "totalSize" BIGINT NOT NULL DEFAULT 0,
    "downloadedBytes" BIGINT NOT NULL DEFAULT 0,
    "speed" BIGINT NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
INSERT INTO "new_Download" ("category", "completedAt", "createdAt", "error", "filePath", "id", "progress", "status", "title", "url") SELECT "category", "completedAt", "createdAt", "error", "filePath", "id", "progress", "status", "title", "url" FROM "Download";
DROP TABLE "Download";
ALTER TABLE "new_Download" RENAME TO "Download";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedRuleset_topic_key" ON "GeneratedRuleset"("topic");

-- CreateIndex
CREATE INDEX "GeneratedRuleset_tvdbId_idx" ON "GeneratedRuleset"("tvdbId");
