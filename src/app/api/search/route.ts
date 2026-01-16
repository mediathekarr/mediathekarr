import { NextRequest, NextResponse } from "next/server";

const MEDIATHEK_API_URL = "https://mediathekviewweb.de/api/query";

export interface SearchResult {
  id: string;
  channel: string;
  topic: string;
  title: string;
  description: string;
  timestamp: number;
  duration: number;
  size: number;
  url_video: string;
  url_video_hd: string;
  url_website: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [], error: "Query too short" });
  }

  try {
    const requestBody = {
      queries: [{ fields: ["topic", "title"], query: q }],
      sortBy: "filmlisteTimestamp",
      sortOrder: "desc",
      future: true,
      offset: 0,
      size: limit,
    };

    const response = await fetch(MEDIATHEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      return NextResponse.json({ results: [], error: "API error" }, { status: 500 });
    }

    const data = await response.json();
    const items = data.result?.results || [];

    // Filter out m3u8 streams and transform results
    const results: SearchResult[] = items
      .filter((item: { url_video: string; title: string }) =>
        !item.url_video.endsWith(".m3u8") &&
        !item.title.includes("Audiodeskription") &&
        !item.title.includes("Hörfassung")
      )
      .map((item: {
        channel: string;
        topic: string;
        title: string;
        description: string;
        filmlisteTimestamp: number;
        duration: number;
        size: number;
        url_video: string;
        url_video_hd: string;
        url_website: string;
      }) => ({
        id: `${item.channel}-${item.topic}-${item.title}-${item.filmlisteTimestamp}`,
        channel: item.channel,
        topic: item.topic,
        title: item.title,
        description: item.description,
        timestamp: item.filmlisteTimestamp,
        duration: item.duration,
        size: item.size,
        url_video: item.url_video,
        url_video_hd: item.url_video_hd || item.url_video,
        url_website: item.url_website,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
