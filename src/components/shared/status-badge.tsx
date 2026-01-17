import { Badge } from "@/components/ui/badge";

export function getStatusBadge(status: string) {
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
}
