#!/usr/bin/env tsx
/**
 * API Validation Script
 * Validates TVDB IDs exist via TVDB/TMDB APIs
 * Only runs when API keys are available
 */

import * as fs from "fs";
import * as path from "path";

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const TVDB_API_KEY = process.env.TVDB_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const RATE_LIMIT_MS = 250;

interface Ruleset {
  id: number;
  topic: string;
  media: {
    media_tvdbId: number;
    media_name: string;
  };
}

interface Show {
  tvdbId: number;
  name: string;
}

interface TvdbAuthResponse {
  status: string;
  data: {
    token: string;
  };
}

interface TvdbSeriesResponse {
  status: string;
  data?: {
    id: number;
    name: string;
  };
}

interface TmdbFindResponse {
  tv_results: Array<{
    id: number;
    name: string;
  }>;
}

function loadJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTvdbToken(): Promise<string | null> {
  if (!TVDB_API_KEY) return null;

  try {
    const response = await fetch("https://api4.thetvdb.com/v4/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apikey: TVDB_API_KEY }),
    });

    if (!response.ok) {
      console.error(`TVDB auth failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as TvdbAuthResponse;
    return data.data.token;
  } catch (e) {
    console.error("TVDB auth error:", e);
    return null;
  }
}

async function validateTvdbId(tvdbId: number, token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api4.thetvdb.com/v4/series/${tvdbId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      console.warn(`TVDB request failed for ${tvdbId}: ${response.status}`);
      return true; // Don't fail on API errors, only on 404
    }

    const data = (await response.json()) as TvdbSeriesResponse;
    return data.status === "success" && data.data !== undefined;
  } catch (e) {
    console.warn(`TVDB request error for ${tvdbId}:`, e);
    return true; // Don't fail on network errors
  }
}

async function validateTvdbIdViaTmdb(tvdbId: number): Promise<boolean> {
  if (!TMDB_API_KEY) return true;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/find/${tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`
    );

    if (!response.ok) {
      console.warn(`TMDB request failed for ${tvdbId}: ${response.status}`);
      return true; // Don't fail on API errors
    }

    const data = (await response.json()) as TmdbFindResponse;
    return data.tv_results.length > 0;
  } catch (e) {
    console.warn(`TMDB request error for ${tvdbId}:`, e);
    return true; // Don't fail on network errors
  }
}

function collectTvdbIds(): Map<number, string> {
  const tvdbIds = new Map<number, string>();

  // Collect from shows.json
  const showsPath = path.join(DATA_DIR, "shows.json");
  if (fs.existsSync(showsPath)) {
    const shows = loadJson<Show[]>(showsPath);
    for (const show of shows) {
      tvdbIds.set(show.tvdbId, `shows.json: ${show.name}`);
    }
  }

  // Collect from rulesets.json
  const rulesetsPath = path.join(DATA_DIR, "rulesets.json");
  if (fs.existsSync(rulesetsPath)) {
    const rulesets = loadJson<Ruleset[]>(rulesetsPath);
    for (const ruleset of rulesets) {
      const existing = tvdbIds.get(ruleset.media.media_tvdbId);
      if (!existing) {
        tvdbIds.set(ruleset.media.media_tvdbId, `rulesets.json: ${ruleset.media.media_name}`);
      }
    }
  }

  return tvdbIds;
}

async function main(): Promise<void> {
  console.log("Starting API validation...\n");

  if (!TVDB_API_KEY && !TMDB_API_KEY) {
    console.log("No API keys configured (TVDB_API_KEY or TMDB_API_KEY).");
    console.log("Skipping API validation.");
    process.exit(0);
  }

  const tvdbIds = collectTvdbIds();
  console.log(`Found ${tvdbIds.size} unique TVDB IDs to validate.\n`);

  if (tvdbIds.size === 0) {
    console.log("No TVDB IDs found, nothing to validate.");
    process.exit(0);
  }

  let tvdbToken: string | null = null;
  let usesTvdb = false;

  if (TVDB_API_KEY) {
    console.log("Authenticating with TVDB...");
    tvdbToken = await getTvdbToken();
    if (tvdbToken) {
      console.log("TVDB authentication successful.\n");
      usesTvdb = true;
    } else {
      console.log("TVDB authentication failed, falling back to TMDB.\n");
    }
  }

  if (!usesTvdb && !TMDB_API_KEY) {
    console.log("No working API available, skipping validation.");
    process.exit(0);
  }

  const invalidIds: Array<{ id: number; source: string }> = [];
  let validated = 0;

  console.log("Validating TVDB IDs...");
  for (const [tvdbId, source] of tvdbIds) {
    validated++;
    process.stdout.write(`  [${validated}/${tvdbIds.size}] ${tvdbId}...`);

    let isValid: boolean;
    if (usesTvdb && tvdbToken) {
      isValid = await validateTvdbId(tvdbId, tvdbToken);
    } else {
      isValid = await validateTvdbIdViaTmdb(tvdbId);
    }

    if (isValid) {
      console.log(" OK");
    } else {
      console.log(" NOT FOUND");
      invalidIds.push({ id: tvdbId, source });
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (invalidIds.length > 0) {
    console.log("API VALIDATION FAILED\n");
    console.log("Invalid TVDB IDs:");
    for (const { id, source } of invalidIds) {
      console.log(`  - ${id} (${source})`);
    }
    process.exit(1);
  } else {
    console.log("API VALIDATION PASSED");
    console.log(`All ${tvdbIds.size} TVDB IDs are valid.`);
  }
}

main().catch((e) => {
  console.error("API validation script failed:", e);
  process.exit(1);
});
