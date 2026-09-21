"use client";

import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { stallTrendBundleFromController } from "@/lib/data/trend-period-slice";
import {
  invalidateTimedCache,
  readTimedCache,
  writeTimedCache,
  type TimedCacheEntry,
} from "@/lib/farm/client-trend-cache";
import {
  prefetchFarmControllerTrend,
  subscribeFarmControllerTrend,
} from "@/lib/farm/use-farm-controller-trend";

type StallTrendBundle = Record<TrendPeriodId, TrendPeriodData>;

/** map idle prefetch 공유 — 컨트롤러 추이에서 파생 · 서버와 같은 5분 TTL */
const stallTrendCache = new Map<string, TimedCacheEntry<StallTrendBundle>>();

export function peekFarmStallTrendCache(
  farmKey: FarmKey,
): StallTrendBundle | null {
  return readTimedCache(stallTrendCache, farmKeyId(farmKey));
}

/** 농장 전환·강제 갱신 시 해당 scope 클라 캐시 제거 */
export function invalidateFarmStallTrendCache(farmKey: FarmKey): void {
  invalidateTimedCache(stallTrendCache, farmKeyId(farmKey));
}

/** LIVE 안정 후 idle — 그리드 히트맵용 stall trend (컨트롤러 RPC만). */
export function prefetchFarmStallTrend(
  farmKey: FarmKey,
  onUpdate?: (trend: StallTrendBundle) => void,
): Promise<StallTrendBundle> {
  const scopeId = farmKeyId(farmKey);
  const cached = readTimedCache(stallTrendCache, scopeId);
  if (cached) {
    onUpdate?.(cached);
  }

  const unsub = subscribeFarmControllerTrend(scopeId, (ctrl) => {
    const stall = stallTrendBundleFromController(ctrl);
    writeTimedCache(stallTrendCache, scopeId, stall);
    onUpdate?.(stall);
  });

  return prefetchFarmControllerTrend(farmKey, { extend30d: true })
    .then((ctrl) => {
      const stall = stallTrendBundleFromController(ctrl);
      writeTimedCache(stallTrendCache, scopeId, stall);
      onUpdate?.(stall);
      return stall;
    })
    .finally(() => {
      unsub();
    });
}
