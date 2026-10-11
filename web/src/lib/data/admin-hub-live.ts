import "server-only";

import { cache } from "react";
import type { AlarmRow } from "@/lib/domain/alarms";
import {
  compareFarmKey,
  farmKeyId,
  parseFarmKeyId,
  type FarmKey,
} from "@/lib/domain/farm-key";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import { buildFarmSummaries, type FarmSummaryRow } from "@/lib/domain/farm-summaries";
import { buildFarmSummariesFromOverview } from "@/lib/data/farm-overview";
import type { BarnReading } from "@/lib/data/iot";
import {
  fetchFarmOverviewForFarmKeys,
  fetchFarmOverviewRows,
  fetchLiveReadings,
  type FarmOverviewDbRow,
} from "@/lib/data/iot-live-fetch";

/** Admin 허브 LIVE 병렬 fetch 상한 (sim_fleet dev = 10) */
export const ADMIN_HUB_MAX_FARMS = 20;

/** dev sim_fleet 기본 농장 — global overview/LIVE 타임아웃 시 seed */
export function devSimFarmKeys(): FarmKey[] {
  return Array.from({ length: 10 }, (_, i) => ({
    lsindRegistNo: `FARM${String(i + 1).padStart(2, "0")}`,
    itemCode: "P00",
  }));
}

export function overviewRowsToFarmKeys(rows: FarmOverviewDbRow[]): FarmKey[] {
  return rows.map((r) => ({
    lsindRegistNo: r.lsind_regist_no,
    itemCode: r.item_code,
  }));
}

/** Admin 허브 farm key — 배정 · overview · location · dev sim 순 */
export function discoverAdminHubFarmKeys(
  locations: Pick<FarmLocationRow, "farmKey">[],
  farmOptions: FarmKey[],
): FarmKey[] {
  const map = new Map<string, FarmKey>();
  for (const fk of farmOptions) map.set(farmKeyId(fk), fk);
  for (const loc of locations) map.set(farmKeyId(loc.farmKey), loc.farmKey);
  if (map.size > 0) return [...map.values()].sort(compareFarmKey);
  if (process.env.NODE_ENV === "development") return devSimFarmKeys();
  return [];
}

/** overview/readings 실패 시 목록 표시용 최소 summary */
export function buildSkeletonFarmSummaries(
  farmKeys: FarmKey[],
): FarmSummaryRow[] {
  return farmKeys
    .map((farmKey) => ({
      farmKey,
      controllerCount: 0,
      offlineCount: 0,
      alarmCount: 0,
      criticalCount: 0,
      avgTempC: null,
      avgHumidityPct: null,
      latestReceivedAt: null,
    }))
    .sort((a, b) => compareFarmKey(a.farmKey, b.farmKey));
}

/**
 * Admin 허브 LIVE readings.
 * global `getLiveReadings({})`는 RLS 하에서 statement timeout → farm-scoped 병렬 조회.
 */
export async function fetchAdminHubLiveReadings(
  activeFarmKey: FarmKey | null,
  farmKeys: FarmKey[],
): Promise<BarnReading[]> {
  if (activeFarmKey) {
    return fetchLiveReadings({ farmKey: activeFarmKey });
  }

  const keys = farmKeys.slice(0, ADMIN_HUB_MAX_FARMS);
  if (keys.length === 0) return [];

  const batches = await Promise.all(
    keys.map((farmKey) => fetchLiveReadings({ farmKey })),
  );
  return batches.flat();
}

/** overview → shell summaries → readings 집계 → hubFarmKeys skeleton 순 fallback */
export function resolveAdminHubFarmSummaries(
  readings: BarnReading[],
  alarms: AlarmRow[],
  overviewRows: FarmOverviewDbRow[],
  fallbackSummaries: FarmSummaryRow[] = [],
  hubFarmKeys: FarmKey[] = [],
): FarmSummaryRow[] {
  if (overviewRows.length > 0) {
    return buildFarmSummariesFromOverview(overviewRows);
  }
  if (fallbackSummaries.length > 0) {
    return fallbackSummaries;
  }
  if (readings.length > 0) {
    return buildFarmSummaries(readings, alarms);
  }
  if (hubFarmKeys.length > 0) {
    return buildSkeletonFarmSummaries(hubFarmKeys);
  }
  return [];
}

/** React.cache dedupe key — farmKeyId 목록 또는 global sentinel */
export function adminHubOverviewCacheKey(farmKeys: FarmKey[]): string {
  if (farmKeys.length === 0) return "__global__";
  return [...farmKeys]
    .sort(compareFarmKey)
    .map((fk) => farmKeyId(fk))
    .join("|");
}

function farmKeysFromCacheKey(cacheKey: string): FarmKey[] {
  if (cacheKey === "__global__") return [];
  return cacheKey
    .split("|")
    .map((id) => parseFarmKeyId(id))
    .filter((fk): fk is FarmKey => fk != null);
}

/** Admin hub overview — scoped per-farm when keys known; request-deduped via cache */
export const loadAdminHubOverviewRows = cache(
  async (cacheKey: string): Promise<FarmOverviewDbRow[]> => {
    try {
      const farmKeys = farmKeysFromCacheKey(cacheKey);
      if (farmKeys.length > 0) {
        return await fetchFarmOverviewForFarmKeys(
          farmKeys.slice(0, ADMIN_HUB_MAX_FARMS),
        );
      }
      return await fetchFarmOverviewRows();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[admin-hub] loadAdminHubOverviewRows failed:", err);
      }
      return [];
    }
  },
);
