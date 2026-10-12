"use client";

import { TrendChart } from "@/components/trends/trend-chart";
import type { TrendChartProps } from "@/components/trends/trend-chart-props";
import type { GuidedXScopeGesture } from "@/components/farm/unified-barn-trend-guided-scope";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type {
  TrendCommandSettingSeg,
  TrendEnvelope,
  TrendHistogram,
  TrendRangeBand,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { scopesEqual } from "@/lib/farm/farm-chart-scope";
import {
  formatTrendScopeRangeLabel,
  tickEveryForDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import {
  isSingleYBandFocus,
  unifiedYBandsScopeLabel,
  type UnifiedLayerFlags,
  type UnifiedYBandId,
} from "@/lib/farm/unified-barn-trend-series";
import { chartUiPx, farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type ScopeRange = {
  start: number;
  end: number;
  yStartRatio: number;
  yEndRatio: number;
};

/**
 * 통합 추세 패널이 TrendChart에 넘기는 값.
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 줌 스택 setState는 패널에 남긴다.
 */
export function UnifiedBarnTrendChart({
  plotFill,
  headingMode,
  overview,
  isMobileStack,
  categories,
  series,
  envelopes,
  histograms,
  chartPlotHeight,
  commandSettingSegs,
  chartLeftUnit,
  leftDomain,
  displayPeriod,
  alarmScopeKey,
  period,
  layers,
  xScope,
  scopeCategories,
  xScopeStackLength,
  scopeMotionKey,
  clearXScope,
  onPlotWidthChange,
  splitBandGuides,
  scaleEdgeLabels,
  alarmRangeBands,
  onLookbackWheel,
  commitXScope,
  activeGuidedXScope,
  comparisonActive,
  onGuidedXScopeComplete,
  popXScope,
  scopeMotionDir,
  chartScope,
  onScopeChange,
  overlayActive,
  crosshairValues,
}: {
  plotFill: boolean;
  headingMode: "full" | "widget" | "overview";
  overview: boolean;
  isMobileStack: boolean;
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  chartPlotHeight: number;
  commandSettingSegs: TrendCommandSettingSeg[];
  chartLeftUnit: string;
  leftDomain: [number, number];
  displayPeriod: TrendPeriodId;
  alarmScopeKey: string | null;
  period: TrendPeriodId;
  layers: UnifiedLayerFlags;
  xScope: { start: number; end: number; yBands: UnifiedYBandId[] | null } | null;
  scopeCategories: string[];
  xScopeStackLength: number;
  scopeMotionKey: number;
  clearXScope: () => void;
  onPlotWidthChange: (widthPx: number) => void;
  splitBandGuides: number[];
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  alarmRangeBands: TrendRangeBand[];
  onLookbackWheel: (dir: 1 | -1) => void;
  commitXScope: (
    range: ScopeRange,
    mode?: "push" | "replace",
    opts?: { timeOnly?: boolean },
  ) => void;
  activeGuidedXScope: GuidedXScopeGesture | null;
  comparisonActive: boolean;
  onGuidedXScopeComplete?: () => void;
  popXScope: () => void;
  scopeMotionDir: "in" | "out";
  chartScope: FarmChartScope;
  onScopeChange?: (scope: FarmChartScope) => void;
  overlayActive: boolean;
  crosshairValues: NonNullable<TrendChartProps["crosshairValues"]>;
}) {
  const focusBandActive = isSingleYBandFocus(xScope?.yBands)
    ? xScope.yBands[0]
    : null;
  const scopeYLabel = unifiedYBandsScopeLabel(xScope?.yBands ?? null);
  const focusBandTint = (band: UnifiedYBandId | null | undefined) => {
    if (band === "temp" || band === "overlay") return dashboardUi.channelTintTemp;
    if (band === "hum") return dashboardUi.channelTintHum;
    if (band === "motor") return dashboardUi.channelTintMotor;
    if (band === "command") return dashboardUi.channelTintCommand;
    return dashboardUi.channelTintInfo;
  };

  return (
        <TrendChart
          mode="line"
          onPlotWidthChange={onPlotWidthChange}
          fillParent={plotFill}
          categories={categories}
          series={series}
          envelopes={envelopes}
          histograms={histograms}
          height={plotFill ? 48 : chartPlotHeight}
          eventLane={null}
          eventLaneHeight={0}
          commandSettingSegs={commandSettingSegs}
          leftUnit={chartLeftUnit}
          yAxisTicks={chartLeftUnit ? "thirds" : "full"}
          leftDomain={leftDomain}
          period={displayPeriod}
          pinResetKey={`${alarmScopeKey ?? ""}|${period ?? ""}`}
          tickEvery={tickEveryForDisplayBars(categories.length, {
            compact: isMobileStack || overview,
          })}
          showLegend={headingMode !== "widget" && headingMode !== "overview"}
          legendTrailing={
            xScope != null ? (
              <div
                key={`scope-chip-${scopeMotionKey}`}
                className={cn(
                  "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-medium",
                  farmChartUi.fsMeta,
                  focusBandTint(focusBandActive),
                  motionClass.farmChartScopeChipIn,
                )}
              >
                {xScopeStackLength > 1 ? (
                  <span className="shrink-0 tabular-nums opacity-80">
                    ×{xScopeStackLength}
                  </span>
                ) : null}
                {scopeYLabel ? (
                  <span className="shrink-0 opacity-90">{scopeYLabel}</span>
                ) : null}
                <span className="min-w-0 truncate tabular-nums">
                  {formatTrendScopeRangeLabel(
                    scopeCategories[xScope.start] ?? "",
                    scopeCategories[xScope.end] ?? "",
                  )}
                </span>
                <button
                  type="button"
                  aria-label="스코프 해제"
                  onClick={clearXScope}
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded border border-current/30",
                    "hover:bg-black/5 dark:hover:bg-white/10",
                    motionClass.microHover,
                  )}
                >
                  ×
                </button>
              </div>
            ) : null
          }
          legendDensity={
            isMobileStack ||
            !(
              layers.ema ||
              layers.humEma ||
              layers.dev ||
              layers.humDev ||
              layers.band ||
              layers.humBand ||
              layers.motorCh
            )
              ? "core"
              : "full"
          }
          scaleEdgeHitPx={isMobileStack ? chartUiPx(22) : chartUiPx(10)}
          labelGutter={isMobileStack && !plotFill && !overview}
          hideAxisChrome={overview}
          showMarkers={!overview}
          markerDensity={categories.length <= 48 ? "all" : "sparse"}
          // Data dots have their own pixel size, independent of toolbar/text scale.
          markerRadiusPx={isMobileStack ? 1.4 : 1.6}
          animate={!overview}
          layerClipWipe={!overview}
          splitBandGuides={splitBandGuides}
          scaleEdgeLabels={overview ? [] : scaleEdgeLabels}
          rangeBands={overview ? [] : alarmRangeBands}
          xScopeSelect={!overview}
          onLookbackWheel={overview ? undefined : onLookbackWheel}
          onXScopeCommit={(range) =>
            commitXScope(range, activeGuidedXScope ? "replace" : "push", { timeOnly: comparisonActive })
          }
          guidedXScopeGesture={activeGuidedXScope}
          onGuidedXScopeComplete={onGuidedXScopeComplete}
          onXScopeBack={popXScope}
          scopeMotionKey={scopeMotionKey}
          scopeMotionDir={scopeMotionDir}
          onBreachEquipmentNavigate={
            onScopeChange
              ? (target) => {
                  const next: FarmChartScope = {
                    level: "controller",
                    stallTyCode: target.stallTyCode,
                    stallNo: target.stallNo,
                    controllerKey: target.controllerKey,
                  };
                  if (scopesEqual(chartScope, next)) return;
                  onScopeChange(next);
                }
              : undefined
          }
          overlayHoverMerge={overlayActive}
          crosshairValues={crosshairValues}
        />
  );
}
