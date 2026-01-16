import { NextRequest, NextResponse } from "next/server";
import {
  fetchSearchResultsById,
  fetchSearchResultsByString,
  fetchSearchResultsForRssSync,
} from "@/services/mediathek";
import { getShowInfoByTvdbId } from "@/services/tvdb";
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
    try {
      // Search by TVDB ID
      if (tvdbid) {
        const parsedTvdbId = parseInt(tvdbid, 10);
        if (!isNaN(parsedTvdbId)) {
          const tvdbData = await getShowInfoByTvdbId(parsedTvdbId);

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

      // RSS sync (no params)
      if (!q && !season && !imdbid && !tvdbid && !tmdbid) {
        const searchResults = await fetchSearchResultsForRssSync(limit, offset);
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
