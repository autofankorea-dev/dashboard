"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { canEditFarmScope } from "@/lib/auth/farm-access";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  getFarmControllerTrend30dDayCompact,
  getFarmControllerTrendAllPeriods,
  getFarmControllerTrendHistoryCompact,
  getFarmControllerTrendWindowCompact,
  getFarmTrendAllPeriods,
} from "@/lib/data/farm-trend-history";
import type { CompactControllerPeriod } from "@/lib/data/farm-trend-compact";
import {
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendPeriodData,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { getFarmTrendUplinkCoverage } from "@/lib/data/farm-trend-uplink-coverage";
import type { UplinkCoverageWire } from "@/lib/farm/trend-uplink-coverage";
import { buildDailyReportPayload } from "@/lib/report/build-daily-report-payload";
import type { DailyReportPayload } from "@/lib/report/daily-report-payload";
import { farmScopeCacheKey } from "@/lib/data/live-config";
import { revalidateLiveCache } from "@/lib/data/live-cache";
import {
  clearBarnLayouts,
  getBarnLayoutPrefs,
  mergeBarnLayouts,
  patchBarnLayouts,
  saveBarnLayouts,
} from "@/lib/data/barn-meta";
import {
  loadFarmScopedLiveData,
  loadFarmScopedPanelData,
  type FarmScopedLiveData,
  type FarmScopedPanelData,
} from "@/lib/farm/load-farm-scoped-panel-data";
import { loadAdminFarmGridPanelsForKeys } from "@/lib/farm/load-admin-all-farms-grid";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import { fetchActiveModuleAlarms, ackModuleAlarm, ackModuleAlarmsBulk } from "@/lib/data/module-alarms";
import type { AlarmRow } from "@/lib/data/alarms";

async function assertFarmReadAccess(farmKey: FarmKey) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  const allowed =
    user.isAdmin ||
    user.accesses.some(
      (a) =>
        a.can_read &&
        a.lsind_regist_no === farmKey.lsindRegistNo &&
        a.item_code === farmKey.itemCode,
    );
  if (!allowed) {
    throw new Error("Forbidden");
  }
  return user;
}

/** Admin hub — 선택 농장 추이 그래프 (클라이언트 fetch용). */
export async function fetchFarmTrendAllPeriodsAction(
  farmKey: FarmKey
): Promise<Record<TrendPeriodId, TrendPeriodData>> {
  return getFarmTrendAllPeriods({ farmKey });
}

/** 오늘의 리포트 PDF — 축사 단위 페이로드 (브라우저 생성용). */
export async function fetchDailyReportPayloadAction(
  farmKey: FarmKey,
): Promise<DailyReportPayload> {
  await assertFarmReadAccess(farmKey);
  return buildDailyReportPayload(farmKey);
}

/** Admin hub — progressive grid hydrate (클라이언트 batch). */
export async function fetchAdminHubGridBatchAction(
  farmKeys: FarmKey[],
): Promise<AdminFarmGridPanel[]> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    throw new Error("Forbidden");
  }
  return loadAdminFarmGridPanelsForKeys(farmKeys);
}

/** soft refresh / ACK — LIVE(+layout)만. settings·trend 제외 */
export async function fetchFarmScopedLiveDataAction(
  farmKey: FarmKey,
): Promise<FarmScopedLiveData> {
  await assertFarmReadAccess(farmKey);
  return loadFarmScopedLiveData({ farmKey });
}

/** 모듈 경보 View — 셸 이상상황 정본 */
export async function fetchActiveModuleAlarmsAction(
  farmKey: FarmKey,
): Promise<AlarmRow[]> {
  await assertFarmReadAccess(farmKey);
  return fetchActiveModuleAlarms(farmKey);
}

/** 모듈 경보 확인(ack) — active View에서 제외 */
export async function ackModuleAlarmAction(
  alarmId: string,
  farmKey: FarmKey,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await assertFarmReadAccess(farmKey);
  return ackModuleAlarm(alarmId);
}

/** 모듈 경보 일괄 확인 — active View에서 제외 */
export async function ackModuleAlarmsBulkAction(
  alarmIds: string[],
  farmKey: FarmKey,
): Promise<
  { ok: true; acked: number } | { ok: false; error: string }
> {
  await assertFarmReadAccess(farmKey);
  return ackModuleAlarmsBulk(alarmIds);
}

/** Admin hub / farmer — 단일 farm scoped 그리드·목록 패널 데이터(full). */
export async function fetchFarmScopedPanelDataAction(
  farmKey: FarmKey
): Promise<FarmScopedPanelData> {
  const user = await assertFarmReadAccess(farmKey);
  return loadFarmScopedPanelData({
    farmKey,
    canCommand: canEditFarmScope(user, farmKey),
  });
}

/** 통합 추이 progressive — compact 희소 JSON. 허브 24h 15분 · 7d/30d 1시간. */
export async function fetchFarmControllerTrendPeriodAction(
  farmKey: FarmKey,
  period: TrendPeriodId,
): Promise<CompactControllerPeriod> {
  if (period !== "24h" && period !== "7d" && period !== "30d") {
    throw new Error("Invalid trend period");
  }
  return getFarmControllerTrendHistoryCompact({ farmKey, period });
}

/** 허브 30일 — 최신부터 하루(1시간 버킷) compact. 축은 24h compact 와 같게. */
export async function fetchFarmControllerTrend30dDayAction(
  farmKey: FarmKey,
  axisToMs: number,
  scanFromMs: number,
  scanToMs: number,
): Promise<CompactControllerPeriod> {
  const cfg = TREND_PERIODS["30d"];
  const dayMs = TREND_PERIODS["24h"].durationMs;
  if (
    !Number.isFinite(axisToMs) ||
    !Number.isFinite(scanFromMs) ||
    !Number.isFinite(scanToMs) ||
    scanToMs <= scanFromMs ||
    scanToMs - scanFromMs > dayMs + 2000
  ) {
    throw new Error("Invalid trend day window");
  }
  const axisFromMs = axisToMs - cfg.durationMs;
  if (scanFromMs < axisFromMs - 1000 || scanToMs > axisToMs + 1000) {
    throw new Error("Invalid trend day window");
  }
  await assertFarmReadAccess(farmKey);
  return getFarmControllerTrend30dDayCompact({
    farmKey,
    axisToMs,
    scanFromMs,
    scanToMs,
  });
}

const WINDOW_15M_MAX_MS = 2.5 * 24 * 60 * 60 * 1000;

/** 브러시 창 ≤ 48h — 구간 15분만. */
export async function fetchFarmControllerTrendWindowAction(
  farmKey: FarmKey,
  fromMs: number,
  toMs: number,
): Promise<CompactControllerPeriod> {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    throw new Error("Invalid trend window");
  }
  if (toMs - fromMs > WINDOW_15M_MAX_MS) {
    throw new Error("Trend window too long");
  }
  return getFarmControllerTrendWindowCompact({ farmKey, fromMs, toMs });
}

const COVERAGE_WINDOW_MAX_MS = 31 * 24 * 60 * 60 * 1000;

/** 추이 차트 — 희소 칸 홀드용. RPC 미적용 시 빈 배열. */
export async function fetchFarmTrendUplinkCoverageAction(
  farmKey: FarmKey,
  range: {
    fromMs: number;
    toMs: number;
    bucket: string;
    bucketCount: number;
    strideMs: number;
  },
): Promise<UplinkCoverageWire> {
  await assertFarmReadAccess(farmKey);
  if (
    !Number.isFinite(range.fromMs) ||
    !Number.isFinite(range.toMs) ||
    range.toMs <= range.fromMs ||
    range.toMs - range.fromMs > COVERAGE_WINDOW_MAX_MS ||
    range.bucketCount < 1 ||
    range.bucketCount > 3000 ||
    (range.bucket !== "15 minutes" && range.bucket !== "1 hour")
  ) {
    throw new Error("Invalid coverage range");
  }
  return getFarmTrendUplinkCoverage({ farmKey, ...range });
}

/** 목록 graph 모드 — 컨트롤러별 추이 (lazy fetch). */
export async function fetchFarmControllerTrendAllPeriodsAction(
  farmKey: FarmKey,
  options?: { refresh?: boolean },
): Promise<Record<TrendPeriodId, TrendControllerPeriodData>> {
  if (options?.refresh) {
    revalidateLiveCache(
      farmScopeCacheKey(farmKey.lsindRegistNo, farmKey.itemCode),
    );
  }
  return getFarmControllerTrendAllPeriods({ farmKey });
}

/** LIVE tier 캐시 무효화 — router.refresh 대신 클라이언트 refetch와 조합 */
export async function revalidateFarmLiveAction(
  farmKey?: FarmKey,
): Promise<{ ok: true }> {
  if (farmKey) {
    revalidateLiveCache(
      farmScopeCacheKey(farmKey.lsindRegistNo, farmKey.itemCode),
    );
  } else {
    revalidateLiveCache();
  }
  return { ok: true };
}

export async function saveBarnGridsAction(
  grids: { catalogKey: string; col: number; row: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const prefs = await getBarnLayoutPrefs();
  const layouts = { ...prefs.layouts };
  for (const g of grids) {
    if (!g.catalogKey) continue;
    layouts[g.catalogKey] = {
      col: Math.max(1, Math.min(8, g.col)),
      row: Math.max(1, Math.min(8, g.row)),
    };
  }

  const result = await saveBarnLayouts(layouts);
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}

/** 드래그 — 변경된 카드만 patch (revalidate·refresh 없음) */
export async function patchBarnGridsAction(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  return patchBarnLayouts(partial);
}

/** 최초·신규 SP 자동 배치 좌표 영구 저장 */
export async function persistBarnLayoutsAction(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  const result = await mergeBarnLayouts(partial);
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}

/** Phase C — read path idle persist (router revalidate 없음) */
export async function persistBarnLayoutsQuietAction(
  partial: Record<string, { col: number; row: number }>
): Promise<{ ok: boolean; error?: string }> {
  if (Object.keys(partial).length === 0) return { ok: true };
  return mergeBarnLayouts(partial);
}

/** SP 카드 위치 SP01~ 순 자동 배치로 되돌림 */
export async function resetBarnLayoutsAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const result = await clearBarnLayouts();
  if (result.ok) {
    revalidatePath("/farm");
  }
  return result;
}
