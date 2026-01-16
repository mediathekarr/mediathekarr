# MediathekArr

Mediathek-Indexer für Sonarr/Radarr - Automatischer Download von ARD, ZDF und anderen deutschen Mediatheken.

## Features

- **Newznab-kompatibler Indexer** - Funktioniert mit Prowlarr, NZB Hydra, Sonarr und Radarr
- **SABnzbd-kompatibler Downloader** - Direkter HTTP-Download von den Mediatheken
- **Automatische MKV-Konvertierung** - FFmpeg-Integration mit deutschen Sprachmetadaten
- **SQLite-Datenbank** - Persistente Speicherung von TVDB-Cache und Download-Historie
- **Einheitlicher Tech-Stack** - Alles in TypeScript/Node.js

## Installation mit Docker

### docker-compose.yml

```yaml
services:
  mediathekarr:
    image: mediathekarr/mediathekarr:latest
    container_name: mediathekarr
    environment:
      - TZ=Europe/Berlin
      - TVDB_API_KEY=your-tvdb-api-key  # Erforderlich
      - DOWNLOAD_FOLDER_PATH=/downloads
      - DOWNLOAD_FOLDER_PATH_MAPPING=/downloads/completed
    volumes:
      - ./data:/app/prisma/data
      - ./downloads:/app/downloads
      - ./ffmpeg:/app/ffmpeg
    ports:
      - "127.0.0.1:3000:3000"
    restart: unless-stopped
```

### Starten

```bash
docker-compose up -d
```

## Manuelle Installation

### Voraussetzungen

- Node.js >= 20
- npm

### Setup

```bash
# Dependencies installieren
npm install

# Datenbank initialisieren
npx prisma migrate dev

# Development Server starten
npm run dev

# Oder Production Build
npm run build
npm start
```

## Konfiguration

### Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `TVDB_API_KEY` | TVDB API Key (erforderlich für TV-Suche) | - |
| `DOWNLOAD_FOLDER_PATH` | Pfad für Downloads im Container | `/downloads` |
| `DOWNLOAD_FOLDER_PATH_MAPPING` | Pfad-Mapping für Sonarr/Radarr | - |
| `DATABASE_URL` | SQLite Datenbank-Pfad | `file:./prisma/data/mediathekarr.db` |

## API Endpoints

### Indexer (Newznab)

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/newznab?t=caps` | Capabilities XML |
| `GET /api/newznab?t=tvsearch&tvdbid=123` | TV-Suche nach TVDB ID |
| `GET /api/newznab?t=tvsearch&q=Tatort` | TV-Suche nach Name |
| `GET /api/newznab?t=search` | RSS Feed |

### Downloader (SABnzbd-kompatibel)

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/download?mode=version` | Version (4.3.3) |
| `GET /api/download?mode=get_config` | Konfiguration |
| `GET /api/download?mode=queue` | Download-Queue |
| `GET /api/download?mode=history` | Download-Historie |
| `POST /api/download?mode=addfile&cat=sonarr` | Download hinzufügen |

## Sonarr/Radarr Einrichtung

### Als Indexer (in Prowlarr oder direkt)

1. Indexer hinzufügen → Generic Newznab
2. URL: `http://mediathekarr:3000/api/newznab`
3. API Key: beliebig (wird nicht validiert)

### Als Download Client

1. Download Client hinzufügen → SABnzbd
2. Host: `mediathekarr`
3. Port: `3000`
4. URL Base: `/api/download`
5. API Key: beliebig

## Entwicklung

```bash
# Development mit Hot Reload
npm run dev

# TypeScript Check
npx tsc --noEmit

# Lint
npm run lint

# Datenbank-Migration erstellen
npm run db:migrate
```

## Projektstruktur

```
src/
├── app/api/           # Next.js API Routes
│   ├── newznab/       # Indexer API
│   └── download/      # Downloader API
├── services/          # Business Logic
│   ├── mediathek.ts   # MediathekView API
│   ├── tvdb.ts        # TVDB API + Caching
│   ├── newznab.ts     # RSS/XML Generation
│   └── rulesets.ts    # Matching Rules
├── server/            # Server-Side Only
│   ├── download-manager.ts
│   └── ffmpeg.ts
└── lib/               # Utilities
    ├── db.ts          # Prisma Client
    └── cache.ts       # LRU Caches
```

## Credits

- [MediathekViewWeb](https://github.com/mediathekview/mediathekviewweb) - Mediathek API
- [TheTVDB](https://thetvdb.com) - Metadaten API

## Lizenz

MIT
