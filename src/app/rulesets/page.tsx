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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Settings2, Trash2, ExternalLink } from "lucide-react";

interface Ruleset {
  id: string;
  topic: string;
  tvdbId: number;
  showName: string;
  germanName: string | null;
  matchingStrategy: string;
  filters: string;
  episodeRegex: string;
  seasonRegex: string;
  titleRegexRules: string;
  createdAt: string;
  updatedAt: string;
}

export default function RulesetsPage() {
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [filteredRulesets, setFilteredRulesets] = useState<Ruleset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; ruleset: Ruleset | null }>({
    show: false,
    ruleset: null,
  });

  const fetchRulesets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/rulesets");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setRulesets(Array.isArray(data) ? data : []);
      setFilteredRulesets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch rulesets:", error);
      setRulesets([]);
      setFilteredRulesets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRulesets();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRulesets(rulesets);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRulesets(
        rulesets.filter(
          (rs) =>
            rs.topic.toLowerCase().includes(query) ||
            rs.showName.toLowerCase().includes(query) ||
            (rs.germanName && rs.germanName.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, rulesets]);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.ruleset) return;

    try {
      const res = await fetch(`/api/rulesets?id=${deleteConfirm.ruleset.id}`, { method: "DELETE" });
      if (res.ok) {
        fetchRulesets();
      }
    } catch (error) {
      console.error("Failed to delete ruleset:", error);
    } finally {
      setDeleteConfirm({ show: false, ruleset: null });
    }
  };

  const getStrategyBadge = (strategy: string) => {
    switch (strategy) {
      case "SeasonAndEpisodeNumber":
        return <Badge variant="outline">S+E Nummer</Badge>;
      case "TitleMatch":
        return <Badge variant="secondary">Titel Match</Badge>;
      case "DateBased":
        return <Badge>Datum</Badge>;
      default:
        return <Badge variant="outline">{strategy}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rulesets</h1>
          <p className="text-muted-foreground text-sm">Matching-Regeln für Shows</p>
        </div>
        <Button variant="outline" onClick={fetchRulesets}>
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
              placeholder="Rulesets durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Rulesets Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            {filteredRulesets.length} Rulesets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Laden...</p>
          ) : filteredRulesets.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {rulesets.length === 0
                ? "Keine Rulesets vorhanden. Rulesets werden automatisch generiert wenn Sonarr nach Shows sucht."
                : "Keine Rulesets gefunden für diese Suche."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Topic</TableHead>
                    <TableHead>Show</TableHead>
                    <TableHead>TVDB ID</TableHead>
                    <TableHead>Strategie</TableHead>
                    <TableHead>Aktualisiert</TableHead>
                    <TableHead className="w-24">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRulesets.map((rs) => (
                    <TableRow key={rs.id}>
                      <TableCell className="font-medium">{rs.topic}</TableCell>
                      <TableCell>
                        <div>
                          <span>{rs.showName}</span>
                          {rs.germanName && (
                            <span className="text-muted-foreground text-sm block">
                              {rs.germanName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://thetvdb.com/?tab=series&id=${rs.tvdbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {rs.tvdbId} <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell>{getStrategyBadge(rs.matchingStrategy)}</TableCell>
                      <TableCell>
                        {new Date(rs.updatedAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm({ show: true, ruleset: rs })}
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirm.show}
        onOpenChange={(open) => !open && setDeleteConfirm({ show: false, ruleset: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ruleset löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du das Ruleset für &quot;{deleteConfirm.ruleset?.topic}&quot; wirklich
              löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
