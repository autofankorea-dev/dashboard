import type { CurrentUser } from "@/lib/auth/get-current-user";
import {
  appendFarmKeyParams,
  compareFarmKey,
  farmKeyEq,
  farmKeyId,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/domain/farm-key";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { setMonitoringTabParam } from "@/lib/monitoring/monitoring-tabs";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import { setTrendPeriodParam } from "@/lib/farm/farm-view-url";

export type FarmQueryParams = {
  lsind?: string | null;
  item?: string | null;
  view?: string | null;
};

/** farm 단위 조회 권한 — admin 또는 해당 farm can_read */
export function canReadFarm(
  user: CurrentUser,
  farmKey: FarmKey
): boolean {
  if (user.isAdmin) return true;
  return user.accesses.some(
    (a) =>
      a.can_read &&
      a.lsind_regist_no === farmKey.lsindRegistNo &&
      a.item_code === farmKey.itemCode
  );
}

/** farm 단위 명령(설정) 권한 — admin 또는 해당 farm can_command */
export function canEditFarmScope(
  user: CurrentUser,
  farmKey: FarmKey
): boolean {
  if (user.isAdmin) return true;
  return user.accesses.some(
    (a) =>
      a.can_read &&
      a.can_command &&
      a.lsind_regist_no === farmKey.lsindRegistNo &&
      a.item_code === farmKey.itemCode
  );
}

/** user_access 에서 farm 단위 조회 가능 목록 */
export function farmKeysFromAccess(user: CurrentUser): FarmKey[] {
  const map = new Map<string, FarmKey>();
  for (const access of user.accesses) {
    if (!access.can_read) continue;
    const farmKey: FarmKey = {
      lsindRegistNo: access.lsind_regist_no,
      itemCode: access.item_code,
    };
    map.set(farmKeyId(farmKey), farmKey);
  }
  return [...map.values()].sort(compareFarmKey);
}

/** 비관리자 고정 farm — 복수 권한 시 첫 farm */
export function resolveFixedFarmKey(user: CurrentUser): FarmKey | null {
  if (user.isAdmin) return null;
  return farmKeysFromAccess(user)[0] ?? null;
}

/** URL + 역할 기준 활성 farm. 관리자·lsind/item 없음 → null(전체) */
export function resolveActiveFarmKey(
  user: CurrentUser,
  params: FarmQueryParams = {}
): FarmKey | null {
  if (!user.isAdmin) {
    return resolveFixedFarmKey(user);
  }
  return parseFarmKeyFromQuery(params.lsind, params.item);
}

export function filterReadingsByFarmKey<T extends { farmKey: FarmKey }>(
  readings: T[],
  farmKey: FarmKey | null
): T[] {
  if (!farmKey) return readings;
  return readings.filter((r) => farmKeyEq(r.farmKey, farmKey));
}

export function buildControllerHref(opts: {
  farmKey: FarmKey;
  sp?: string | null;
  /** v0x0A 축사 번호 (01~32) */
  stallNo?: string | null;
  controllerKey?: string | null;
  /** @deprecated legacy idx URL */
  ctrlIdx?: number | null;
  alarmId?: string | null;
  /** 도착 뷰 — "list"면 목록 뷰(ControllerSummaryGaugeRow)로 진입(레거시 그래프 미사용). */
  view?: "map" | "list";
  /** 그리드·목록 공유 추이 기간 deep link. */
  trendPeriod?: TrendPeriodId | null;
}): string {
  const params = new URLSearchParams();
  appendFarmKeyParams(params, opts.farmKey);
  const sp = opts.sp ? normalizeStallTyCode(opts.sp) : "";
  if (sp && sp !== "UNK") params.set("sp", sp);
  const stall = opts.stallNo?.trim();
  if (stall) params.set("stall", stall);
  if (opts.controllerKey) {
    params.set("ctrl", encodeURIComponent(opts.controllerKey));
  } else if (opts.ctrlIdx != null && Number.isFinite(opts.ctrlIdx)) {
    params.set("ctrl", String(opts.ctrlIdx));
  }
  if (opts.alarmId) params.set("alarm", opts.alarmId);
  if (opts.view === "list") {
    // 목록 뷰 진입 — deep-link sp가 map 드릴(레거시 그래프)로 해석되지 않도록 view=list 명시.
    params.set("view", "list");
  } else {
    setMonitoringTabParam(params, "ops");
  }
  if (opts.trendPeriod) setTrendPeriodParam(params, opts.trendPeriod);
  return `/farm?${params.toString()}`;
}
