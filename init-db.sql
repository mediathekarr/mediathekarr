-- Initialize MediathekArr database schema

CREATE TABLE IF NOT EXISTS TvdbSeries (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    germanName TEXT,
    slug TEXT,
    overview TEXT,
    aliases TEXT,
    firstAired DATETIME,
    cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiresAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS TvdbEpisode (
    id INTEGER PRIMARY KEY,
    seriesId INTEGER NOT NULL,
    seasonNumber INTEGER NOT NULL,
    episodeNumber INTEGER NOT NULL,
    name TEXT,
    aired DATETIME,
    runtime INTEGER,
    FOREIGN KEY (seriesId) REFERENCES TvdbSeries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS TvdbEpisode_seriesId_seasonNumber_episodeNumber_idx
ON TvdbEpisode(seriesId, seasonNumber, episodeNumber);

CREATE TABLE IF NOT EXISTS Download (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0,
    totalSize INTEGER DEFAULT 0,
    downloadedBytes INTEGER DEFAULT 0,
    speed INTEGER DEFAULT 0,
    filePath TEXT,
    error TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    completedAt DATETIME
);

CREATE TABLE IF NOT EXISTS Config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Prisma migrations table (for compatibility)
CREATE TABLE IF NOT EXISTS _prisma_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at DATETIME,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at DATETIME,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    applied_steps_count INTEGER DEFAULT 0
);
