"use client";

import { useCallback } from "react";
import type { BarnReading } from "@/lib/data/iot";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import { stallKeyFromReading } from "@/lib/domain/reading-hierarchy";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type { FarmHubView } from "@/lib/farm/farm-view-url";
import {
  currentFarmSearchParams,
  pinFarmHubViewParam,
  replaceFarmUrlShallow,
  setTrendPeriodParam,
} from "@/lib/farm/farm-view-url";
import {
  applyFarmChartLabSelectionParams,
  applyFarmChartScopeParams,
  applyFarmChartWidgetSlotParams,
  clearFarmChartCmdParam,
  clearFarmChartScopeParams,
  clearFarmChartZoomParams,
  isFarmChartControllerScope,
  widgetsAfterOpenControllerChart,
  type FarmChartLabSelection,
  type FarmChartScope,
} from "@/lib/farm/farm-chart-scope";

/** 차트 탭 URL 변경. shallow replace 뒤 틱으로 검색 파라미터를 다시 읽는다. */
export function useFarmPageChartActions({
  view,
  setView,
  setUrlTick,
}: {
  view: FarmHubView;
  setView: (view: FarmHubView) => void;
  setUrlTick: (update: (n: number) => number) => void;
}) {
  const onTrendPeriodChange = useCallback(
    (period: TrendPeriodId) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      setTrendPeriodParam(params, period);
      clearFarmChartZoomParams(params);
      pinFarmHubViewParam(params, view);
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [view, setUrlTick],
  );

  /** 현장 카드 «차트에서 보기» — 그 컨트롤러 단일로 차트 탭. 비교는 차트에서만 */
  const onOpenControllerChart = useCallback(
    (reading: BarnReading) => {
      const sp = normalizeStallTyCode(reading.stallTyCode ?? "");
      const stallNo = stallKeyFromReading(reading);
      const scope: FarmChartScope =
        sp && stallNo && reading.controllerKey
          ? {
              level: "controller",
              stallTyCode: sp,
              stallNo,
              controllerKey: reading.controllerKey,
            }
          : sp
            ? { level: "sp", stallTyCode: sp }
            : { level: "farm" };
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyFarmChartScopeParams(params, scope);
      clearFarmChartZoomParams(params);
      if (scope.level !== "controller") clearFarmChartCmdParam(params);
      const widgets = isFarmChartControllerScope(scope)
        ? widgetsAfterOpenControllerChart(scope)
        : { w1: null, w2: null };
      applyFarmChartWidgetSlotParams(params, widgets);
      pinFarmHubViewParam(params, "chart");
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
      setView("chart");
    },
    [setUrlTick, setView],
  );

  const onChartLabSelectionChange = useCallback(
    (next: FarmChartLabSelection) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyFarmChartLabSelectionParams(params, next);
      clearFarmChartZoomParams(params);
      if (next.primary) {
        applyFarmChartScopeParams(params, next.primary);
      } else {
        clearFarmChartScopeParams(params);
        clearFarmChartCmdParam(params);
      }
      pinFarmHubViewParam(params, "chart");
      replaceFarmUrlShallow(params);
      setUrlTick((n) => n + 1);
    },
    [setUrlTick],
  );

  return { onTrendPeriodChange, onOpenControllerChart, onChartLabSelectionChange };
}
