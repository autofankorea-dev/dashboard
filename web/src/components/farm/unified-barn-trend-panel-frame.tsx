"use client";

import { type CSSProperties, type ReactNode } from "react";
import { UnifiedBarnTrendChart } from "@/components/farm/unified-barn-trend-chart";
import { UnifiedBarnTrendPanelHeader } from "@/components/farm/unified-barn-trend-panel-header";
import type { UnifiedBarnTrendControllerRef } from "@/components/farm/unified-barn-trend-scope-marks";
import {
  CommandChannelLayerToolbar,
} from "@/components/farm/unified-trend-layer-toolbar";
import { UnifiedTrendPeriodBrush } from "@/components/farm/unified-trend-period-brush";
import type { UnifiedBarnTrendChromeModel } from "@/components/farm/use-unified-barn-trend-chrome";
import type { UnifiedBarnTrendSeriesModel } from "@/components/farm/use-unified-barn-trend-series";
import type { UnifiedBarnTrendViewModel } from "@/components/farm/use-unified-barn-trend-view";
import type { PanelXScopeEntry } from "@/components/farm/unified-barn-trend-x-scope";
import type {
  TrendControllerPeriodData,
  TrendPeriodId,
} from "@/lib/domain/farm-trend-types";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { toggleCommandChannelFlag } from "@/lib/farm/command-hold-bands";
import { dashboardChroma } from "@/lib/ui/dashboard-page-ui";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import { useSheetCopy } from "@/components/account/profile-sheet-prefs";
import { cn } from "@/lib/utils";

type FrameProps = UnifiedBarnTrendChromeModel &
  UnifiedBarnTrendSeriesModel &
  UnifiedBarnTrendViewModel & {
    label: string;
    className?: string;
    plotFill: boolean;
    headingMode: "full" | "widget" | "overview";
    isMobileStack: boolean;
    xScope: PanelXScopeEntry | null;
    xScopeStack: PanelXScopeEntry[];
    chartScope: FarmChartScope;
    controllers: UnifiedBarnTrendControllerRef[];
    mobileScopeHandle: { open: boolean; onOpen: () => void } | null;
    headerActions: ReactNode;
    period: TrendPeriodId;
    onScopeChange?: (scope: FarmChartScope) => void;
    onGuidedXScopeComplete?: () => void;
    trendExtending: boolean;
    window15mLoading: boolean;
    trendLoading: boolean;
    trendError: boolean;
    controllerTrendByPeriod?: Record<
      TrendPeriodId,
      TrendControllerPeriodData
    > | null;
    controllerSelectEmpty: boolean;
    hidePeriodBrush: boolean;
    scopeMotionKey: number;
    scopeMotionDir: "in" | "out";
    clearXScope: () => void;
    commitXScope: (
      range: {
        start: number;
        end: number;
        yStartRatio: number;
        yEndRatio: number;
      },
      mode?: "push" | "replace",
      opts?: { timeOnly?: boolean },
    ) => void;
    popXScope: () => void;
  };

/**
 * 통합 추세 패널의 화면.
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 */
export function UnifiedBarnTrendPanelFrame({
  label,
  className,
  plotFill,
  headingMode,
  isMobileStack,
  overview,
  chartUiScale,
  xScope,
  xScopeStack,
  chartScope,
  controllers,
  mobileScopeHandle,
  headerActions,
  layerToolbar,
  built,
  picked,
  trendExtending,
  window15mLoading,
  scoped,
  showCommandOverlay,
  chartCategories,
  chartPlotHeightForChart,
  commandSettingSegs,
  chartLeftUnit,
  displayPeriod,
  alarmScopeKey,
  period,
  layers,
  scopeMotionKey,
  clearXScope,
  onChartPlotWidth,
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
  onScopeChange,
  overlayActive,
  crosshairValues,
  commandChannels,
  setCommandChannels,
  useBrushCanvas,
  hidePeriodBrush,
  brushWindow,
  applyBrushWindow,
  brushOverview,
  trendLoading,
  controllerTrendByPeriod,
  trendError,
  renderPending,
  controllerSelectEmpty,
}: FrameProps) {
  const t = useSheetCopy();
  return (
    <div
      className={cn(
        "select-none",
        farmChartUi.root,
        (isMobileStack || overview) && farmChartUi.yGutterCompact,
        plotFill
          ? "relative flex min-h-0 flex-1 flex-col gap-2"
          : overview
            ? "mt-0 flex min-h-0 flex-1 flex-col"
            : "mt-2 space-y-2",
        className,
      )}
      style={
        {
          ["--farm-chart-ui-scale"]: String(chartUiScale),
          ...(overview
            ? { ["--farm-chart-y-gutter-width"]: "0px" }
            : {}),
        } as CSSProperties
      }
      data-tour-id="farm-chart-unified-trend"
      data-farm-chart-ui-scale={String(chartUiScale)}
      data-farm-chart-y-bands={
        xScope?.yBands?.length ? xScope.yBands.join("+") : "all"
      }
      data-farm-chart-temp-focus={
        xScope?.yBands?.length === 1 && xScope.yBands[0] === "temp"
          ? "true"
          : "false"
      }
    >
      <UnifiedBarnTrendPanelHeader
        headingMode={headingMode}
        label={label}
        chartScope={chartScope}
        controllers={controllers}
        isMobileStack={isMobileStack}
        mobileScopeHandle={mobileScopeHandle}
        headerActions={headerActions}
        layerToolbar={layerToolbar}
        controllerCount={built?.controllerCount ?? 0}
        trimmed={Boolean(picked?.trimmed)}
      />

      {overview ? null : trendExtending || window15mLoading ? (
        <p
          className={cn("text-muted-foreground", farmChartUi.fsMeta)}
          role="status"
        >
          {window15mLoading ? t("chart.loadingDetail") : t("chart.loadingRecent")}
        </p>
      ) : null}

      {built &&
      scoped &&
      picked &&
      (scoped.series.length > 0 ||
        scoped.histograms.length > 0 ||
        showCommandOverlay) ? (
        <div
          className={cn(
            plotFill
              ? cn(
                  "flex min-h-0 flex-1 flex-col",
                  headingMode === "widget" ? "gap-1.5" : "gap-3",
                )
              : "space-y-3",
          )}
        >
        <div
          data-tour-id="chart-control-plot"
          data-chart-mode="view"
          className={plotFill ? "flex min-h-0 flex-1 flex-col" : undefined}
        >
        <div
          className={
            plotFill ? "flex h-full min-h-0 flex-1 flex-col" : undefined
          }
        >
        <UnifiedBarnTrendChart
          plotFill={plotFill}
          headingMode={headingMode}
          overview={overview}
          isMobileStack={isMobileStack}
          categories={chartCategories}
          series={scoped.series}
          envelopes={scoped.envelopes}
          histograms={scoped.histograms}
          chartPlotHeight={chartPlotHeightForChart}
          commandSettingSegs={commandSettingSegs}
          chartLeftUnit={chartLeftUnit}
          leftDomain={built.leftDomain}
          displayPeriod={displayPeriod}
          alarmScopeKey={alarmScopeKey}
          period={period}
          layers={layers}
          xScope={xScope}
          scopeCategories={picked.categories}
          xScopeStackLength={xScopeStack.length}
          scopeMotionKey={scopeMotionKey}
          clearXScope={clearXScope}
          onPlotWidthChange={onChartPlotWidth}
          splitBandGuides={splitBandGuides}
          scaleEdgeLabels={scaleEdgeLabels}
          alarmRangeBands={alarmRangeBands}
          onLookbackWheel={onLookbackWheel}
          commitXScope={commitXScope}
          activeGuidedXScope={activeGuidedXScope}
          comparisonActive={comparisonActive}
          onGuidedXScopeComplete={onGuidedXScopeComplete}
          popXScope={popXScope}
          scopeMotionDir={scopeMotionDir}
          chartScope={chartScope}
          onScopeChange={onScopeChange}
          overlayActive={overlayActive}
          crosshairValues={crosshairValues}
        />
        </div>
        {showCommandOverlay ? (
          <div
            className={cn(
              headingMode === "widget"
                ? "pointer-events-none absolute bottom-[calc(1.6rem*var(--farm-chart-ui-scale,1)+0.35rem)] left-2 z-[3]"
                : "mt-2 flex shrink-0 justify-start overflow-visible",
            )}
          >
            <div
              className={
                headingMode === "widget" ? "pointer-events-auto" : undefined
              }
            >
            <CommandChannelLayerToolbar
              channels={commandChannels}
              onToggle={(channel) =>
                setCommandChannels((prev) =>
                  toggleCommandChannelFlag(prev, channel),
                )
              }
            />
            </div>
          </div>
        ) : null}
        </div>
        </div>
      ) : overview &&
        (trendLoading ||
          (!controllerTrendByPeriod && !trendError) ||
          (trendExtending && !built)) ? (
        <div
          className={cn(
            dashboardChroma.skeletonBone,
            "mx-2 mb-2 min-h-16 flex-1",
          )}
          role="status"
          aria-label={t("chart.loading")}
        />
      ) : (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {built
            ? t("chart.pickLayers")
            : renderPending ||
                trendLoading ||
                (!controllerTrendByPeriod && !trendError)
              ? t("chart.loading")
                : trendExtending
                ? t("chart.loadingRecent")
                : window15mLoading
                  ? t("chart.loadingDetail")
                  : trendError
                    ? t("chart.loadFailed")
                    : controllerSelectEmpty
                      ? t("chart.pickControllers")
                    : t("chart.empty")}
        </p>
      )}

      {useBrushCanvas && !hidePeriodBrush ? (
        <div className="shrink-0">
        <UnifiedTrendPeriodBrush
          window={brushWindow}
          onWindowChange={(next) => {
            clearXScope();
            applyBrushWindow(next);
          }}
          overviewValues={brushOverview}
          xScope={xScope}
          chartPointCount={picked?.categories.length ?? 0}
        />
        </div>
      ) : null}
    </div>
  );
}
