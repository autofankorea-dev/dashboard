"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { TrendCommandSettingSeg } from "@/components/trends/trend-chart";
import { buildUnifiedCommandSettingSegs } from "@/components/farm/unified-barn-trend-command-overlay";
import {
  resolveGuidedScopePlayback,
  type GuidedScopePlayback,
} from "@/components/farm/unified-barn-trend-guided-scope";
import { buildFarmTrendScaleEdges } from "@/components/farm/unified-barn-trend-scale-edges";
import { rebuildScopedUnifiedBarnTrend } from "@/components/farm/unified-barn-trend-scoped";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import type { PanelXScopeEntry } from "@/components/farm/unified-barn-trend-x-scope";
import {
  UnifiedTrendLayerToolbar,
  applyLayerGroupMode,
  detectLayerGroupMode,
  nextLayerGroupMode,
  type SharedChartLayerDisplay,
} from "@/components/farm/unified-trend-layer-toolbar";
import type { UnifiedBarnTrendChromeModel } from "@/components/farm/use-unified-barn-trend-chrome";
import type { UnifiedBarnTrendSeriesModel } from "@/components/farm/use-unified-barn-trend-series";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { invertSplitYCrosshairValues } from "@/lib/farm/farm-crosshair-readout";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
  TrendWindow15m,
} from "@/lib/domain/farm-trend-types";
import type { UplinkCoverageIndex } from "@/lib/farm/trend-uplink-coverage";
import type { GuidedScopeRect } from "@/lib/ui/guided-scope-jitter";
import { motionClass } from "@/lib/ui/motion-classes";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { cn } from "@/lib/utils";

const EMPTY_CHART_CATEGORIES: string[] = [];

/**
 * 통합 추세 패널의 스코프 재집계·경보 눈금·레이어 툴바.
 * 줌 스택 setState와 humanize 캐시는 패널에 남긴다.
 */
export function useUnifiedBarnTrendView({
  series,
  chrome,
  xScope,
  xScopeStack,
  xScopeRangeMs,
  guidedScopeBase,
  guidedJitterCache,
  guideReadyToken,
  alarmEditEnabled,
  window15m,
  controllers,
  uplinkCoverage,
  chartScope,
  commandPaneOpen,
  sharedLayers,
  layersToolbarActive,
  trendLoading,
  trendError,
  controllerTrendByPeriod,
}: {
  series: UnifiedBarnTrendSeriesModel;
  chrome: UnifiedBarnTrendChromeModel;
  xScope: PanelXScopeEntry | null;
  xScopeStack: PanelXScopeEntry[];
  xScopeRangeMs: { fromMs: number; toMs: number } | null;
  guidedScopeBase: GuidedScopePlayback | null;
  guidedJitterCache: { token: number; rect: GuidedScopeRect } | null;
  guideReadyToken: number;
  alarmEditEnabled: boolean;
  window15m: TrendWindow15m | null;
  controllers: UnifiedBarnTrendControllerRef[];
  uplinkCoverage: UplinkCoverageIndex[];
  chartScope: FarmChartScope;
  commandPaneOpen: boolean;
  sharedLayers?: SharedChartLayerDisplay;
  layersToolbarActive: boolean;
  trendLoading: boolean;
  trendError: boolean;
  controllerTrendByPeriod?: Record<TrendPeriodId, TrendControllerPeriodData> | null;
}) {
  const {
    picked,
    deferredWindowBundle,
    plotThresholds,
    layout,
    trendRaw,
    overlayAlign,
    built,
    scopeVisibility,
    overlayActive,
    useBrushCanvas,
    chartPlotHeight,
    mappingThresholds,
    chartLeftUnit,
    renderPending,
  } = series;
  const {
    layers,
    plotWidthPx,
    comparisonActive,
    commandChannels,
    alarmRangeOn,
    setOwnedLayers,
    layersToolbarMounted,
    layersToolbarPhase,
    layersAnimKey,
    setLayersToolbarMounted,
    setOwnedAlarmRangeOn,
    overview,
  } = chrome;

  const scoped = useMemo(() => {
    return rebuildScopedUnifiedBarnTrend({
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
      chartScopeLevel: chartScope.level,
      trendRaw,
      overlayAlign,
      comparisonActive,
    });
  }, [
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
    chartScope.level,
    trendRaw,
    overlayAlign,
    comparisonActive,
  ]);

  const chartCategories = scoped?.categories ?? EMPTY_CHART_CATEGORIES;
  const tempMapDomain = scoped?.tempDomain ?? built?.tempDomain;
  const tempMapOverflow =
    scoped?.tempOverflowDomain ?? built?.tempOverflowDomain ?? null;
  const crosshairValues = useCallback(
    (chartY: number) =>
      invertSplitYCrosshairValues(chartY, {
        layout,
        visibility: scopeVisibility,
        overlay: overlayActive,
        overlayAlign,
        tempLow: plotThresholds.tempLow,
        tempHigh: plotThresholds.tempHigh,
        humidityLow: plotThresholds.humidityLow,
        humidityHigh: plotThresholds.humidityHigh,
        tempDomain: overlayAlign ? undefined : tempMapDomain,
        tempOverflowDomain: tempMapOverflow,
      }),
    [
      layout,
      scopeVisibility,
      overlayActive,
      overlayAlign,
      plotThresholds.tempLow,
      plotThresholds.tempHigh,
      plotThresholds.humidityLow,
      plotThresholds.humidityHigh,
      tempMapDomain,
      tempMapOverflow,
    ],
  );
  const tempMapLayout = built?.layout ?? layout;
  const commandOverlayBase =
    commandPaneOpen &&
    chartScope.level === "controller" &&
    useBrushCanvas;
  const showTempCommandOverlay = commandOverlayBase && Boolean(layers.temp);
  const showMotorCommandOverlay =
    commandOverlayBase &&
    !overlayActive &&
    Boolean(layers.motors || layers.motorCh) &&
    layout.motorHi > layout.motorLo;
  const showCommandOverlay = showTempCommandOverlay || showMotorCommandOverlay;
  const commandSettingSegs = useMemo(
    (): TrendCommandSettingSeg[] =>
      buildUnifiedCommandSettingSegs({
        showCommandOverlay,
        showTempCommandOverlay,
        showMotorCommandOverlay,
        hasBuilt: Boolean(built),
        windows: scoped?.thermoWindows,
        categories: scoped?.categories ?? [],
        tempLow: plotThresholds.tempLow,
        tempHigh: plotThresholds.tempHigh,
        tempBandLo: layout.tempLo,
        tempBandHi: layout.tempHi,
        layout: tempMapLayout,
        tempDomain: tempMapDomain,
        tempOverflowDomain: tempMapOverflow,
        overlayAlign,
        commandChannels,
      }),
    [
      showCommandOverlay,
      showTempCommandOverlay,
      showMotorCommandOverlay,
      built,
      scoped?.thermoWindows,
      scoped?.categories,
      plotThresholds.tempLow,
      plotThresholds.tempHigh,
      layout.tempLo,
      layout.tempHi,
      tempMapLayout,
      tempMapDomain,
      tempMapOverflow,
      overlayAlign,
      commandChannels,
    ],
  );
  const chartPlotHeightForChart = chartPlotHeight;

  const resolvedGuidedXScope = useMemo(() => {
    if (
      !guidedScopeBase ||
      !guidedJitterCache ||
      guidedJitterCache.token !== guidedScopeBase.token
    ) {
      return null;
    }
    return resolveGuidedScopePlayback(
      guidedScopeBase,
      guidedJitterCache.rect,
    );
  }, [guidedScopeBase, guidedJitterCache]);

  /**
   * 스택이 비워진 뒤에만 시연 — 기존 X스코프 위에서 비율을 쓰면
   * 잘린 카테고리 기준으로 엉뚱한 구간이 커밋됨.
   */
  const activeGuidedXScope =
    resolvedGuidedXScope &&
    guideReadyToken === resolvedGuidedXScope.token &&
    xScopeStack.length === 0
      ? resolvedGuidedXScope
      : null;

  /** 현재 장비 경보 상·하한과 실측 축 눈금. */
  const { scaleEdgeLabels, alarmRangeBands } = useMemo(
    () =>
      buildFarmTrendScaleEdges({
        built,
        layers,
        plotThresholds,
        mappingThresholds,
        layout,
        scopeVisibility,
        alarmEditEnabled,
        tempMapLayout,
        tempMapDomain,
        tempMapOverflow,
        chartLeftUnit,
        overlayActive,
        overlayAlign,
        alarmRangeOn,
      }),
    [
      built,
      layers,
      plotThresholds,
      mappingThresholds,
      layout,
      scopeVisibility,
      alarmEditEnabled,
      tempMapLayout,
      tempMapDomain,
      tempMapOverflow,
      chartLeftUnit,
      overlayActive,
      overlayAlign,
      alarmRangeOn,
    ],
  );
  const cycleGroupLayers = (group: "temp" | "hum" | "motor") => {
    if (!built || sharedLayers) return;
    setOwnedLayers((prev) => {
      const mode = detectLayerGroupMode(prev, built.available, group);
      const nextMode = nextLayerGroupMode(mode);
      return applyLayerGroupMode(prev, group, nextMode, built.available);
    });
  };

  useEffect(() => {
    if (layersToolbarActive || layersToolbarPhase !== "exit") return;
    const t = window.setTimeout(() => {
      setLayersToolbarMounted(false);
    }, motionDuration.exit);
    return () => window.clearTimeout(t);
  }, [layersToolbarActive, layersToolbarPhase, layersAnimKey, setLayersToolbarMounted]);

  const layerToolbar =
    !sharedLayers && !overview && built != null && layersToolbarMounted ? (
      <div
        key={layersAnimKey}
        className={cn(
          "farm-chart-toolbar-fit flex w-full min-w-0 shrink-0 items-center overflow-visible",
          layersToolbarPhase === "enter"
            ? motionClass.farmChartLayersEnter
            : motionClass.farmChartLayersExit,
        )}
        data-farm-chart-layers-shell=""
        data-farm-chart-layers-placement="inline"
        aria-hidden={layersToolbarPhase === "exit"}
      >
        <UnifiedTrendLayerToolbar
          layers={layers}
          available={built.available}
          metricsPending={Boolean(
            renderPending ||
              trendLoading ||
              (!controllerTrendByPeriod && !trendError),
          )}
          onCycleGroup={cycleGroupLayers}
          placement="inline"
          tempAlarmOn={alarmRangeOn.temp}
          humAlarmOn={alarmRangeOn.hum}
          tempAlarmAvailable={Boolean(
            scopeVisibility.showTemp && layers.temp && built.available.temp,
          )}
          humAlarmAvailable={false}
          onToggleTempAlarm={() =>
            setOwnedAlarmRangeOn((prev) => ({ ...prev, temp: !prev.temp }))
          }
        />
      </div>
    ) : null;

  return {
    scoped,
    chartCategories,
    crosshairValues,
    showCommandOverlay,
    commandSettingSegs,
    chartPlotHeightForChart,
    scaleEdgeLabels,
    alarmRangeBands,
    activeGuidedXScope,
    layerToolbar,
  };
}

export type UnifiedBarnTrendViewModel = ReturnType<typeof useUnifiedBarnTrendView>;
