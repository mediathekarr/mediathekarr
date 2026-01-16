import { promises as fs } from "fs";
import path from "path";
import type { Ruleset } from "@/types";

// In-memory storage for rulesets indexed by topic
let rulesetsByTopic: Map<string, Ruleset[]> = new Map();

export async function loadRulesets(): Promise<void> {
  try {
    // Load from local JSON file
    const rulesetsPath = path.join(process.cwd(), "data", "rulesets.json");
    const fileContent = await fs.readFile(rulesetsPath, "utf-8");
    const allRulesets: Ruleset[] = JSON.parse(fileContent);

    // Clear and rebuild the topic map
    rulesetsByTopic = new Map();

    // Group rulesets by topic and sort by priority
    for (const ruleset of allRulesets) {
      const existing = rulesetsByTopic.get(ruleset.topic) || [];
      existing.push(ruleset);
      rulesetsByTopic.set(ruleset.topic, existing);
    }

    // Sort each topic's rulesets by priority
    for (const [topic, rulesets] of rulesetsByTopic) {
      rulesetsByTopic.set(
        topic,
        rulesets.sort((a, b) => a.priority - b.priority)
      );
    }

    console.log(
      `[Rulesets] Loaded ${allRulesets.length} rulesets for ${rulesetsByTopic.size} topics from local file`
    );
  } catch (error) {
    console.error("[Rulesets] Error loading rulesets from local file:", error);
  }
}

export function getRulesetsForTopic(topic: string): Ruleset[] {
  const rulesets = rulesetsByTopic.get(topic) || [];
  return rulesets;
}

export function getRulesetsForTopicAndTvdbId(topic: string, tvdbId: number): Ruleset[] {
  const topicRulesets = getRulesetsForTopic(topic);
  const filtered = topicRulesets.filter((r) => r.media?.media_tvdbId === tvdbId);
  return filtered;
}

export function getAllTopics(): string[] {
  return Array.from(rulesetsByTopic.keys());
}

export function isRulesetsLoaded(): boolean {
  return rulesetsByTopic.size > 0;
}

// Initialize rulesets on first import
let initPromise: Promise<void> | null = null;

export async function ensureRulesetsLoaded(): Promise<void> {
  if (isRulesetsLoaded()) {
    return;
  }

  if (!initPromise) {
    initPromise = loadRulesets();
  }

  await initPromise;
}
