"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Film, Construction } from "lucide-react";

export default function MoviesPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Filme</h1>
        <p className="text-muted-foreground text-sm">Film-Datenbank</p>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Construction className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">Coming Soon</h2>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Die Film-Unterstützung wird in einer zukünftigen Version hinzugefügt. Aktuell werden nur
            TV-Serien über Sonarr unterstützt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
