"use client";

import { useDeferredValue, useEffect, useMemo, useSyncExternalStore } from "react";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import { buildTrendBrushOverview, downsampleSeriesForChart } from "@/components/farm/unified-barn-trend-panel-helpers";
import { buildUnifiedBarnTrendWindow } from "@/components/farm/unified-barn-trend-window";
import { useUnifiedChartBandTransition } from "@/components/farm/use-split-y-layout-transition";
import type { UnifiedBarnTrendChromeModel } from "@/components/farm/use-unified-barn-trend-chrome";
import { resolveThresholdsForChartScope } from "@/lib/domain/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/domain/alarms";
import type { BarnReading } from "@/lib/data/iot";
import {
  controllerTrendPeriodHasSeries,
  isContextControllerTrend30d,
  pickTrendCanvasPeriod,
  type TrendControllerPeriodData,
  type TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import { alarmScopeKeyFromFarmChartScope } from "@/lib/farm/farm-chart-scope";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { findControllerTrendSeries } from "@/lib/farm/controller-summary-display";
import type { PanelXScopeEntry } from "@/components/farm/unified-barn-trend-x-scope";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import {
  aggregateUnifiedBarnTrendRaw,
  allocateUnifiedChartBandHeights,
  andSplitYVisibility,
  mapUnifiedBarnTrendRawToSplitY,
  maskLayersForYBands,
  metricAvailabilityFromSeriesList,
  overlayControllerMetricSeries,
  OVERLAY_ALIGN_ANCHOR,
  pickUnifiedTrendLayers,
  replaceAverageMetricSeries,
  resolveUnifiedPlotLayout,
  splitYVisibilityFromLayers,
  countSplitYBands,
  visibilityForYBands,
  type UnifiedMetricAvailability,
} from "@/lib/farm/unified-barn-trend-series";
import { chartUiPx } from "@/lib/ui/farm-chart-ui-scale";

const emptySubscribe = () => () => {};

/**
 * 통합 추세 패널의 창 집계·시리즈 메모.
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 줌 스택 setState는 패널에 남긴다.
 */
export function useUnifiedBarnTrendSeries({
  controllers,
  chartScope,
  alarmSettings,
  chrome,
  controllerTrendByPeriod,
  period,
  hidePeriodBrush,
  uplinkCoverage,
  onMetricAvailable,
  isMobileStack,
  chartHeight,
  xScope,
  overlayControllers,
}: {
  controllers: UnifiedBarnTrendControllerRef[];
  chartScope: FarmChartScope;
  alarmSettings?: AlarmSettings;
  chrome: UnifiedBarnTrendChromeModel;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
  period: TrendPeriodId;
  hidePeriodBrush: boolean;
  uplinkCoverage: UplinkCoverageIndex[];
  onMetricAvailable?: (available: UnifiedMetricAvailability) => void;
  isMobileStack: boolean;
  chartHeight?: number;
  xScope: PanelXScopeEntry | null;
  overlayControllers: boolean;
}) {
  const {
    layers,
    overview,
    plotWidthPx,
    comparisonActive,
    brushWindow,
    lookbackPeriod,
  } = chrome;

  const scopedReadings = useMemo(
    () =>
      controllers
        .map((c) => c.reading)
        .filter((r): r is BarnReading => r != null),
    [controllers],
  );

  const alarmScopeKey = useMemo(
    () => alarmScopeKeyFromFarmChartScope(scopedReadings, chartScope),
    [scopedReadings, chartScope],
  );

  const baseThresholds = useMemo(() => {
    const settings = alarmSettings ?? DEFAULT_ALARM_SETTINGS;
    return resolveThresholdsForChartScope(
      settings,
      alarmScopeKey,
      scopedReadings,
    );
  }, [alarmSettings, alarmScopeKey, scopedReadings]);

  const mappingThresholds = baseThresholds;
  const plotThresholds: AlarmThresholds = useMemo(
    () => ({
      tempLow: Number.isFinite(mappingThresholds.tempLow) ? mappingThresholds.tempLow : 0,
      tempHigh: Number.isFinite(mappingThresholds.tempHigh) ? mappingThresholds.tempHigh : 50,
      humidityLow: 0,
      humidityHigh: 100,
    }),
    [mappingThresholds],
  );

  const layerVisibility = useMemo(
    () => splitYVisibilityFromLayers(layers),
    [layers],
  );
  const metricAvailable = useMemo(() => {
    const periodId = overview
      ? "24h"
      : pickTrendCanvasPeriod(
          controllerTrendByPeriod,
          period,
        );
    const periodData = controllerTrendByPeriod?.[periodId];
    if (!periodData) {
      return { temp: false, hum: false, motors: false };
    }
    const list = controllers
      .map((c) => {
        const r = c.reading;
        if (!r) return null;
        return findControllerTrendSeries(
          controllerTrendByPeriod,
          periodId,
          r.stallTyCode,
          r.stallNo,
          r.controllerKey,
        );
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    if (!list.length) {
      return { temp: false, hum: false, motors: false };
    }
    return metricAvailabilityFromSeriesList(list);
  }, [controllers, controllerTrendByPeriod, period, overview]);
  useEffect(() => {
    onMetricAvailable?.(metricAvailable);
  }, [metricAvailable, onMetricAvailable]);
  const dataVisibility = useMemo(
    () => andSplitYVisibility(layerVisibility, metricAvailable),
    [layerVisibility, metricAvailable],
  );
  /** 켜진 플롯 밴드가 2개 이상이면 오버레이(분할 보기 없음) */
  const overlayAvailable = countSplitYBands(dataVisibility) >= 2;
  const overlayActive = overlayAvailable;
  const overlayAlign = overlayActive ? OVERLAY_ALIGN_ANCHOR : undefined;
  const scopeVisibility = useMemo(() => {
    const bandVis = visibilityForYBands(xScope?.yBands ?? null);
    if (!bandVis) return dataVisibility;
    return {
      showTemp: dataVisibility.showTemp && bandVis.showTemp,
      showHum: dataVisibility.showHum && bandVis.showHum,
      showMotors: dataVisibility.showMotors && bandVis.showMotors,
      showCommand: dataVisibility.showCommand && bandVis.showCommand,
    };
  }, [dataVisibility, xScope]);
  const targetPlot = useMemo(
    () => resolveUnifiedPlotLayout(scopeVisibility, plotThresholds, overlayActive),
    [scopeVisibility, plotThresholds, overlayActive],
  );
  const chartLeftUnit = targetPlot.leftUnit;
  /** 브러시 캔버스 여부 — 높이 풀·레이아웃 보간을 같은 훅에서 맞추기 위해 조기 계산 */
  /** 펼친 카드: 30일 트랙 + 24시간 창. 휠이 왼쪽(과거)을 바로 연다. 일괄 칸은 24시간만. */
  const useBrushCanvas =
    !overview &&
    isContextControllerTrend30d(controllerTrendByPeriod?.["30d"]) &&
    controllerTrendPeriodHasSeries(controllerTrendByPeriod?.["30d"]);
  const baseChartPlotH =
    chartHeight ?? (isMobileStack ? chartUiPx(320) : chartUiPx(340));
  const targetBandHeights = useMemo(
    () =>
      allocateUnifiedChartBandHeights({
        totalContentPx: baseChartPlotH,
        visibility: {
          showTemp: scopeVisibility.showTemp,
          showHum: scopeVisibility.showHum,
          showMotors: scopeVisibility.showMotors,
          showCommand: false,
        },
        minCommandPx: chartUiPx(90),
        minPlotPx: chartUiPx(48),
        commandOnlyPlotGutterPx: chartUiPx(72),
      }),
    [
      baseChartPlotH,
      scopeVisibility.showTemp,
      scopeVisibility.showHum,
      scopeVisibility.showMotors,
    ],
  );
  const { layout, heights: bandHeights } = useUnifiedChartBandTransition(
    targetPlot.layout,
    targetBandHeights,
  );
  const chartPlotHeight = bandHeights.plotPx;
  /** 드래그 hit/미리보기 — 레이어 기준(스코프 전) */
  const layerLayout = useMemo(
    () =>
      resolveUnifiedPlotLayout(layerVisibility, plotThresholds, overlayActive)
        .layout,
    [layerVisibility, plotThresholds, overlayActive],
  );

  /** 브러시 — 30일 1시간 양호도 */
  const brushOverview = useMemo(
    () =>
      hidePeriodBrush
        ? []
        : buildTrendBrushOverview(
            controllers,
            controllerTrendByPeriod,
            alarmSettings,
          ),
    [hidePeriodBrush, controllers, controllerTrendByPeriod, alarmSettings],
  );

  const splitBandGuides = useMemo(() => {
    const guides: number[] = [];
    const motorH = layout.motorHi - layout.motorLo;
    const humH = layout.humHi - layout.humLo;
    const tempH = layout.tempHi - layout.tempLo;
    /** 모터↔환경 구분만. 온도·습도 사이 점선은 표시하지 않음 */
    if (motorH > 0.5 && (humH > 0.5 || tempH > 0.5)) {
      guides.push(layout.motorHi);
    }
    return guides;
  }, [layout]);

  const canvasPeriod: TrendPeriodId = overview
    ? "24h"
    : pickTrendCanvasPeriod(controllerTrendByPeriod, period);
  const context30d = useBrushCanvas;
  const displayPeriod = overview
    ? "24h"
    : useBrushCanvas
      ? lookbackPeriod
      : canvasPeriod;

  /** 펼친 기본·휠 = 30일 1시간 슬라이스. 미니 = 24시간 2시간 평균. 15분은 드래그 줌만. */
  const windowBundle = useMemo(
    () =>
      buildUnifiedBarnTrendWindow({
        controllers,
        controllerTrendByPeriod,
        canvasPeriod,
        useBrushCanvas,
        context30d,
        brushWindow,
        uplinkCoverage,
        overview,
        comparisonActive,
      }),
    [
      controllers,
      controllerTrendByPeriod,
      canvasPeriod,
      useBrushCanvas,
      context30d,
      brushWindow,
      uplinkCoverage,
      overview,
      comparisonActive,
    ],
  );
  /** SSR/첫 hydration은 셸만 맞추고 SVG용 집계는 background render에서 계산한다. */
  const clientReady = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const deferredWindowBundle = useDeferredValue(
    clientReady ? windowBundle : null,
  );
  const renderPending =
    windowBundle !== null && deferredWindowBundle !== windowBundle;

  /** M1 — 다운샘플+집계는 layout 무관 1회, 보간은 Y매핑만 */
  const downsampledWindow = useMemo(() => {
    if (!deferredWindowBundle) return null;
    // A comparison uses the shared hourly grid (at most 720 buckets). Independent
    // LTTB sampling would give the same zoom ratios different timestamps.
    if (comparisonActive) return deferredWindowBundle;
    return downsampleSeriesForChart(
      deferredWindowBundle.seriesList,
      deferredWindowBundle.categories,
      plotWidthPx,
    );
  }, [deferredWindowBundle, plotWidthPx, comparisonActive]);

  const trendRaw = useMemo(() => {
    if (!downsampledWindow) return null;
    return aggregateUnifiedBarnTrendRaw(
      downsampledWindow.seriesList,
      downsampledWindow.categories,
      plotThresholds,
      { includeThermo: chartScope.level === "controller" },
    );
  }, [downsampledWindow, plotThresholds, chartScope.level]);

  const built = useMemo(() => {
    if (!trendRaw) return null;
    return mapUnifiedBarnTrendRawToSplitY(
      trendRaw,
      layout,
      undefined,
      overlayAlign,
    );
  }, [trendRaw, layout, overlayAlign]);

  const picked = useMemo(() => {
    if (!built) return null;
    const pickLayers = maskLayersForYBands(layers, xScope?.yBands ?? null);
    const raw = pickUnifiedTrendLayers(built, pickLayers);
    const overlayPack =
      overlayControllers && downsampledWindow
        ? overlayControllerMetricSeries({
            seriesList: downsampledWindow.seriesList,
            categories: downsampledWindow.categories,
            thresholds: plotThresholds,
            layout,
            overlayAlign,
            layers: pickLayers,
          })
        : { series: [], tempOverflowDomain: null };
    /** 스코프 인덱스 안정 — 자동 trim과 X/Y 줌 충돌 방지 */
    return {
      categories: built.categories,
      series: replaceAverageMetricSeries(raw.series, overlayPack.series),
      envelopes: raw.envelopes,
      histograms: raw.histograms,
      trimmed: false as const,
      tempDomain: built.tempDomain,
      tempOverflowDomain: overlayPack.series.length
        ? overlayPack.tempOverflowDomain
        : built.tempOverflowDomain,
    };
  }, [
    built,
    layers,
    xScope?.yBands,
    overlayControllers,
    downsampledWindow,
    plotThresholds,
    layout,
    overlayAlign,
  ]);

  return {
    alarmScopeKey,
    mappingThresholds,
    plotThresholds,
    layerVisibility,
    overlayActive,
    overlayAlign,
    scopeVisibility,
    chartLeftUnit,
    useBrushCanvas,
    layout,
    chartPlotHeight,
    layerLayout,
    brushOverview,
    splitBandGuides,
    displayPeriod,
    windowBundle,
    deferredWindowBundle,
    renderPending,
    trendRaw,
    built,
    picked,
  };
}

export type UnifiedBarnTrendSeriesModel = ReturnType<
  typeof useUnifiedBarnTrendSeries
>;
