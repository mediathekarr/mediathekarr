import { LRUCache } from "lru-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CacheValue = Record<string, any>;

// Cache for Mediathek API results (55 minutes TTL)
export const mediathekCache = new LRUCache<string, CacheValue>({
  max: 500,
  ttl: 55 * 60 * 1000, // 55 minutes
});

// Cache for TVDB data (12 hours TTL)
export const tvdbCache = new LRUCache<string, CacheValue>({
  max: 1000,
  ttl: 12 * 60 * 60 * 1000, // 12 hours
});

// Cache for rulesets (1 hour TTL)
export const rulesetsCache = new LRUCache<string, CacheValue>({
  max: 10,
  ttl: 60 * 60 * 1000, // 1 hour
});
