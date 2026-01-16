import { mediathekCache } from "@/lib/cache";
import { getShowInfoByTvdbId } from "./shows";
import {
  ensureRulesetsLoaded,
  getRulesetsForTopic,
  getRulesetsForTopicAndTvdbId,
  getAllTopics,
} from "./rulesets";
import { generateRssItems, convertItemsToRss, serializeRss, getEmptyRssResult } from "./newznab";
import type {
  ApiResultItem,
  MediathekApiResponse,
  TvdbData,
  TvdbEpisode,
  Ruleset,
  MatchedEpisodeInfo,
  NewznabItem,
  Filter,
  TitleRegexRule,
  MatchType,
  TitleRegexRuleType,
  MatchingStrategy,
} from "@/types";
import {
  findEpisodeByAirDate,
  findEpisodesByAirYear,
  findEpisodesBySeason,
  findEpisodeBySeasonAndNumber,
} from "@/types";

const MEDIATHEK_API_URL = "https://mediathekviewweb.de/api/query";
const QUERY_FIELDS = ["topic", "title"];
const SKIP_KEYWORDS = [
  "Audiodeskription",
  "Hörfassung",
  "(klare Sprache)",
  "(Gebärdensprache)",
  "Trailer",
  "Outtakes:",
];

async function fetchMediathekViewApiResponse(
  queries: Array<{ fields: string[]; query: string }>,
  size: number
): Promise<string> {
  const requestBody = {
    queries,
    sortBy: "filmlisteTimestamp",
    sortOrder: "desc",
    future: true,
    offset: 0,
    size,
  };

  try {
    const response = await fetch(MEDIATHEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.error("Error fetching from Mediathek API:", error);
  }

  return "";
}

function shouldSkipItem(item: ApiResultItem): boolean {
  return item.url_video.endsWith(".m3u8") || SKIP_KEYWORDS.some((kw) => item.title.includes(kw));
}

function getFieldValue(item: ApiResultItem, fieldName: string): string {
  switch (fieldName) {
    case "channel":
      return item.channel;
    case "topic":
      return item.topic;
    case "title":
      return item.title;
    case "description":
      return item.description;
    case "timestamp":
      return item.filmlisteTimestamp.toString();
    case "duration":
      return item.duration.toString();
    case "size":
      return item.size.toString();
    case "url_website":
      return item.url_website;
    case "url_video":
      return item.url_video;
    case "url_video_low":
      return item.url_video_low;
    case "url_video_hd":
      return item.url_video_hd;
    default:
      return "";
  }
}

function filterMatches(item: ApiResultItem, filter: Filter): boolean {
  const attributeValue = getFieldValue(item, filter.attribute);
  const filterValue = String(filter.value);

  switch (filter.type) {
    case "ExactMatch" as MatchType:
      return attributeValue.toLowerCase() === filterValue.toLowerCase();
    case "Contains" as MatchType:
      return attributeValue.toLowerCase().includes(filterValue.toLowerCase());
    case "Regex" as MatchType:
      try {
        return new RegExp(filterValue).test(attributeValue);
      } catch {
        return false;
      }
    case "GreaterThan" as MatchType: {
      const attrNum = parseFloat(attributeValue);
      const filterNum = parseFloat(filterValue);
      return !isNaN(attrNum) && !isNaN(filterNum) && attrNum > filterNum * 60;
    }
    case "LessThan" as MatchType: {
      const attrNum = parseFloat(attributeValue);
      const filterNum = parseFloat(filterValue);
      return !isNaN(attrNum) && !isNaN(filterNum) && attrNum < filterNum * 60;
    }
    default:
      return false;
  }
}

function extractValueUsingRegex(item: ApiResultItem, pattern: string | null): string | null {
  if (!pattern) return null;

  const fieldValue = getFieldValue(item, "title");
  if (!fieldValue) return null;

  try {
    const match = fieldValue.match(pattern);
    return match && match.length > 1 ? match[1] : null;
  } catch {
    return null;
  }
}

function buildTitleFromRegexRules(item: ApiResultItem, rulesJson: string): string | null {
  let rules: TitleRegexRule[];
  try {
    rules = JSON.parse(rulesJson);
  } catch {
    return null;
  }

  const parts: string[] = [];

  for (const rule of rules) {
    if (rule.type === ("static" as TitleRegexRuleType)) {
      if (rule.value) {
        parts.push(rule.value);
      }
    } else if (rule.type === ("regex" as TitleRegexRuleType)) {
      if (rule.pattern && rule.field) {
        const fieldValue = getFieldValue(item, rule.field);
        if (fieldValue) {
          try {
            const match = fieldValue.match(rule.pattern);
            if (match && match.length > 0) {
              // Use the last group
              parts.push(match[match.length - 1]);
            } else {
              return null; // Abort if regex match failed
            }
          } catch {
            return null;
          }
        }
      }
    }
  }

  return parts.join("");
}

function formatTitle(title: string): string {
  let formatted = title
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue");

  formatted = formatted.replace(/&/g, "and");
  formatted = formatted.replace(/[/:;,""''@#?$%^*+=!|<>,()]/g, "");
  formatted = formatted.replace(/\s+/g, ".").replace(/\.\./g, ".");

  return formatted;
}

function tryParseDate(dateString: string): Date | null {
  // German date formats
  const formats = [
    /^(\d{1,2})\. (\w+) (\d{4})$/, // "7. Juni 2024"
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // "31.12.2017"
    /^(\d{4})-(\d{2})-(\d{2})$/, // "2017-12-01"
    /^(\d{8})$/, // "20171201"
  ];

  const germanMonths: Record<string, number> = {
    januar: 0,
    februar: 1,
    märz: 2,
    april: 3,
    mai: 4,
    juni: 5,
    juli: 6,
    august: 7,
    september: 8,
    oktober: 9,
    november: 10,
    dezember: 11,
  };

  // Try "d. MMMM yyyy" format
  const match1 = dateString.match(/^(\d{1,2})\. (\w+) (\d{4})$/);
  if (match1) {
    const day = parseInt(match1[1]);
    const month = germanMonths[match1[2].toLowerCase()];
    const year = parseInt(match1[3]);
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Try "dd.MM.yyyy" format
  const match2 = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match2) {
    return new Date(parseInt(match2[3]), parseInt(match2[2]) - 1, parseInt(match2[1]));
  }

  // Try "yyyy-MM-dd" format
  const match3 = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match3) {
    return new Date(parseInt(match3[1]), parseInt(match3[2]) - 1, parseInt(match3[3]));
  }

  // Try "yyyyMMdd" format
  const match4 = dateString.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match4) {
    return new Date(parseInt(match4[1]), parseInt(match4[2]) - 1, parseInt(match4[3]));
  }

  return null;
}

async function matchesSeasonAndEpisode(
  item: ApiResultItem,
  ruleset: Ruleset
): Promise<MatchedEpisodeInfo | null> {
  const tvdbData = await getShowInfoByTvdbId(ruleset.media.media_tvdbId);
  if (!tvdbData?.episodes?.length) return null;

  const season = extractValueUsingRegex(item, ruleset.seasonRegex);
  const episode = extractValueUsingRegex(item, ruleset.episodeRegex);

  if (!season || !episode) return null;

  const seasonNum = parseInt(season);
  const episodeNum = parseInt(episode);
  if (isNaN(seasonNum) || isNaN(episodeNum)) return null;

  const matchedEpisode = findEpisodeBySeasonAndNumber(tvdbData, seasonNum, episodeNum);
  if (!matchedEpisode) return null;

  return {
    episode: matchedEpisode,
    item,
    showName: tvdbData.name || tvdbData.germanName || "",
    matchedTitle: `S${season}E${episode}`,
  };
}

async function matchesItemTitleIncludes(
  item: ApiResultItem,
  ruleset: Ruleset
): Promise<MatchedEpisodeInfo | null> {
  const tvdbData = await getShowInfoByTvdbId(ruleset.media.media_tvdbId);
  if (!tvdbData?.episodes?.length) return null;

  const constructedTitle = buildTitleFromRegexRules(item, ruleset.titleRegexRules);
  if (!constructedTitle) return null;

  const matchedEpisode = tvdbData.episodes.find((ep) =>
    formatTitle(ep.name).toLowerCase().includes(formatTitle(constructedTitle).toLowerCase())
  );

  if (!matchedEpisode) return null;

  return {
    episode: matchedEpisode,
    item,
    showName: tvdbData.name || tvdbData.germanName || "",
    matchedTitle: constructedTitle,
  };
}

async function matchesItemTitleExact(
  item: ApiResultItem,
  ruleset: Ruleset
): Promise<MatchedEpisodeInfo | null> {
  const tvdbData = await getShowInfoByTvdbId(ruleset.media.media_tvdbId);
  if (!tvdbData?.episodes?.length) return null;

  const constructedTitle = buildTitleFromRegexRules(item, ruleset.titleRegexRules);
  if (!constructedTitle) return null;

  const formattedTitle = formatTitle(constructedTitle).toLowerCase();

  const matchedEpisodes = tvdbData.episodes.filter(
    (ep) => formatTitle(ep.name).toLowerCase() === formattedTitle
  );

  let matchedEpisode: TvdbEpisode | undefined;
  if (matchedEpisodes.length === 1) {
    matchedEpisode = matchedEpisodes[0];
  } else if (matchedEpisodes.length > 1) {
    // Try to match by aired date
    const itemDate = new Date(item.filmlisteTimestamp * 1000);
    matchedEpisode = matchedEpisodes.find((ep) => {
      if (!ep.aired) return false;
      const epDate = new Date(ep.aired);
      return epDate.toDateString() === itemDate.toDateString();
    });
    // Fallback to newest
    if (!matchedEpisode) {
      matchedEpisode = matchedEpisodes.sort((a, b) => {
        const aDate = a.aired ? new Date(a.aired).getTime() : 0;
        const bDate = b.aired ? new Date(b.aired).getTime() : 0;
        return bDate - aDate;
      })[0];
    }
  }

  if (!matchedEpisode) return null;

  return {
    episode: matchedEpisode,
    item,
    showName: tvdbData.name || tvdbData.germanName || "",
    matchedTitle: constructedTitle,
  };
}

async function matchesItemTitleEqualsAirdate(
  item: ApiResultItem,
  ruleset: Ruleset
): Promise<MatchedEpisodeInfo | null> {
  const tvdbData = await getShowInfoByTvdbId(ruleset.media.media_tvdbId);
  if (!tvdbData?.episodes?.length) return null;

  const constructedTitle = buildTitleFromRegexRules(item, ruleset.titleRegexRules);
  if (!constructedTitle) return null;

  const parsedDate = tryParseDate(constructedTitle);
  if (!parsedDate) return null;

  const matchedEpisode = findEpisodeByAirDate(tvdbData, parsedDate);
  if (!matchedEpisode) return null;

  return {
    episode: matchedEpisode,
    item,
    showName: tvdbData.name || tvdbData.germanName || "",
    matchedTitle: constructedTitle,
  };
}

async function applyRulesetFilters(
  results: ApiResultItem[],
  tvdbData?: TvdbData
): Promise<{ matchedEpisodes: MatchedEpisodeInfo[]; unmatchedItems: ApiResultItem[] }> {
  await ensureRulesetsLoaded();

  const matchedEpisodes: MatchedEpisodeInfo[] = [];
  const unmatchedItems: ApiResultItem[] = [...results];

  // Log available rulesets for debugging
  if (tvdbData) {
    const allTopics = getAllTopics();
    console.log(`[Mediathek] Rulesets available: ${allTopics.length} topics`);

    // Check if any ruleset exists for this TVDB ID
    let foundRulesetForTvdbId = false;
    for (const topic of allTopics) {
      const rulesets = getRulesetsForTopicAndTvdbId(topic, tvdbData.id);
      if (rulesets.length > 0) {
        console.log(
          `[Mediathek] Found ${rulesets.length} ruleset(s) for topic "${topic}" with tvdbId ${tvdbData.id}`
        );
        foundRulesetForTvdbId = true;
      }
    }
    if (!foundRulesetForTvdbId) {
      console.log(
        `[Mediathek] WARNING: No rulesets found for tvdbId ${tvdbData.id} (${tvdbData.name})`
      );
    }
  }

  let checkedCount = 0;
  for (const item of results) {
    if (shouldSkipItem(item)) {
      const idx = unmatchedItems.indexOf(item);
      if (idx > -1) unmatchedItems.splice(idx, 1);
      continue;
    }

    const rulesets = tvdbData
      ? getRulesetsForTopicAndTvdbId(item.topic, tvdbData.id)
      : getRulesetsForTopic(item.topic);

    // Log first few items to show what's being checked
    if (checkedCount < 5) {
      console.log(
        `[Mediathek] Checking item: topic="${item.topic}", title="${item.title}", rulesets found: ${rulesets.length}`
      );
      checkedCount++;
    }

    for (const ruleset of rulesets) {
      // Parse filters from JSON string
      let filters: Filter[];
      try {
        filters = JSON.parse(ruleset.filters);
      } catch {
        filters = [];
      }

      if (!filters.every((filter) => filterMatches(item, filter))) {
        const idx = unmatchedItems.indexOf(item);
        if (idx > -1) unmatchedItems.splice(idx, 1);
        continue;
      }

      let matchInfo: MatchedEpisodeInfo | null = null;

      switch (ruleset.matchingStrategy) {
        case "SeasonAndEpisodeNumber" as MatchingStrategy:
          matchInfo = await matchesSeasonAndEpisode(item, ruleset);
          break;
        case "ItemTitleIncludes" as MatchingStrategy:
          matchInfo = await matchesItemTitleIncludes(item, ruleset);
          break;
        case "ItemTitleExact" as MatchingStrategy:
          matchInfo = await matchesItemTitleExact(item, ruleset);
          break;
        case "ItemTitleEqualsAirdate" as MatchingStrategy:
          matchInfo = await matchesItemTitleEqualsAirdate(item, ruleset);
          break;
      }

      if (matchInfo) {
        matchedEpisodes.push(matchInfo);
        break;
      } else {
        const idx = unmatchedItems.indexOf(item);
        if (idx > -1) unmatchedItems.splice(idx, 1);
      }
    }
  }

  return { matchedEpisodes, unmatchedItems };
}

function getDesiredEpisodes(
  tvdbData: TvdbData,
  season: string | null,
  episodeNumber: string | null
): TvdbEpisode[] | null {
  if (!season) return null;

  const desiredEpisodes: TvdbEpisode[] = [];

  if (!episodeNumber) {
    const seasonNum = parseInt(season);
    if (!isNaN(seasonNum)) {
      desiredEpisodes.push(...findEpisodesBySeason(tvdbData, seasonNum));
    }

    // Check if season is a year
    if (season.length === 4) {
      const year = parseInt(season);
      if (year >= 1900 && year <= 2100) {
        const yearEpisodes = findEpisodesByAirYear(tvdbData, year);
        for (const ep of yearEpisodes) {
          if (
            !desiredEpisodes.some(
              (d) => d.seasonNumber === ep.seasonNumber && d.episodeNumber === ep.episodeNumber
            )
          ) {
            desiredEpisodes.push(ep);
          }
        }
      }
    }
  } else {
    // Handle daily format (season is year, episode is MM/DD)
    if (season.length === 4 && episodeNumber.includes("/")) {
      const parts = episodeNumber.split("/");
      if (parts.length === 2) {
        const dateStr = `${season}-${parts[0]}-${parts[1]}`;
        const searchDate = new Date(dateStr);
        if (!isNaN(searchDate.getTime())) {
          const ep = findEpisodeByAirDate(tvdbData, searchDate);
          if (ep) desiredEpisodes.push(ep);
        }
      }
    } else {
      const seasonNum = parseInt(season);
      const episodeNum = parseInt(episodeNumber);
      if (!isNaN(seasonNum) && !isNaN(episodeNum)) {
        const ep = findEpisodeBySeasonAndNumber(tvdbData, seasonNum, episodeNum);
        if (ep) desiredEpisodes.push(ep);
      }
    }
  }

  return desiredEpisodes;
}

function applyDesiredEpisodeFilter(
  matchedEpisodes: MatchedEpisodeInfo[],
  desiredEpisodes: TvdbEpisode[] | null
): MatchedEpisodeInfo[] {
  if (!desiredEpisodes) return matchedEpisodes;

  return matchedEpisodes.filter((matched) =>
    desiredEpisodes.some(
      (desired) =>
        desired.seasonNumber === matched.episode.seasonNumber &&
        desired.episodeNumber === matched.episode.episodeNumber
    )
  );
}

export async function fetchSearchResultsById(
  tvdbData: TvdbData,
  season: string | null,
  episodeNumber: string | null,
  limit: number,
  offset: number
): Promise<string> {
  console.log(
    `[Mediathek] fetchSearchResultsById: tvdbId=${tvdbData.id}, name="${tvdbData.name}", germanName="${tvdbData.germanName}", season=${season}, episode=${episodeNumber}`
  );

  const cacheKey = `tvdb_${tvdbData.id}_${season ?? "null"}_${episodeNumber ?? "null"}_${limit}_${offset}`;

  const cached = mediathekCache.get(cacheKey);
  if (cached && typeof cached === "object" && "response" in cached) {
    console.log(`[Mediathek] Returning cached response for ${cacheKey}`);
    return (cached as { response: string }).response;
  }

  const desiredEpisodes = getDesiredEpisodes(tvdbData, season, episodeNumber);
  console.log(`[Mediathek] Desired episodes: ${desiredEpisodes?.length ?? 0}`);
  if (season && desiredEpisodes?.length === 0) {
    console.log(`[Mediathek] No desired episodes found for season=${season}, returning empty`);
    const response = serializeRss(getEmptyRssResult());
    mediathekCache.set(cacheKey, { response });
    return response;
  }

  // Check for cached API response
  const apiCacheKey = `mediathekapi_${tvdbData.id}`;
  let apiResponse: string;
  const cachedApi = mediathekCache.get(apiCacheKey);

  if (cachedApi) {
    console.log(`[Mediathek] Using cached API response for ${apiCacheKey}`);
    apiResponse = (cachedApi as { response: string }).response;
  } else {
    const searchQuery = tvdbData.germanName || tvdbData.name;
    console.log(`[Mediathek] Searching MediathekView API with query: "${searchQuery}"`);
    const queries = [{ fields: QUERY_FIELDS, query: searchQuery }];
    apiResponse = await fetchMediathekViewApiResponse(queries, 10000);

    if (!apiResponse) {
      return serializeRss(getEmptyRssResult());
    }

    mediathekCache.set(apiCacheKey, { response: apiResponse });
  }

  let results: ApiResultItem[];
  try {
    const parsed: MediathekApiResponse = JSON.parse(apiResponse);
    results = parsed.result?.results || [];
    console.log(`[Mediathek] API returned ${results.length} results`);
    if (results.length > 0) {
      const uniqueTopics = [...new Set(results.map((r) => r.topic))];
      console.log(
        `[Mediathek] Unique topics in results: ${uniqueTopics.slice(0, 10).join(", ")}${uniqueTopics.length > 10 ? ` ... (${uniqueTopics.length} total)` : ""}`
      );
    }
  } catch {
    console.log(`[Mediathek] Failed to parse API response`);
    return serializeRss(getEmptyRssResult());
  }

  const { matchedEpisodes } = await applyRulesetFilters(results, tvdbData);
  console.log(`[Mediathek] Matched episodes after ruleset filtering: ${matchedEpisodes.length}`);

  const matchedDesiredEpisodes = applyDesiredEpisodeFilter(matchedEpisodes, desiredEpisodes);
  console.log(`[Mediathek] Matched desired episodes: ${matchedDesiredEpisodes.length}`);

  const newznabItems: NewznabItem[] = matchedDesiredEpisodes.flatMap(generateRssItems);
  console.log(`[Mediathek] Generated ${newznabItems.length} Newznab items`);

  const response = convertItemsToRss(newznabItems, limit, offset);

  mediathekCache.set(cacheKey, { response });
  return response;
}

export async function fetchSearchResultsByString(
  q: string | null,
  season: string | null,
  limit: number,
  offset: number
): Promise<string> {
  const cacheKey = `q_${q ?? "null"}_${season ?? "null"}_${limit}_${offset}`;

  const cached = mediathekCache.get(cacheKey);
  if (cached) {
    return (cached as { response: string }).response;
  }

  const apiCacheKey = `mediathekapi_${q ?? "null"}_${season ?? "null"}`;
  let apiResponse: string;
  const cachedApi = mediathekCache.get(apiCacheKey);

  if (cachedApi) {
    apiResponse = (cachedApi as { response: string }).response;
  } else {
    const queries: Array<{ fields: string[]; query: string }> = [];

    if (q) {
      queries.push({ fields: QUERY_FIELDS, query: q });
    }

    if (season) {
      const zeroPadded = season.length >= 2 ? season : `0${season}`;
      queries.push({ fields: ["title"], query: `S${zeroPadded}` });
    }

    apiResponse = await fetchMediathekViewApiResponse(queries, 1500);

    if (!apiResponse) {
      return serializeRss(getEmptyRssResult());
    }

    mediathekCache.set(apiCacheKey, { response: apiResponse });
  }

  let results: ApiResultItem[];
  try {
    const parsed: MediathekApiResponse = JSON.parse(apiResponse);
    results = parsed.result?.results || [];
  } catch {
    return serializeRss(getEmptyRssResult());
  }

  const { matchedEpisodes } = await applyRulesetFilters(results);
  const newznabItems: NewznabItem[] = matchedEpisodes.flatMap(generateRssItems);
  const response = convertItemsToRss(newznabItems, limit, offset);

  mediathekCache.set(cacheKey, { response });
  return response;
}

export async function fetchSearchResultsForRssSync(limit: number, offset: number): Promise<string> {
  const cacheKey = `rss_${limit}_${offset}`;

  const cached = mediathekCache.get(cacheKey);
  if (cached) {
    return (cached as { response: string }).response;
  }

  const apiCacheKey = "rss_mediathekview_results";
  let results: ApiResultItem[];
  const cachedApi = mediathekCache.get(apiCacheKey);

  if (cachedApi) {
    results = (cachedApi as { results: ApiResultItem[] }).results;
  } else {
    const apiResponse = await fetchMediathekViewApiResponse([], 6000);

    if (!apiResponse) {
      return serializeRss(getEmptyRssResult());
    }

    try {
      const parsed: MediathekApiResponse = JSON.parse(apiResponse);
      results = parsed.result?.results || [];
    } catch {
      return serializeRss(getEmptyRssResult());
    }

    mediathekCache.set(apiCacheKey, { results });
  }

  const { matchedEpisodes } = await applyRulesetFilters(results);
  const newznabItems: NewznabItem[] = matchedEpisodes.flatMap(generateRssItems);
  const response = convertItemsToRss(newznabItems, limit, offset);

  mediathekCache.set(cacheKey, { response });
  return response;
}
