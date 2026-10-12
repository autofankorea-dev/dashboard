import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type { FarmKey } from "@/lib/domain/farm-key";

export type FarmPanelSliceLike = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
};

/** thermoSettings 맵에 ctrl별 설정이 하나라도 있는지 */
export function hasThermoSettings(
  map: Record<string, ControllerThermoSettings> | null | undefined,
): boolean {
  return Object.keys(map ?? {}).length > 0;
}

/** 목록/그리드 패널 — alarm + thermo가 모두 준비됐는지 */
export function isScopedControllerEnriched(
  controller: ControllerGridData | null | undefined,
): boolean {
  if (!controller) return false;
  return Boolean(controller.alarmSettings) && hasThermoSettings(controller.thermoSettings);
}

function maxIsoMs(values: Array<string | null | undefined>): number {
  let max = 0;
  for (const v of values) {
    if (!v) continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max;
}

/** readings·thermo·commands 기준 패널 신선도 (ms epoch, 없으면 0) */
export function scopedPanelFreshnessMs(slice: FarmPanelSliceLike): number {
  const readingTimes = slice.readings.map((r) => r.receivedAt);
  const thermoTimes = Object.values(slice.controller?.thermoSettings ?? {}).map(
    (s) => s.updatedAt,
  );
  const commandTimes = (slice.controller?.commands ?? []).flatMap((c) => [
    c.appliedAt,
    c.sentAt,
    c.createdAt,
  ]);
  return maxIsoMs([...readingTimes, ...thermoTimes, ...commandTimes]);
}

/**
 * hydrateScopedPanel skip 여부.
 * - incoming이 enrich되지 않았고 prev만 enrich → skip (빈약 데이터로 덮지 않음)
 * - prev가 enrich 아니면 → 적용
 * - 둘 다 enrich → incoming이 더 신선할 때만 적용 (동일이하면 skip)
 */
export function shouldSkipScopedPanelHydrate(
  prev: FarmPanelSliceLike,
  incoming: FarmScopedPanelData,
): boolean {
  const prevEnriched = isScopedControllerEnriched(prev.controller);
  const incomingEnriched = isScopedControllerEnriched(incoming.controller);

  if (!incomingEnriched) return prevEnriched;
  if (!prevEnriched) return false;

  return scopedPanelFreshnessMs(incoming) <= scopedPanelFreshnessMs(prev);
}

/** SSR initial slice → farm panel cache 항목 */
export function farmPanelCacheFromSlice(
  farmKey: FarmKey,
  slice: FarmPanelSliceLike,
): FarmScopedPanelData {
  return {
    farmKey,
    readings: slice.readings,
    barnSnapshots: slice.barnSnapshots,
    gridCols: slice.gridCols,
    gridRows: slice.gridRows,
    trendByPeriod: slice.trendByPeriod ?? null,
    controller: slice.controller ?? {
      readings: slice.readings,
      thermoSettings: {},
      commands: [],
      canCommand: false,
    },
  };
}
