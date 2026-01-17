import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const encodedUrl = searchParams.get("encodedUrl");
  const encodedTitle = searchParams.get("encodedTitle");

  if (!encodedUrl || !encodedTitle) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  let decodedUrl: string;
  let decodedTitle: string;

  try {
    decodedUrl = Buffer.from(encodedUrl, "base64").toString("utf-8");
    decodedTitle = Buffer.from(encodedTitle, "base64").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Invalid base64 string" }, { status: 400 });
  }

  // Generate fake NZB XML with the URL in comments
  const nzbContent = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE nzb PUBLIC "-//newzBin//DTD NZB 1.0//EN" "http://www.newzbin.com/DTD/nzb/nzb-1.0.dtd">
<!-- ${decodedTitle} -->
<!-- ${decodedUrl} -->
<nzb>
    <file post_id="1">
        <groups>
            <group>a.b.zdf</group>
        </groups>
        <segments>
            <segment number="1">ExampleSegmentID@news.example.com</segment>
        </segments>
    </file>
</nzb>`;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `rundfunk-${timestamp}.nzb`;

  return new NextResponse(nzbContent, {
    status: 200,
    headers: {
      "Content-Type": "application/x-nzb",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
