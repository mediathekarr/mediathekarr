import { NextRequest, NextResponse } from "next/server";
import {
  getQueue,
  getHistory,
  deleteHistoryItem,
  addToQueue,
  parseNzbContent,
  getConfigResponse,
  retryDownload,
} from "@/services/download";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode");
  const name = searchParams.get("name");
  const value = searchParams.get("value");
  const delFiles = searchParams.get("del_files") === "1";

  switch (mode) {
    case "version":
      return NextResponse.json({ version: "4.3.3" });

    case "get_config":
      return NextResponse.json(await getConfigResponse());

    case "queue": {
      const queue = await getQueue();
      return NextResponse.json({ queue });
    }

    case "history": {
      // Handle history deletion
      if (name === "delete" && value) {
        const isDeleted = await deleteHistoryItem(value, delFiles);
        if (isDeleted) {
          return NextResponse.json({ status: true });
        }
        return NextResponse.json({ status: false, error: "Item not found" }, { status: 404 });
      }

      // Handle retry
      if (name === "retry" && value) {
        const result = await retryDownload(value);
        if (result) {
          return NextResponse.json({ status: true, nzo_id: result.id });
        }
        return NextResponse.json({ status: false, error: "Item not found" }, { status: 404 });
      }

      // Return history list
      const history = await getHistory();
      return NextResponse.json({ history });
    }

    default:
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode");
  const cat = searchParams.get("cat") || "default";

  if (mode !== "addfile") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    // Read the NZB content from the request body
    const nzbContent = await request.text();

    const parsed = parseNzbContent(nzbContent);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid NZB format" }, { status: 400 });
    }

    const { fileName, url } = parsed;

    // Add to the download queue
    const queueItem = await addToQueue(url, fileName, cat);

    return NextResponse.json({
      status: true,
      nzo_ids: [queueItem.id],
    });
  } catch (error) {
    console.error("Error adding file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
