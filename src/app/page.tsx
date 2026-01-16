"use client";

import { useState, useEffect, useCallback } from "react";
import packageJson from "../../package.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
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

interface QueueSlot {
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

interface HistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  completed: number;
  category: string;
  storage: string;
  bytes: number;
  fail_message: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queue, setQueue] = useState<QueueSlot[]>([]);
  const [history, setHistory] = useState<HistorySlot[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchQueue = useCallback(async () => {
    try {
      const [queueRes, historyRes] = await Promise.all([
        fetch("/api/download?mode=queue"),
        fetch("/api/download?mode=history"),
      ]);
      const queueData = await queueRes.json();
      const historyData = await historyRes.json();
      setQueue(queueData.queue?.slots || []);
      setHistory(historyData.history?.slots || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDownload = async (result: SearchResult) => {
    // Create NZB content with URL - format must match parseNzbContent regex
    const fileName = `${result.topic} - ${result.title}`.replace(/[<>:"/\\|?*]/g, "_");
    const nzbContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.1//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.1.dtd">
<nzb xmlns="http://www.newzbin.com/DTD/2003/nzb">
  <head>
    <meta type="filename" filename="${fileName}.nzb"/>
  </head>
  <!-- ${result.url_video_hd || result.url_video} -->
</nzb>`;

    try {
      const res = await fetch("/api/download?mode=addfile&cat=default", {
        method: "POST",
        body: nzbContent,
      });
      const data = await res.json();
      if (data.status) {
        fetchQueue();
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleDelete = async (nzoId: string, delFiles: boolean = false) => {
    try {
      const res = await fetch(
        `/api/download?mode=history&name=delete&value=${nzoId}&del_files=${delFiles ? 1 : 0}`
      );
      const data = await res.json();
      if (data.status) {
        fetchQueue();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleRetry = async (nzoId: string) => {
    try {
      const res = await fetch(`/api/download?mode=history&name=retry&value=${nzoId}`);
      const data = await res.json();
      if (data.status) {
        fetchQueue();
      }
    } catch (error) {
      console.error("Retry failed:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "downloading":
        return <Badge className="bg-blue-500">Downloading</Badge>;
      case "extracting":
        return <Badge className="bg-yellow-500">Converting</Badge>;
      case "queued":
        return <Badge variant="secondary">Queued</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">MediathekArr</h1>
        <Badge variant="outline" className="text-xs">
          v{packageJson.version}
        </Badge>
      </div>

      {/* Search Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Mediathek durchsuchen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Suchbegriff eingeben..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Suche..." : "Suchen"}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result) => (
                <Card key={result.id} className="p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {result.channel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{result.topic}</span>
                      </div>
                      <h3 className="font-medium truncate">{result.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(result.timestamp)} • {formatDuration(result.duration)} •{" "}
                        {formatSize(result.size)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleDownload(result)}>
                      Download
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue & History Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Downloads</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                Aktualisiert: {lastRefresh.toLocaleTimeString("de-DE")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchQueue}>
                ↻ Aktualisieren
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="queue">
            <TabsList className="mb-4">
              <TabsTrigger value="queue">Queue ({queue.length})</TabsTrigger>
              <TabsTrigger value="history">History ({history.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="queue">
              {isLoadingQueue ? (
                <p className="text-muted-foreground text-center py-8">Laden...</p>
              ) : queue.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Keine aktiven Downloads</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fortschritt</TableHead>
                      <TableHead>Größe</TableHead>
                      <TableHead>Geschw.</TableHead>
                      <TableHead>Verbleibend</TableHead>
                      <TableHead className="w-24">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.nzo_id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {item.filename}
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.percentage}%</TableCell>
                        <TableCell>{item.mb} MB</TableCell>
                        <TableCell>{item.speed}</TableCell>
                        <TableCell>{item.timeleft}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.nzo_id)}
                            title="Abbrechen"
                          >
                            ✕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="history">
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Keine Downloads in der History
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Abgeschlossen</TableHead>
                      <TableHead>Größe</TableHead>
                      <TableHead className="w-24">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.nzo_id}>
                        <TableCell className="font-medium max-w-xs truncate">{item.name}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          {new Date(item.completed * 1000).toLocaleDateString("de-DE")}
                        </TableCell>
                        <TableCell>{formatSize(item.bytes)}</TableCell>
                        <TableCell className="flex gap-1">
                          {item.status.toLowerCase() === "failed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetry(item.nzo_id)}
                              title="Erneut versuchen"
                            >
                              ↻
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.nzo_id, true)}
                            title="Löschen"
                          >
                            ✕
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
