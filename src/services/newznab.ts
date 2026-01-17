import { Builder } from "xml2js";
import type {
  NewznabRss,
  NewznabItem,
  NewznabAttribute,
  MatchedEpisodeInfo,
  TvdbEpisode,
  EpisodeType,
  TmdbMovieData,
  ApiResultItem,
} from "@/types";
import type { MovieMatchResult } from "./movie-matcher";

const XML_BUILDER = new Builder({
  xmldec: { version: "1.0", encoding: "UTF-8" },
  renderOpts: { pretty: true },
});

export function generateAttributes(
  season: string | null,
  categoryValues: string[],
  tvdbId?: number
): NewznabAttribute[] {
  const attributes: NewznabAttribute[] = [];

  for (const categoryValue of categoryValues) {
    attributes.push({ name: "category", value: categoryValue });
  }

  if (season) {
    attributes.push({ name: "season", value: season });
  }

  if (tvdbId) {
    attributes.push({ name: "tvdbid", value: tvdbId.toString() });
  }

  return attributes;
}

export function getEmptyRssResult(): NewznabRss {
  return {
    channel: {
      title: "RundfunkArr",
      description: "RundfunkArr API results",
      response: {
        offset: 0,
        total: 0,
      },
      items: [],
    },
  };
}

export function serializeRss(rss: NewznabRss): string {
  const xmlObj = {
    rss: {
      $: {
        version: "2.0",
        "xmlns:newznab": "http://www.newznab.com/DTD/2010/feeds/attributes/",
      },
      channel: {
        title: rss.channel.title,
        description: rss.channel.description,
        "newznab:response": {
          $: {
            offset: rss.channel.response.offset,
            total: rss.channel.response.total,
          },
        },
        item: rss.channel.items.map((item) => ({
          title: item.title,
          guid: {
            $: { isPermaLink: item.guid.isPermaLink },
            _: item.guid.value,
          },
          link: item.link,
          comments: item.comments,
          pubDate: item.pubDate,
          category: item.category,
          description: item.description,
          enclosure: {
            $: {
              url: item.enclosure.url,
              length: item.enclosure.length,
              type: item.enclosure.type,
            },
          },
          "newznab:attr": item.attributes.map((attr) => ({
            $: { name: attr.name, value: attr.value },
          })),
        })),
      },
    },
  };

  return XML_BUILDER.buildObject(xmlObj);
}

export function convertItemsToRss(items: NewznabItem[], limit: number, offset: number): string {
  if (!items || items.length === 0) {
    return serializeRss(getEmptyRssResult());
  }

  const paginatedItems = items.slice(offset, offset + limit);

  const rss: NewznabRss = {
    channel: {
      title: "RundfunkArr",
      description: "RundfunkArr API results",
      response: {
        offset: offset,
        total: items.length,
      },
      items: paginatedItems,
    },
  };

  return serializeRss(rss);
}

// Title formatting utilities
function formatTitle(title: string): string {
  // Replace German Umlaute and special characters
  let formatted = title
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue");

  // Replace & with and
  formatted = formatted.replace(/&/g, "and");

  // Remove unwanted symbols
  formatted = formatted.replace(/[/:;,""''@#?$%^*+=!|<>,()]/g, "");

  // Replace whitespace with dots
  formatted = formatted.replace(/\s+/g, ".").replace(/\.\./g, ".");

  return formatted;
}

function getPaddedSeason(episode: TvdbEpisode): string {
  return episode.seasonNumber.toString().padStart(2, "0");
}

function getPaddedEpisode(episode: TvdbEpisode): string {
  return episode.episodeNumber.toString().padStart(2, "0");
}

function generateTitle(
  info: MatchedEpisodeInfo,
  quality: string,
  episodeType: EpisodeType
): string {
  const episode = info.episode;

  if (episodeType === "daily") {
    const aired = episode.aired ? new Date(episode.aired) : new Date();
    const dateStr = aired.toISOString().split("T")[0]; // yyyy-MM-dd
    return `${info.showName}.${dateStr}.${episode.name}.GERMAN.${quality}.WEB.h264-MEDiATHEK`.replace(
      / /g,
      "."
    );
  }

  return `${info.showName}.S${getPaddedSeason(episode)}E${getPaddedEpisode(episode)}.${episode.name}.GERMAN.${quality}.WEB.h264-MEDiATHEK`.replace(
    / /g,
    "."
  );
}

function createRssItem(
  info: MatchedEpisodeInfo,
  quality: string,
  sizeMultiplier: number,
  category: string,
  categoryValues: string[],
  url: string,
  episodeType: EpisodeType
): NewznabItem {
  const adjustedSize = Math.floor(info.item.size * sizeMultiplier);
  const parsedTitle = generateTitle(info, quality, episodeType);
  const formattedTitle = formatTitle(parsedTitle);

  const encodedTitle = Buffer.from(formattedTitle).toString("base64");
  const encodedUrl = Buffer.from(url).toString("base64");

  const fakeDownloadUrl = `/api/newznab/fake_nzb_download?encodedUrl=${encodedUrl}&encodedTitle=${encodedTitle}`;
  const item = info.item;

  return {
    title: formattedTitle,
    guid: {
      isPermaLink: true,
      value: `${item.url_website}#${quality}${episodeType === "daily" ? "" : "-d"}`,
    },
    link: url,
    comments: item.url_website,
    pubDate: new Date(item.filmlisteTimestamp * 1000).toUTCString(),
    category: category,
    description: item.description,
    enclosure: {
      url: fakeDownloadUrl,
      length: adjustedSize,
      type: "application/x-nzb",
    },
    attributes: generateAttributes(getPaddedSeason(info.episode), categoryValues, info.tvdbId),
  };
}

function createRssItems(
  info: MatchedEpisodeInfo,
  quality: string,
  sizeMultiplier: number,
  category: string,
  categoryValues: string[],
  url: string
): NewznabItem[] {
  const items: NewznabItem[] = [
    createRssItem(
      info,
      quality,
      sizeMultiplier,
      category,
      categoryValues,
      url,
      "standard" as EpisodeType
    ),
  ];

  // Also create daily type if season is a year
  if (info.episode.seasonNumber > 1950) {
    items.push(
      createRssItem(
        info,
        quality,
        sizeMultiplier,
        category,
        categoryValues,
        url,
        "daily" as EpisodeType
      )
    );
  }

  return items;
}

export type QualityPreference = "all" | "best" | "1080p" | "720p" | "480p";

export function generateRssItems(
  info: MatchedEpisodeInfo,
  qualityPreference: QualityPreference = "all"
): NewznabItem[] {
  const items: NewznabItem[] = [];
  const baseCategories = ["5000", "2000"];

  const has1080p = !!info.item.url_video_hd;
  const has720p = !!info.item.url_video;
  const has480p = !!info.item.url_video_low;

  // Determine which qualities to include based on preference
  let include1080p = false;
  let include720p = false;
  let include480p = false;

  switch (qualityPreference) {
    case "all":
      include1080p = has1080p;
      include720p = has720p;
      include480p = has480p;
      break;
    case "best":
      // Only include the best available quality
      if (has1080p) {
        include1080p = true;
      } else if (has720p) {
        include720p = true;
      } else if (has480p) {
        include480p = true;
      }
      break;
    case "1080p":
      include1080p = has1080p;
      break;
    case "720p":
      include720p = has720p;
      break;
    case "480p":
      include480p = has480p;
      break;
  }

  if (include1080p) {
    items.push(
      ...createRssItems(
        info,
        "1080p",
        1.6,
        "TV > HD",
        [...baseCategories, "5040", "2040"],
        info.item.url_video_hd
      )
    );
  }

  if (include720p) {
    items.push(
      ...createRssItems(
        info,
        "720p",
        1.0,
        "TV > HD",
        [...baseCategories, "5040", "2040"],
        info.item.url_video
      )
    );
  }

  if (include480p) {
    items.push(
      ...createRssItems(
        info,
        "480p",
        0.4,
        "TV > SD",
        [...baseCategories, "5030", "2030"],
        info.item.url_video_low
      )
    );
  }

  return items;
}

// ============== MOVIE RSS GENERATION ==============

function generateMovieAttributes(
  categoryValues: string[],
  tmdbId?: number,
  imdbId?: string | null
): NewznabAttribute[] {
  const attributes: NewznabAttribute[] = [];

  for (const categoryValue of categoryValues) {
    attributes.push({ name: "category", value: categoryValue });
  }

  if (tmdbId) {
    attributes.push({ name: "tmdbid", value: tmdbId.toString() });
  }

  if (imdbId) {
    attributes.push({ name: "imdbid", value: imdbId });
  }

  return attributes;
}

function generateMovieTitle(movieData: TmdbMovieData, quality: string): string {
  const year = movieData.releaseDate ? movieData.releaseDate.split("-")[0] : "";
  const title = movieData.germanTitle || movieData.title;
  const yearPart = year ? `.${year}` : "";

  return `${title}${yearPart}.GERMAN.${quality}.WEB.h264-MEDiATHEK`.replace(/ /g, ".");
}

function createMovieRssItem(
  item: ApiResultItem,
  movieData: TmdbMovieData,
  quality: string,
  sizeMultiplier: number,
  category: string,
  categoryValues: string[],
  url: string
): NewznabItem {
  const adjustedSize = Math.floor(item.size * sizeMultiplier);
  const parsedTitle = generateMovieTitle(movieData, quality);
  const formattedTitle = formatTitle(parsedTitle);

  const encodedTitle = Buffer.from(formattedTitle).toString("base64");
  const encodedUrl = Buffer.from(url).toString("base64");

  const fakeDownloadUrl = `/api/newznab/fake_nzb_download?encodedUrl=${encodedUrl}&encodedTitle=${encodedTitle}`;

  return {
    title: formattedTitle,
    guid: {
      isPermaLink: true,
      value: `${item.url_website}#movie-${quality}`,
    },
    link: url,
    comments: item.url_website,
    pubDate: new Date(item.filmlisteTimestamp * 1000).toUTCString(),
    category: category,
    description: item.description,
    enclosure: {
      url: fakeDownloadUrl,
      length: adjustedSize,
      type: "application/x-nzb",
    },
    attributes: generateMovieAttributes(categoryValues, movieData.tmdbId, movieData.imdbId),
  };
}

/**
 * Generate RSS items for a movie match
 */
export function generateMovieRssItems(
  matchResult: MovieMatchResult,
  movieData: TmdbMovieData,
  qualityPreference: QualityPreference = "all"
): NewznabItem[] {
  const items: NewznabItem[] = [];
  const item = matchResult.item;

  // Movie categories (2000 = Movies)
  const baseCategories = ["2000"];

  const has1080p = !!item.url_video_hd;
  const has720p = !!item.url_video;
  const has480p = !!item.url_video_low;

  let include1080p = false;
  let include720p = false;
  let include480p = false;

  switch (qualityPreference) {
    case "all":
      include1080p = has1080p;
      include720p = has720p;
      include480p = has480p;
      break;
    case "best":
      if (has1080p) {
        include1080p = true;
      } else if (has720p) {
        include720p = true;
      } else if (has480p) {
        include480p = true;
      }
      break;
    case "1080p":
      include1080p = has1080p;
      break;
    case "720p":
      include720p = has720p;
      break;
    case "480p":
      include480p = has480p;
      break;
  }

  if (include1080p) {
    items.push(
      createMovieRssItem(
        item,
        movieData,
        "1080p",
        1.6,
        "Movies > HD",
        [...baseCategories, "2040"],
        item.url_video_hd
      )
    );
  }

  if (include720p) {
    items.push(
      createMovieRssItem(
        item,
        movieData,
        "720p",
        1.0,
        "Movies > HD",
        [...baseCategories, "2040"],
        item.url_video
      )
    );
  }

  if (include480p) {
    items.push(
      createMovieRssItem(
        item,
        movieData,
        "480p",
        0.4,
        "Movies > SD",
        [...baseCategories, "2030"],
        item.url_video_low
      )
    );
  }

  return items;
}

// Generate fake NZB file content
export function generateFakeNzb(url: string, title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <!-- ${url} -->
  <head>
    <meta type="title">${title}</meta>
  </head>
  <file poster="RundfunkArr" date="${Math.floor(Date.now() / 1000)}" subject="${title}">
    <groups>
      <group>alt.binaries.mediathek</group>
    </groups>
    <segments>
      <segment bytes="1024" number="1">${Buffer.from(url).toString("base64")}</segment>
    </segments>
  </file>
</nzb>`;
}

// Capabilities XML
export function getCapabilitiesXml(): string {
  const caps = {
    caps: {
      server: {
        $: {
          version: "1.0",
          title: "RundfunkArr",
          strapline: "German Public TV Indexer",
          email: "",
          url: "",
        },
      },
      limits: {
        $: {
          max: "100",
          default: "100",
        },
      },
      registration: {
        $: {
          available: "no",
          open: "no",
        },
      },
      searching: {
        search: { $: { available: "yes", supportedParams: "q" } },
        "tv-search": { $: { available: "yes", supportedParams: "q,tvdbid,season,ep" } },
        "movie-search": { $: { available: "yes", supportedParams: "q,tmdbid,imdbid" } },
      },
      categories: {
        category: [
          {
            $: { id: "5000", name: "TV" },
            subcat: [{ $: { id: "5030", name: "TV/SD" } }, { $: { id: "5040", name: "TV/HD" } }],
          },
          {
            $: { id: "2000", name: "Movies" },
            subcat: [
              { $: { id: "2030", name: "Movies/SD" } },
              { $: { id: "2040", name: "Movies/HD" } },
            ],
          },
        ],
      },
    },
  };

  return XML_BUILDER.buildObject(caps);
}
