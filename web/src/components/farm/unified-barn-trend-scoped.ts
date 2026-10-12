/**
 * 통합 추세 패널의 X스코프 시계열 재집계.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 줌 스택 setState는 패널에 남긴다.
 */
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import {
  applyCoverageToWindow,
  downsampleSeriesForChart,
  mapIndexWindowToSlice,
  sliceControllerSeries,
  type ControllerWindowBundle,
} from "@/components/farm/unified-barn-trend-panel-helpers";
import type { PanelXScopeEntry } from "@/components/farm/unified-barn-trend-x-scope";
import { sliceFanControlWindows } from "@/lib/farm/channel-thermo";
import {
  findControllerTrendSeries,
  formatControllerHeaderPrimary,
  formatControllerHeaderSecondary,
} from "@/lib/farm/controller-summary-display";
import type { AlarmThresholds } from "@/lib/domain/alarms";
import { normalizeStallTyCode } from "@/lib/domain/stall-type";
import {
  emptyTrendControllerPeriodData,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
  type TrendWindow15m,
} from "@/lib/domain/farm-trend-types";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import type {
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { sliceControllerTrendByTime } from "@/lib/domain/trend-period-slice";
import { window15mCovers } from "@/lib/farm/trend-brush-coverage";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import type {
  SplitYLayout,
  UnifiedLayerFlags,
} from "@/lib/farm/unified-barn-trend-layout";
import {
  aggregateUnifiedBarnTrendRaw,
  mapUnifiedBarnTrendRawToSplitY,
  maskLayersForYBands,
  pickUnifiedTrendLayers,
  sliceUnifiedTrendByIndex,
  type UnifiedBarnTrendRaw,
} from "@/lib/farm/unified-barn-trend-series";
import type { TempBandAnchor } from "@/lib/farm/unified-trend-split-y";

export type ScopedUnifiedBarnTrend = {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  tempDomain: [number, number];
  tempOverflowDomain: [number, number] | null;
  thermoWindows: UnifiedBarnTrendRaw["thermoWindows"];
};

type PickedUnifiedBarnTrend = {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  tempDomain: [number, number];
  tempOverflowDomain: [number, number] | null;
};

export function rebuildScopedUnifiedBarnTrend(input: {
  picked: PickedUnifiedBarnTrend | null;
  xScope: PanelXScopeEntry | null;
  xScopeRangeMs: { fromMs: number; toMs: number } | null;
  window15m: TrendWindow15m | null;
  deferredWindowBundle: ControllerWindowBundle | null;
  controllers: UnifiedBarnTrendControllerRef[];
  uplinkCoverage: UplinkCoverageIndex[];
  plotThresholds: AlarmThresholds;
  layout: SplitYLayout;
  layers: UnifiedLayerFlags;
  plotWidthPx: number;
  chartScopeLevel: FarmChartScope["level"];
  trendRaw: UnifiedBarnTrendRaw | null;
  overlayAlign: TempBandAnchor | undefined;
  comparisonActive: boolean;
}): ScopedUnifiedBarnTrend | null {
  const {
    picked,
    xScope,
    xScopeRangeMs,
    window15m,
    deferredWindowBundle,
    controllers,
    uplinkCoverage,
    plotThresholds,
    layout,
    layers,
    plotWidthPx,
    chartScopeLevel,
    trendRaw,
    overlayAlign,
    comparisonActive,
  } = input;
  if (!picked) return null;
  if (!xScope) {
    return {
      categories: picked.categories,
      series: picked.series,
      envelopes: picked.envelopes,
      histograms: picked.histograms,
      tempDomain: picked.tempDomain,
      tempOverflowDomain: picked.tempOverflowDomain,
      thermoWindows: trendRaw?.thermoWindows ?? null,
    };
  }

  const buildScopedFromSeries = (
    seriesList: TrendControllerSeries[],
    cats: string[],
  ) => {
    if (cats.length < 2 || seriesList.length < 1) return null;
    const down = comparisonActive
      ? { seriesList, categories: cats }
      : downsampleSeriesForChart(seriesList, cats, plotWidthPx);
    const raw = aggregateUnifiedBarnTrendRaw(
      down.seriesList,
      down.categories,
      plotThresholds,
      { includeThermo: chartScopeLevel === "controller" },
    );
    if (!raw) return null;
    const builtScoped = mapUnifiedBarnTrendRawToSplitY(
      raw,
      layout,
      undefined,
      overlayAlign,
    );
    if (!builtScoped) return null;
    const pickLayers = maskLayersForYBands(layers, xScope.yBands);
    const pickedScoped = pickUnifiedTrendLayers(builtScoped, pickLayers);
    return {
      categories: builtScoped.categories,
      series: pickedScoped.series,
      envelopes: pickedScoped.envelopes,
      histograms: pickedScoped.histograms,
      tempDomain: builtScoped.tempDomain,
      tempOverflowDomain: builtScoped.tempOverflowDomain,
      thermoWindows: raw.thermoWindows,
    };
  };

  if (
    xScopeRangeMs &&
    window15m &&
    window15mCovers(window15m, xScopeRangeMs.fromMs, xScopeRangeMs.toMs)
  ) {
    const sliced =
      sliceControllerTrendByTime(
        window15m.data,
        xScopeRangeMs.fromMs,
        xScopeRangeMs.toMs,
      ) ?? window15m.data;
    const fake: Record<TrendPeriodId, TrendControllerPeriodData> = {
      "24h": emptyTrendControllerPeriodData("24h"),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": emptyTrendControllerPeriodData("30d"),
      [sliced.period]: sliced,
    };
    const seriesList = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        const found = findControllerTrendSeries(
          fake,
          sliced.period,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
        if (!found) return null;
        return {
          ...found,
          zoneLabel: formatControllerHeaderPrimary(r),
          equipmentLabel: formatControllerHeaderSecondary(r),
          stallTyCode: r.stallTyCode
            ? normalizeStallTyCode(r.stallTyCode)
            : undefined,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    const covered = applyCoverageToWindow(
      seriesList,
      sliced.bucketAts,
      uplinkCoverage,
    );
    const from15m = buildScopedFromSeries(covered, sliced.categories);
    if (from15m) return from15m;
  }

  if (deferredWindowBundle) {
    const slice = mapIndexWindowToSlice(
      picked.categories.length,
      xScope.start,
      xScope.end,
      deferredWindowBundle.categories.length,
    );
    const cats = deferredWindowBundle.categories.slice(slice.from, slice.to);
    if (cats.length >= 2) {
      const series = deferredWindowBundle.seriesList.map((s) =>
        sliceControllerSeries(s, slice.from, slice.to),
      );
      const fromHour = buildScopedFromSeries(series, cats);
      if (fromHour) return fromHour;
    }
  }
  return {
    ...sliceUnifiedTrendByIndex(
      picked.categories,
      picked,
      xScope.start,
      xScope.end,
    ),
    tempDomain: picked.tempDomain,
    tempOverflowDomain: picked.tempOverflowDomain,
    thermoWindows: trendRaw?.thermoWindows
      ? sliceFanControlWindows(
          trendRaw.thermoWindows,
          xScope.start,
          xScope.end + 1,
        )
      : null,
  };
}
