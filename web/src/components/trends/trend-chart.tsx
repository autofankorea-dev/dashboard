"use client";

import { cn } from "@/lib/utils";
import type {
  ScaleEdgeDragEvent,
  ScaleEdgeNumericCommitEvent,
  TrendAxis,
  TrendBreachNavTarget,
  TrendCommandSettingSeg,
  TrendEnvelope,
  TrendEnvelopePolyPoint,
  TrendEventLane,
  TrendEventMark,
  TrendHistogram,
  TrendRangeBand,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendSeries,
  TrendSpreadContributor,
  TrendSpreadExtremes,
} from "@/lib/domain/trend-chart-types";
import { PAD_TOP } from "@/lib/farm/trend-chart-geometry";
import { TrendChartLegend } from "./trend-chart-legend";
import { TrendChartPlotBody } from "./trend-chart-plot-body";
import { createTrendChartPlotPointer } from "./trend-chart-plot-pointer";
import { TrendChartXAxis } from "./trend-chart-x-axis";
import type { TrendChartProps } from "./trend-chart-props";
import { useTrendChartDecor } from "./use-trend-chart-decor";
import { useTrendChartModel } from "./use-trend-chart-model";
import { useTrendLookbackGesture } from "./use-trend-lookback-gesture";
import { useTrendScaleEdgeEdit } from "./use-trend-scale-edge-edit";
import { useTrendScopeGesture } from "./use-trend-scope-gesture";

export type {
  TrendAxis,
  TrendSeries,
  TrendSpreadContributor,
  TrendBreachNavTarget,
  TrendSpreadExtremes,
  TrendEnvelopePolyPoint,
  TrendEnvelope,
  TrendHistogram,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendRangeBand,
  ScaleEdgeDragEvent,
  ScaleEdgeNumericCommitEvent,
  TrendEventLane,
  TrendEventMark,
  TrendCommandSettingSeg,
};
export type { TrendChartProps };

export function TrendChart(props: TrendChartProps) {
  const model = useTrendChartModel(props);
  const {
    hoverIdxRef,
    hoverSeriesRef,
    hoverEventMarkRef,
    setHoverIdx,
    setHoverSeries,
    setHoverEventMark,
    setCrosshairVisible,
    scaleEdgeLabels,
    scaleEdgeHitPx,
    chartH,
    innerH,
    lMin,
    lMax,
    rMin,
    rMax,
    yFor,
    onScaleEdgeDrag,
    onScaleEdgeNumericCommit,
    n,
    padL,
    innerW,
    viewW,
    padR,
    eventLaneH,
    xScopeSelect,
    onXScopeCommit,
    onXScopeBack,
    guidedXScopeGesture,
    onGuidedXScopeComplete,
    plotRef,
    onLookbackWheel,
    pinClickArmRef,
    chartRootRef,
    fillParent,
    showLegend,
    legendTrailing,
    legendDensity,
    series,
    usesRight,
    positionedCommandHits,
    envelopes,
    histograms,
    coverageBands,
    eventLane,
    setHoveredEdgeId,
    setPlotHovering,
    hideAxisChrome,
    hasAny,
    height,
    emptyLabel,
  } = model;

  const clearHover = () => {
    hoverIdxRef.current = null;
    hoverSeriesRef.current = null;
    hoverEventMarkRef.current = null;
    setHoverIdx(null);
    setHoverSeries(null);
    setHoverEventMark(null);
    setCrosshairVisible(false);
  };
  const scale = useTrendScaleEdgeEdit({
    scaleEdgeLabels,
    scaleEdgeHitPx,
    chartH,
    innerH,
    leftDomain: [lMin, lMax],
    rightDomain: [rMin, rMax],
    yFor,
    onScaleEdgeDrag,
    onScaleEdgeNumericCommit,
    clearHover,
  });
  const {
    edgeDragId,
    edgeEdit,
    edgeDragRef,
    labelDragArmRef,
  } = scale;
  const indexFromXView = (xView: number): number => {
    if (n <= 1) return 0;
    const u = (xView - padL) / innerW;
    return Math.round(Math.min(1, Math.max(0, u)) * (n - 1));
  };

  const xViewFromClient = (
    clientX: number,
    rect: DOMRect,
  ): number => {
    if (rect.width <= 0) return padL;
    const xPx = clientX - rect.left;
    return Math.min(
      viewW - padR,
      Math.max(padL, (xPx / rect.width) * viewW),
    );
  };

  /** 플롯 본문 + 명령 레인 (PAD_BOTTOM 시간축 제외) — 스코프·십자선 Y 상한 */
  const scopeYMax = PAD_TOP + innerH + eventLaneH;

  const yViewFromClient = (
    clientY: number,
    rect: DOMRect,
  ): number => {
    if (rect.height <= 0) return PAD_TOP;
    const yPx = clientY - rect.top;
    return Math.min(
      scopeYMax,
      Math.max(PAD_TOP, (yPx / rect.height) * chartH),
    );
  };

  /**
   * 플롯 본문 기준 0~1. 명령 레인은 >1 (커밋 시 시간-only 판별).
   * 알람 드래그 등 domain 매핑에는 쓰지 말 것.
   */
  const yCenterRatioFromView = (yView: number): number => {
    if (innerH <= 0) return 0.5;
    return (yView - PAD_TOP) / innerH;
  };

  const xViewFromRatio = (r: number) =>
    padL + Math.min(1, Math.max(0, r)) * innerW;
  const yViewFromRatio = (r: number) =>
    PAD_TOP + Math.min(1, Math.max(0, r)) * innerH;
  const scopeGesture = useTrendScopeGesture({
    xScopeSelect,
    n,
    onXScopeCommit,
    onXScopeBack,
    guidedXScopeGesture,
    onGuidedXScopeComplete,
    indexFromXView,
    yCenterRatioFromView,
    xViewFromRatio,
    yViewFromRatio,
    xViewFromClient,
    yViewFromClient,
    clearHover,
  });
  const {
    xDraft,
    xDraftRef,
    xScopeDraggingRef,
    onXScopePointerCancel,
  } = scopeGesture;
  const lookback = useTrendLookbackGesture({
    plotRef,
    onLookbackWheel,
    edgeEdit,
    edgeDragRef,
    labelDragArmRef,
    xDraftRef,
    xScopeDraggingRef,
    pinClickArmRef,
    onXScopePointerCancel,
  });
  /* 팩토리는 ref를 핸들러 클로저에 담기만 하고, current는 이벤트 안에서만 읽는다. */
  /* eslint-disable react-hooks/refs */
  const {
    onPlotPointerDown,
    onPlotPointerMove,
    onPlotPointerUp,
    onPlotPointerCancel,
    onPlotDoubleClickHandler,
    onPlotContextMenu,
    onMove,
  } = createTrendChartPlotPointer({
    ...model,
    ...scale,
    ...scopeGesture,
    ...lookback,
    clearHover,
    scopeYMax,
    yViewFromClient,
  });
  /* eslint-enable react-hooks/refs */
  const decor = useTrendChartDecor({
    ...model,
    edgeEdit,
    xDraft,
  });
  const { axisMarks, axisTicks, axisTickViews } = decor;

  if (!hasAny || n === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <div
      ref={chartRootRef}
      className={cn(
        "select-none",
        fillParent
          ? "flex h-full min-h-0 flex-col gap-1.5"
          : showLegend || legendTrailing
            ? "space-y-1.5"
            : "space-y-1",
      )}
      data-trend-chart-root=""
    >
      <TrendChartLegend
        showLegend={showLegend}
        legendTrailing={legendTrailing}
        fillParent={fillParent}
        legendDensity={legendDensity}
        series={series}
        usesRight={usesRight}
        positionedCommandHits={positionedCommandHits}
        envelopes={envelopes}
        histograms={histograms}
        coverageBands={coverageBands}
        eventLane={eventLane}
      />

      <div
        className={cn("min-w-0", fillParent && "flex min-h-0 flex-1 flex-col")}
      >
      <div
        className={cn(
          fillParent && "relative min-h-0 flex-1 overflow-visible",
        )}
      >
      <div
        ref={plotRef}
        className={cn(
          "relative touch-none select-none",
          fillParent && "absolute inset-0",
          edgeDragId
            ? "cursor-ns-resize"
            : xScopeSelect
              ? "cursor-crosshair"
              : "cursor-default",
        )}
        onMouseMove={onMove}
        onMouseLeave={() => {
          if (xDraftRef.current != null || edgeDragRef.current != null) return;
          clearHover();
          setHoveredEdgeId(null);
          setPlotHovering(false);
        }}
        onPointerLeave={() => {
          if (xDraftRef.current != null || edgeDragRef.current != null) return;
          setPlotHovering(false);
        }}
        onPointerDown={onPlotPointerDown}
        onPointerMove={onPlotPointerMove}
        onPointerUp={onPlotPointerUp}
        onPointerCancel={onPlotPointerCancel}
        onDoubleClick={onPlotDoubleClickHandler}
        onContextMenu={onPlotContextMenu}
      >
      <TrendChartPlotBody
        {...model}
        {...decor}
        {...scale}
        {...scopeGesture}
        clearHover={clearHover}
        scopeYMax={scopeYMax}
      />
      </div>
      </div>

      <TrendChartXAxis
        hideAxisChrome={hideAxisChrome}
        axisMarksMinors={axisMarks.minors}
        axisTicks={axisTicks}
        axisTickViews={axisTickViews}
        viewW={viewW}
        padL={padL}
        innerW={innerW}
      />
      </div>
    </div>
  );
}
