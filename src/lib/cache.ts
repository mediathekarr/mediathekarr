import { LRUCache } from "lru-cache";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;

// Default TTL values (in seconds)
const DEFAULT_SEARCH_TTL = 3600; // 1 hour
const DEFAULT_METADATA_TTL = 86400; // 24 hours

// Cache for TTL settings (short TTL to pick up changes)
let cachedSearchTTL: number | null = null;
let cachedMetadataTTL: number | null = null;
let lastTTLFetch = 0;
const TTL_CACHE_DURATION = 60 * 1000; // 1 minute

async function fetchTTLSettings(): Promise<{ searchTTL: number; metadataTTL: number }> {
  const now = Date.now();
  if (
    cachedSearchTTL !== null &&
    cachedMetadataTTL !== null &&
    now - lastTTLFetch < TTL_CACHE_DURATION
  ) {
    return { searchTTL: cachedSearchTTL, metadataTTL: cachedMetadataTTL };
  }

  try {
    const configs = await prisma.config.findMany({
      where: { key: { in: ["cache.ttl.search", "cache.ttl.metadata"] } },
    });

    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const searchTTLStr = configMap.get("cache.ttl.search");
    const metadataTTLStr = configMap.get("cache.ttl.metadata");

    cachedSearchTTL = searchTTLStr ? parseInt(searchTTLStr, 10) : DEFAULT_SEARCH_TTL;
    cachedMetadataTTL = metadataTTLStr ? parseInt(metadataTTLStr, 10) : DEFAULT_METADATA_TTL;

    if (isNaN(cachedSearchTTL) || cachedSearchTTL < 0) cachedSearchTTL = DEFAULT_SEARCH_TTL;
    if (isNaN(cachedMetadataTTL) || cachedMetadataTTL < 0) cachedMetadataTTL = DEFAULT_METADATA_TTL;

    lastTTLFetch = now;
  } catch {
    // Fallback to defaults on error
    cachedSearchTTL = cachedSearchTTL ?? DEFAULT_SEARCH_TTL;
    cachedMetadataTTL = cachedMetadataTTL ?? DEFAULT_METADATA_TTL;
  }

  return { searchTTL: cachedSearchTTL, metadataTTL: cachedMetadataTTL };
}

// Synchronous TTL getters (use cached values)
export function getSearchTTL(): number {
  return cachedSearchTTL ?? DEFAULT_SEARCH_TTL;
}

export function getMetadataTTL(): number {
  return cachedMetadataTTL ?? DEFAULT_METADATA_TTL;
}

// Initialize TTL settings
export async function initCacheTTL(): Promise<void> {
  await fetchTTLSettings();
}

// Clear TTL cache (call when settings change)
export function clearTTLCache(): void {
  cachedSearchTTL = null;
  cachedMetadataTTL = null;
  lastTTLFetch = 0;
}

// Cache with custom TTL stored per entry
interface CacheEntry {
  value: CacheValue;
  expiresAt: number;
}

class DynamicTTLCache {
  private cache: LRUCache<string, CacheEntry>;
  private getTTL: () => number;

  constructor(max: number, getTTL: () => number) {
    this.cache = new LRUCache<string, CacheEntry>({ max });
    this.getTTL = getTTL;
  }

  get(key: string): CacheValue | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: CacheValue): void {
    const ttlMs = this.getTTL() * 1000;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Cache for Mediathek API results (configurable TTL)
export const mediathekCache = new DynamicTTLCache(500, getSearchTTL);

// Cache for TVDB data (configurable TTL)
export const tvdbCache = new DynamicTTLCache(1000, getMetadataTTL);

// Cache for rulesets (1 hour TTL - not configurable)
export const rulesetsCache = new LRUCache<string, CacheValue>({
  max: 10,
  ttl: 60 * 60 * 1000, // 1 hour
});
