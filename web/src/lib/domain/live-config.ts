/** LIVE read tier + cache policy (D9 / perf plan) */

export type LiveReadTier = "list" | "legacy";

/**
 * `legacy` rolls back to v_iot_decoded_latest + decoded_json.
 * Farm-scoped full panel uses decoded_latest (channels[] for bulk).
 * Soft refresh / admin hub grid pass `slim: true` → v_iot_dashboard_list.
 *
 * Call-site contract (Sprint A):
 * - slim: loadFarmScopedLiveData, buildFarmFacts, loadAdminFarmGridPanels*
 * - full (no slim): loadFarmScopedPanelData / panel enrich / bulk channel cmds
 * - Soft merge keeps prior channels[] when slim omits them (mergeLiveReadings).
 * Sprint B: barn layout / alarm settings use profile-ui-meta 60s cache (not auth).
 * Sprint C: list SELECT tokens guarded in live-read-select.ts (no decoded_json/channels).
 */
export function liveReadTier(): LiveReadTier {
  const raw = process.env.NEXT_PUBLIC_LIVE_READ_TIER?.trim().toLowerCase();
  return raw === "legacy" ? "legacy" : "list";
}

export const LIVE_CACHE_REVALIDATE_SECONDS = 300;

export { LIVE_FARM_ROW_LIMIT } from "@/lib/admin/health/constants";

export const LIVE_CACHE_TAG = "live";

export function liveCacheTagForFarm(farmScopeKey: string): string {
  return `${LIVE_CACHE_TAG}:${farmScopeKey}`;
}

export function farmScopeCacheKey(
  lsindRegistNo: string | null,
  itemCode: string | null,
): string {
  if (lsindRegistNo && itemCode) return `${lsindRegistNo}/${itemCode}`;
  return "global";
}
