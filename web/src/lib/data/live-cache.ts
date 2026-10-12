import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import {
  LIVE_CACHE_REVALIDATE_SECONDS,
  LIVE_CACHE_TAG,
  liveCacheTagForFarm,
} from "@/lib/domain/live-config";

export function revalidateLiveCache(farmScopeKey?: string): void {
  revalidateTag(LIVE_CACHE_TAG, "max");
  if (farmScopeKey) {
    revalidateTag(liveCacheTagForFarm(farmScopeKey), "max");
  }
}

type CachedLiveQueryOptions<T> = {
  /**
   * @deprecated 이전 구현은 매 요청 DB를 쳐 캐시를 무력화함.
   * 빈 결과 재시도는 짧은 `revalidate`로 대체한다.
   */
  shouldCache?: (result: T) => boolean;
  revalidate?: number;
};

/** Cross-request LIVE/overview 캐시 (unstable_cache). */
export async function cachedLiveQuery<T>(
  keyParts: string[],
  tags: string[],
  fn: () => Promise<T>,
  options?: CachedLiveQueryOptions<T>,
): Promise<T> {
  const revalidate = options?.revalidate ?? LIVE_CACHE_REVALIDATE_SECONDS;

  return unstable_cache(fn, keyParts, {
    revalidate,
    tags: [LIVE_CACHE_TAG, ...tags],
  })();
}
