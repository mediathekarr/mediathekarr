import { NextRequest, NextResponse } from "next/server";
import {
  fetchSearchResultsById,
  fetchSearchResultsByString,
  fetchSearchResultsForRssSync,
} from "@/services/mediathek";
import { getShowInfoByTvdbId } from "@/services/tmdb";
import { serializeRss, getEmptyRssResult } from "@/services/newznab";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const t = searchParams.get("t");
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const q = searchParams.get("q");
  const tvdbid = searchParams.get("tvdbid");
  const imdbid = searchParams.get("imdbid");
  const tmdbid = searchParams.get("tmdbid");
  const season = searchParams.get("season");
  const episode = searchParams.get("ep");

  // Handle capabilities request
  if (t === "caps") {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<caps>
    <limits max="5000" default="5000"/>
    <registration available="no" open="no"/>
    <searching>
        <search available="yes" supportedParams="q"/>
        <tv-search available="yes" supportedParams="q,season,ep,tvdbid"/>
        <movie-search available="yes" supportedParams="q,imdbid"/>
        <audio-search available="no" supportedParams="" />
    </searching>
    <categories>
        <category id="2000" name="Movies">
            <subcat id="2040" name="HD"/>
            <subcat id="2030" name="SD"/>
        </category>
        <category id="5000" name="TV">
            <subcat id="5040" name="HD"/>
            <subcat id="5030" name="SD"/>
        </category>
    </categories>
</caps>`;

    return new NextResponse(xmlContent, {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // Handle search requests
  if (t === "tvsearch" || t === "search" || t === "movie") {
    console.log(`[Newznab] Search request: t=${t}, q=${q}, tvdbid=${tvdbid}, season=${season}, episode=${episode}`);

    try {
      // Search by TVDB ID
      if (tvdbid) {
        const parsedTvdbId = parseInt(tvdbid, 10);
        console.log(`[Newznab] Searching by TVDB ID: ${parsedTvdbId}`);
        if (!isNaN(parsedTvdbId)) {
          const tvdbData = await getShowInfoByTvdbId(parsedTvdbId);
          console.log(`[Newznab] TVDB lookup result: ${tvdbData ? `Found "${tvdbData.name}" (German: "${tvdbData.germanName}")` : "Not found"}`);

          if (!tvdbData) {
            return new NextResponse(serializeRss(getEmptyRssResult()), {
              status: 200,
              headers: { "Content-Type": "application/xml; charset=utf-8" },
            });
          }

          const searchResults = await fetchSearchResultsById(
            tvdbData,
            season,
            episode,
            limit,
            offset
          );

          return new NextResponse(searchResults, {
            status: 200,
            headers: { "Content-Type": "application/xml; charset=utf-8" },
          });
        }
      }

      // RSS sync (no params) - return dummy result for Sonarr test
      if (!q && !season && !imdbid && !tvdbid && !tmdbid) {
        const searchResults = await fetchSearchResultsForRssSync(limit, offset);

        // If no results, return a dummy item so Sonarr accepts the indexer
        if (searchResults.includes('total="0"')) {
          const dummyRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:newznab="http://www.newznab.com/DTD/2010/feeds/attributes/">
  <channel>
    <title>MediathekArr</title>
    <description>MediathekArr API results</description>
    <newznab:response offset="0" total="1"/>
    <item>
      <title>MediathekArr Test - Indexer funktioniert</title>
      <guid>mediathekarr-test-item</guid>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <category>5000</category>
      <enclosure url="http://localhost/test.nzb" length="1000000" type="application/x-nzb"/>
      <newznab:attr name="category" value="5000"/>
      <newznab:attr name="size" value="1000000"/>
    </item>
  </channel>
</rss>`;
          return new NextResponse(dummyRss, {
            status: 200,
            headers: { "Content-Type": "application/xml; charset=utf-8" },
          });
        }

        return new NextResponse(searchResults, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      }

      // Search by query string
      const searchResults = await fetchSearchResultsByString(q, season, limit, offset);
      return new NextResponse(searchResults, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    } catch (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
