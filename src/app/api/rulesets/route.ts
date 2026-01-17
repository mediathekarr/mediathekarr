import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/rulesets - Fetch all rulesets
export async function GET() {
  try {
    const rulesets = await prisma.generatedRuleset.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(rulesets);
  } catch (error) {
    console.error("Failed to fetch rulesets:", error);
    return NextResponse.json({ error: "Failed to fetch rulesets" }, { status: 500 });
  }
}

// POST /api/rulesets - Update a ruleset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const ruleset = await prisma.generatedRuleset.update({
      where: { id },
      data: {
        matchingStrategy: data.matchingStrategy,
        filters: data.filters,
        episodeRegex: data.episodeRegex,
        seasonRegex: data.seasonRegex,
        titleRegexRules: data.titleRegexRules,
      },
    });

    return NextResponse.json(ruleset);
  } catch (error) {
    console.error("Failed to update ruleset:", error);
    return NextResponse.json({ error: "Failed to update ruleset" }, { status: 500 });
  }
}

// DELETE /api/rulesets - Delete a ruleset
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID parameter required" }, { status: 400 });
  }

  try {
    await prisma.generatedRuleset.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete ruleset:", error);
    return NextResponse.json({ error: "Failed to delete ruleset" }, { status: 500 });
  }
}
