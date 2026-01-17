"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText, Construction } from "lucide-react";

export default function LogsPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-muted-foreground text-sm">System-Protokolle</p>
      </div>

      {/* Coming Soon */}
      <Card>
        <CardContent className="py-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Construction className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">Coming Soon</h2>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Der Log-Viewer wird in einer zukünftigen Version hinzugefügt. Aktuell können Logs über
            die Konsole oder Docker-Logs eingesehen werden.
          </p>
          <div className="mt-4 bg-muted p-3 rounded-lg max-w-sm mx-auto text-left">
            <p className="text-sm font-mono text-muted-foreground">docker logs rundfunkarr</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
