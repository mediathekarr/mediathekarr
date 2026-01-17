import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

export interface QueueItem {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  timeleft: string;
  cat: string;
  mb: string;
  mbleft: string;
  speed: string;
}

export interface HistoryItem {
  nzo_id: string;
  name: string;
  status: string;
  completed: number;
  category: string;
  storage: string;
  bytes: number;
  fail_message: string;
}

export interface SabnzbdQueue {
  slots: QueueItem[];
}

export interface SabnzbdHistory {
  slots: HistoryItem[];
}

// Extract filename and URL from NZB content
const FILE_NAME_REGEX = /filename="([^"]+)\.nzb"/;
const URL_REGEX = /<!--\s*(https?:\/\/[^\s]+)\s*-->/;

export function parseNzbContent(nzbContent: string): { fileName: string; url: string } | null {
  const filenameMatch = nzbContent.match(FILE_NAME_REGEX);
  const urlMatch = nzbContent.match(URL_REGEX);

  if (!filenameMatch || !urlMatch) {
    return null;
  }

  return {
    fileName: filenameMatch[1],
    url: urlMatch[1],
  };
}

export async function addToQueue(
  url: string,
  title: string,
  category: string
): Promise<{ id: string }> {
  const download = await prisma.download.create({
    data: {
      id: uuidv4(),
      title,
      url,
      category,
      status: "queued",
      progress: 0,
    },
  });

  // Trigger download processing asynchronously
  // Import dynamically to avoid circular dependencies and ensure server-side only
  triggerDownloadProcessing();

  return { id: download.id };
}

// Trigger download processing without blocking
function triggerDownloadProcessing(): void {
  // Use dynamic import to load the download manager only on server-side
  import("@/server/download-manager")
    .then(({ startDownloadProcessing }) => {
      startDownloadProcessing().catch(console.error);
    })
    .catch((err) => {
      console.error("Failed to load download manager:", err);
    });
}

export async function getQueue(): Promise<SabnzbdQueue> {
  const downloads = await prisma.download.findMany({
    where: {
      status: { in: ["queued", "downloading", "converting"] },
    },
    orderBy: { createdAt: "asc" },
  });

  const slots: QueueItem[] = downloads.map((d) => {
    let statusText = "Queued";
    if (d.status === "downloading") statusText = "Downloading";
    else if (d.status === "converting") statusText = "Extracting";

    // Convert BigInt to Number for arithmetic operations
    const totalSizeNum = Number(d.totalSize);
    const downloadedBytesNum = Number(d.downloadedBytes);
    const speedNum = Number(d.speed);

    const totalMb = (totalSizeNum / 1024 / 1024).toFixed(1);
    const remainingBytes = totalSizeNum - downloadedBytesNum;
    const speedMbps = (speedNum / 1024 / 1024).toFixed(1);

    // Calculate time left
    let timeleft = "";
    if (d.status === "downloading" && speedNum > 0) {
      const secondsLeft = Math.round(remainingBytes / speedNum);
      const hours = Math.floor(secondsLeft / 3600);
      const minutes = Math.floor((secondsLeft % 3600) / 60);
      const seconds = secondsLeft % 60;
      if (hours > 0) {
        timeleft = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      } else {
        timeleft = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }
    } else if (d.status === "converting") {
      timeleft = "Konvertiere...";
    }

    return {
      nzo_id: d.id,
      filename: d.title,
      status: statusText,
      percentage: d.progress.toString(),
      timeleft,
      cat: d.category,
      mb: totalMb,
      mbleft: (remainingBytes / 1024 / 1024).toFixed(1),
      speed: d.status === "downloading" ? `${speedMbps} MB/s` : "",
    };
  });

  return { slots };
}

export async function getHistory(): Promise<SabnzbdHistory> {
  const downloads = await prisma.download.findMany({
    where: {
      status: { in: ["completed", "failed"] },
    },
    orderBy: { completedAt: "desc" },
  });

  const slots: HistoryItem[] = downloads.map((d) => {
    // SABnzbd returns the folder path, not the file path
    // Sonarr scans this folder for video files
    let storagePath = "";
    if (d.filePath) {
      storagePath = path.dirname(d.filePath);
    }

    return {
      nzo_id: d.id,
      name: d.title,
      status: d.status === "completed" ? "Completed" : "Failed",
      completed: d.completedAt ? Math.floor(d.completedAt.getTime() / 1000) : 0,
      category: d.category,
      storage: storagePath,
      bytes: Number(d.size),
      fail_message: d.error || "",
    };
  });

  return { slots };
}

export async function deleteHistoryItem(nzoId: string, delFiles: boolean): Promise<boolean> {
  const download = await prisma.download.findUnique({
    where: { id: nzoId },
  });

  if (!download) {
    return false;
  }

  // Delete the file if requested
  if (delFiles && download.filePath) {
    try {
      const fs = await import("fs/promises");
      await fs.unlink(download.filePath);
    } catch {
      // File might not exist, ignore error
    }
  }

  await prisma.download.delete({
    where: { id: nzoId },
  });

  return true;
}

export async function retryDownload(nzoId: string): Promise<{ id: string } | null> {
  const download = await prisma.download.findUnique({
    where: { id: nzoId },
  });

  if (!download) {
    return null;
  }

  // Delete the old entry
  await prisma.download.delete({
    where: { id: nzoId },
  });

  // Re-add to queue
  return addToQueue(download.url, download.title, download.category);
}

export function getConfigResponse(): object {
  const downloadPath = process.env.DOWNLOAD_FOLDER_PATH || "/downloads";

  return {
    config: {
      misc: {
        complete_dir: downloadPath,
        enable_tv_sorting: false,
        enable_movie_sorting: false,
        pre_check: false,
        history_retention: "all",
      },
      categories: [
        { name: "sonarr", pp: "", script: "Default", dir: "", priority: -100 },
        { name: "tv", pp: "", script: "Default", dir: "", priority: -100 },
        { name: "radarr", pp: "", script: "Default", dir: "", priority: -100 },
        { name: "movies", pp: "", script: "Default", dir: "", priority: -100 },
        { name: "sonarr_blackhole", pp: "", script: "Default", dir: "", priority: -100 },
        { name: "radarr_blackhole", pp: "", script: "Default", dir: "", priority: -100 },
      ],
      sorters: [],
    },
  };
}
