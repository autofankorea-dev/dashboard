/** Client-side trend bundle cache — complements server `unstable_cache` (300s). */

export const CLIENT_TREND_CACHE_TTL_MS = 5 * 60_000;

export type TimedCacheEntry<T> = {
  data: T;
  at: number;
};

export function readTimedCache<T>(
  map: Map<string, TimedCacheEntry<T>>,
  key: string,
  now = Date.now(),
  ttlMs = CLIENT_TREND_CACHE_TTL_MS,
): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (now - hit.at > ttlMs) {
    map.delete(key);
    return null;
  }
  return hit.data;
}

export function writeTimedCache<T>(
  map: Map<string, TimedCacheEntry<T>>,
  key: string,
  data: T,
  now = Date.now(),
): void {
  map.set(key, { data, at: now });
}

export function invalidateTimedCache(
  map: Map<string, unknown>,
  key: string,
): void {
  map.delete(key);
}
