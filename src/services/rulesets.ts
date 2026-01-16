import { rulesetsCache } from "@/lib/cache";
import type { Ruleset, RulesetApiResponse } from "@/types";

const RULESETS_API_URL = "https://mediathekarr.pcjones.de/metadata/api/rulesets.php";

// In-memory storage for rulesets indexed by topic
let rulesetsByTopic: Map<string, Ruleset[]> = new Map();

export async function updateRulesets(): Promise<void> {
  const allRulesets: Ruleset[] = [];
  let currentPage = 1;

  while (currentPage < 100) {
    try {
      const response = await fetch(`${RULESETS_API_URL}?page=${currentPage}`);
      if (!response.ok) {
        console.error("Failed to fetch rulesets from the API.");
        break;
      }

      const data: RulesetApiResponse = await response.json();

      if (data.rulesets) {
        allRulesets.push(...data.rulesets);
      }

      if (data.pagination.currentPage >= data.pagination.totalPages) {
        break;
      }

      currentPage++;
    } catch (error) {
      console.error("Error fetching rulesets:", error);
      break;
    }
  }

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

  // Cache the update time
  rulesetsCache.set("lastUpdate", { timestamp: Date.now() });

  console.log(`Loaded ${allRulesets.length} rulesets for ${rulesetsByTopic.size} topics`);
}

export function getRulesetsForTopic(topic: string): Ruleset[] {
  return rulesetsByTopic.get(topic) || [];
}

export function getRulesetsForTopicAndTvdbId(topic: string, tvdbId: number): Ruleset[] {
  const topicRulesets = getRulesetsForTopic(topic);
  return topicRulesets.filter((r) => r.media?.tvdbId === tvdbId);
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
    initPromise = updateRulesets();
  }

  await initPromise;
}
