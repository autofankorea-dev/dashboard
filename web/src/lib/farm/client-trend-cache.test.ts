import { test } from "vitest";
import assert from "node:assert/strict";
import {
  CLIENT_TREND_CACHE_TTL_MS,
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";

const map = new Map<string, TimedCacheEntry<{ n: number }>>();

writeTimedCache(map, "a", { n: 1 }, 1_000);
assert.deepEqual(readTimedCache(map, "a", 1_000 + 1_000), { n: 1 });
assert.equal(
  readTimedCache(map, "a", 1_000 + CLIENT_TREND_CACHE_TTL_MS + 1),
  null,
);
assert.equal(map.has("a"), false);

writeTimedCache(map, "b", { n: 2 }, 5_000);
invalidateTimedCache(map, "b");
assert.equal(readTimedCache(map, "b", 5_000), null);

console.log("client-trend-cache.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
