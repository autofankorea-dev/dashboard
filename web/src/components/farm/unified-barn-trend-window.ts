/**
 * 통합 추세 패널의 표시 창 집계.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 펼친 기본·휠은 30일 1시간 슬라이스, 미니는 24시간 2시간 평균, 15분은 드래그 줌만.
 */
import type { BrushWindow } from "@/components/farm/unified-trend-period-brush";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import {
  applyCoverageToWindow,
  binControllerWindowToStride,
  brushSliceRange,
  controllerWindowHasValues,
  sliceControllerSeries,
  type ControllerWindowBundle,
} from "@/components/farm/unified-barn-trend-panel-helpers";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import {
  TREND_MINI_STRIDE_MS,
  TREND_PERIODS,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
} from "@/lib/farm/controller-summary-display";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";

export function buildUnifiedBarnTrendWindow(input: {
  controllers: UnifiedBarnTrendControllerRef[];
  controllerTrendByPeriod?: Record<
    TrendPeriodId,
    TrendControllerPeriodData
  > | null;
  canvasPeriod: TrendPeriodId;
  useBrushCanvas: boolean;
  context30d: boolean;
  brushWindow: BrushWindow;
  uplinkCoverage: UplinkCoverageIndex[];
  overview: boolean;
  comparisonActive: boolean;
}): ControllerWindowBundle | null {
  const {
    controllers,
    controllerTrendByPeriod,
    canvasPeriod,
    useBrushCanvas,
    context30d,
    brushWindow,
    uplinkCoverage,
    overview,
    comparisonActive,
  } = input;

  const collectRange = (periodId: TrendPeriodId, from: number, to: number) => {
    const periodData = controllerTrendByPeriod?.[periodId] ?? null;
    const categoriesRaw = periodData?.categories ?? [];
    if (!categoriesRaw.length) return null;
    const windowCategories = categoriesRaw.slice(from, to);
    if (windowCategories.length < 2) return null;

    const seriesList = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        const found = findControllerTrendSeries(
          controllerTrendByPeriod,
          periodId,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
        if (!found) return null;
        // 표시 정본 = 채널 슬롯(A/B/C) — series.fanA/B/C 를 그대로 사용.
        return {
          ...sliceControllerSeries(found, from, to),
          zoneLabel: formatControllerHeaderPrimary(r),
          equipmentLabel: formatControllerHeaderSecondary(r),
          stallTyCode: r.stallTyCode
            ? normalizeStallTyCode(r.stallTyCode)
            : undefined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);

    if (!seriesList.length) return null;
    const bucketAts = (periodData?.bucketAts ?? []).slice(from, to);
    return {
      categories: windowCategories,
      bucketAts,
      seriesList: applyCoverageToWindow(seriesList, bucketAts, uplinkCoverage),
    };
  };

  const collect = (periodId: TrendPeriodId, brush: boolean) => {
    const periodData = controllerTrendByPeriod?.[periodId] ?? null;
    const categoriesRaw = periodData?.categories ?? [];
    if (!categoriesRaw.length) return null;
    if (!brush) return collectRange(periodId, 0, categoriesRaw.length);
    const range = brushSliceRange(categoriesRaw.length, brushWindow);
    return collectRange(periodId, range.from, range.to);
  };

  const finish = (bundle: ControllerWindowBundle | null) => {
    if (!bundle) return null;
    if (overview) {
      return binControllerWindowToStride(bundle, TREND_MINI_STRIDE_MS);
    }
    return bundle;
  };

  if (overview) {
    const h24 = collect("24h", false);
    if (h24) return finish(h24);
    const d30n = controllerTrendByPeriod?.["30d"]?.categories.length ?? 0;
    const hours24 = Math.round(
      TREND_PERIODS["24h"].durationMs / TREND_PERIODS["30d"].strideMs,
    );
    if (d30n >= hours24) {
      const tail = collectRange("30d", d30n - hours24, d30n);
      if (tail) return finish(tail);
    }
    return null;
  }

  if (useBrushCanvas && context30d) {
    const hourly = collect("30d", true);
    if (hourly && (comparisonActive || controllerWindowHasValues(hourly))) {
      return hourly;
    }
  }
  const h24 = collect("24h", false);
  if (h24 && controllerWindowHasValues(h24)) {
    return binControllerWindowToStride(h24, TREND_PERIODS["30d"].strideMs);
  }
  if (useBrushCanvas && context30d) {
    const hourly = collect("30d", true);
    if (hourly) return hourly;
  }

  const primary = collect(canvasPeriod, false);
  if (primary) return finish(primary);
  if (canvasPeriod !== "24h") return finish(collect("24h", false));
  return null;
}
