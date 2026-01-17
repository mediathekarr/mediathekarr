"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Tv, ExternalLink } from "lucide-react";

interface Show {
  id: number;
  name: string;
  germanName: string | null;
  slug: string | null;
  overview: string | null;
  firstAired: string | null;
  cachedAt: string;
  expiresAt: string;
  _count: {
    episodes: number;
  };
}

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [filteredShows, setFilteredShows] = useState<Show[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchShows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/shows");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setShows(Array.isArray(data) ? data : []);
      setFilteredShows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch shows:", error);
      setShows([]);
      setFilteredShows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredShows(shows);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredShows(
        shows.filter(
          (show) =>
            show.name.toLowerCase().includes(query) ||
            (show.germanName && show.germanName.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, shows]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shows</h1>
          <p className="text-muted-foreground text-sm">Gecachte TV-Serien aus TVDB</p>
        </div>
        <Button variant="outline" onClick={fetchShows}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Shows durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shows Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5" />
            {filteredShows.length} Shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Laden...</p>
          ) : filteredShows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {shows.length === 0
                ? "Keine Shows im Cache. Shows werden automatisch gecacht wenn Sonarr nach ihnen sucht."
                : "Keine Shows gefunden für diese Suche."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TVDB ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Deutscher Name</TableHead>
                    <TableHead>Episoden</TableHead>
                    <TableHead>Erstausstrahlung</TableHead>
                    <TableHead className="w-20">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShows.map((show) => (
                    <TableRow key={show.id}>
                      <TableCell>
                        <Badge variant="outline">{show.id}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{show.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {show.germanName || "-"}
                      </TableCell>
                      <TableCell>{show._count.episodes}</TableCell>
                      <TableCell>
                        {show.firstAired
                          ? new Date(show.firstAired).toLocaleDateString("de-DE")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {show.slug ? (
                          <a
                            href={`https://thetvdb.com/series/${show.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            TVDB <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
