"use client";

import { useId, useMemo, useRef, useState } from "react";
import { parseCategoryTimelineMs } from "@/lib/farm/trend-display-buckets";
import type { TrendAxis } from "@/lib/domain/trend-chart-types";
import {
  PAD_BOTTOM,
  PAD_TOP,
  SCALE_EDGE_HIT_PX,
  VIEW_W_NORM,
  domainFor,
  finiteValues,
  markerRadiusInViewUnits,
  trendChartHasRenderableContent,
  trendPlotPadPx,
} from "@/lib/farm/trend-chart-geometry";
import {
  buildLeftAxisTicks,
  computeBarLayout,
  plotXForBar,
  plotXForIndex,
  plotXForMs,
  plotYForValue,
  positionCommandSettingHits,
  positionEventMarks,
  type TrendPlotXScale,
} from "@/lib/farm/trend-chart-layout";
import { useClipPresence } from "@/lib/ui/use-clip-presence";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { findTrendDataPointHit } from "./trend-chart-hit";
import type { TrendChartProps } from "./trend-chart-props";
import { useTrendCrosshair } from "./use-trend-crosshair";
import { useTrendHover } from "./use-trend-hover";
import { useTrendPinWindowRemap } from "./use-trend-pin-window-remap";
import { useTrendPinnedTips } from "./use-trend-pinned-tips";
import { useTrendPlotSize } from "./use-trend-plot-size";

/**
 * TrendChart의 플롯 크기·호버·좌표 재료.
 * 포인터 핸들러와 클라이언트 좌표 변환은 플롯 루트(`trend-chart.tsx`)에 남긴다.
 */
export function useTrendChartModel({
  mode,
  categories,
  series,
  height = 132,
  leftUnit = "",
  rightUnit = "",
  leftDomain,
  rightDomain,
  yAxisTicks = "full",
  referenceLines = [],
  scaleEdgeLabels = [],
  yGutterStartCaption,
  yGutterEndCaption,
  rangeBands = [],
  envelopes = [],
  histograms = [],
  emptyLabel = "데이터 없음",
  tickEvery,
  period,
  barWidthCapPct,
  showLegend = true,
  legendTrailing = null,
  legendDensity = "full",
  scaleEdgeHitPx = SCALE_EDGE_HIT_PX,
  labelGutter = false,
  hideAxisChrome = false,
  showMarkers = true,
  markerDensity = "all",
  markerRadiusPx = 3,
  animate = false,
  layoutKey: _layoutKey,
  layerClipWipe,
  splitBandGuides = [],
  showNullGaps = false,
  coverageBands = [],
  xScopeSelect = false,
  onLookbackWheel,
  onXScopeCommit,
  guidedXScopeGesture = null,
  onGuidedXScopeComplete,
  onXScopeBack,
  scopeMotionKey = 0,
  scopeMotionDir = "in",
  onPlotDoubleClick,
  onPlotBackgroundContextMenu,
  onBreachEquipmentNavigate,
  onScaleEdgeDrag,
  onScaleEdgeNumericCommit,
  onScaleEdgeApply,
  onScaleEdgeRevert,
  scaleEdgeApplyBusy = false,
  scaleEdgeApplyDisabled = false,
  overlayHoverMerge = false,
  crosshairValues,
  onPlotWidthChange,
  fillParent = false,
  eventLane = null,
  eventLaneHeight = 0,
  commandSettingSegs = [],
  pinResetKey,
}: TrendChartProps) {
  void _layoutKey;
  void tickEvery;
  const clipWipeEnabled = layerClipWipe ?? animate;
  /** 호버 — 인덱스 변경 시에만 setState (mousemove 전량 리렌더 방지) */
  const {
    hoverIdx,
    setHoverIdx,
    hoverSeries,
    setHoverSeries,
    hoverEventMark,
    setHoverEventMark,
    plotHovering,
    setPlotHovering,
    hoverIdxRef,
    hoverSeriesRef,
    hoverEventMarkRef,
    tipRef,
    lastAnchorRef,
    placeTipNear,
  } = useTrendHover();
  /** 고정 카드 실측 크기(px) — 배치·점선 앵커 정확도용 (id별) */
  const [pinCardSizes, setPinCardSizes] = useState<
    Record<string, { w: number; h: number }>
  >({});
  /** 클릭으로 고정한 비교용 데이터 카드 (다중) — 상태·리셋·외부클릭 해제는 훅에서 */
  const { pinnedTips, setPinnedTips, bringPinToFront, chartRootRef } =
    useTrendPinnedTips({
      resetKey: pinResetKey ?? `${period ?? ""}|${categories.length}`,
    });
  /** 스케일 값 칩 hover → 해당 기준선 강조 + 나머지 dim */
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const pinClickArmRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const { plotRef, plotPx } = useTrendPlotSize({
    fillParent,
    height,
    categoriesLength: categories.length,
    seriesLength: series.length,
    onPlotWidthChange,
  });
  const glowFilterId = `tc-glow-${useId().replace(/:/g, "")}`;
  /** 기간 변경 시만 plot wipe — 카테고리 trim/X스코프는 remount 금지 */
  const plotEnterKey = animate ? String(period ?? "p") : "static";

  const plotEmptyTapRef = useRef<{ t: number; x: number; y: number } | null>(
    null,
  );
  const plotTouchDoubleTapLockRef = useRef(false);
  const pinCardDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origOx: number;
    origOy: number;
  } | null>(null);

  const seriesPresence = useClipPresence(series, (s) => s.name, {
    enabled: clipWipeEnabled,
  });
  const histPresence = useClipPresence(
    histograms,
    (h) =>
      `${h.legendLabel ?? "hist"}:${h.groupIndex ?? 0}:${h.style ?? "macd"}`,
    { enabled: clipWipeEnabled },
  );
  const envelopePresence = useClipPresence(
    envelopes,
    (e) => e.legendLabel ?? "envelope",
    { enabled: clipWipeEnabled },
  );
  const pinPresence = useClipPresence(pinnedTips, (p) => p.id, {
    enterMs: motionDuration.fast,
    exitMs: motionDuration.exit,
  });
  const guidePresence = useClipPresence(
    splitBandGuides
      .map((gy, i) => ({ gy, i }))
      .filter((g) => Number.isFinite(g.gy)),
    (g) => String(g.i),
    { enabled: clipWipeEnabled },
  );

  const hasAny = trendChartHasRenderableContent({
    series,
    histograms,
    categoriesLength: categories.length,
    eventLaneActive: Boolean(eventLane) && eventLaneHeight > 0,
  });
  const n = categories.length;
  const categoryAxisKey = n > 0 ? categories.join("\0") : "";
  const timeAxisMs = useMemo(
    () => (mode === "bar" ? null : parseCategoryTimelineMs(categories)),
    // 배열 identity가 아니라 라벨 내용. 매 렌더 new Date() 재파싱 방지.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categoryAxisKey
    [categoryAxisKey, mode],
  );

  const axisH = hideAxisChrome ? 0 : 16;
  const yLabelColumn = fillParent && !labelGutter;
  const chartH = fillParent
    ? Math.max(48, plotPx.h > 8 ? plotPx.h : 48)
    : height - axisH;
  /** 원단위 Y축(C2) 또는 모바일 거터 */
  const showNativeLeftAxis = Boolean(leftUnit);
  const viewW = plotPx.w > 32 ? plotPx.w : VIEW_W_NORM;
  const { padL, padR, innerW } = trendPlotPadPx(viewW, {
    leftUnit: showNativeLeftAxis,
    labelGutter,
  });
  const eventLaneH =
    eventLane && eventLaneHeight > 0 ? eventLaneHeight : 0;
  const innerH = chartH - PAD_TOP - PAD_BOTTOM - eventLaneH;
  const eventLaneTop = PAD_TOP + innerH;

  /** preserveAspectRatio=none 에서 원이 옆으로 퍼지지 않도록 viewBox rx/ry 보정 */
  const markerRx = (rPx: number) =>
    markerRadiusInViewUnits(rPx, viewW, plotPx.w, 32);
  const markerRy = (rPx: number) =>
    markerRadiusInViewUnits(rPx, chartH, plotPx.h, 8);

  const usesRight = series.some((s) => s.axis === "right") || referenceLines.some((r) => r.axis === "right");

  const [lMin, lMax] = domainFor(finiteValues(series, "left"), leftDomain);
  const [rMin, rMax] = domainFor(finiteValues(series, "right"), rightDomain);

  const yFor = (value: number, axis: TrendAxis): number =>
    plotYForValue(
      value,
      axis === "right" ? [rMin, rMax] : [lMin, lMax],
      innerH,
    );

  const leftAxisTicks = buildLeftAxisTicks({
    show: !hideAxisChrome && showNativeLeftAxis,
    domain: [lMin, lMax],
    mode: yAxisTicks,
    chartH,
    innerH,
    unit: leftUnit,
  });

  const xScale: TrendPlotXScale = { n, timeAxisMs, padL, innerW };
  const xFor = (i: number): number => plotXForIndex(i, xScale);
  const xForMs = (ms: number): number | null => plotXForMs(ms, xScale);

  const positionedEventMarks = positionEventMarks(
    eventLane,
    { eventLaneH, eventLaneTop },
    xForMs,
  );

  const positionedCommandHits = positionCommandSettingHits(
    commandSettingSegs,
    { xMin: padL, xMax: viewW - padR },
    xForMs,
    (value) => yFor(value, "left"),
  );

  const barLayout = computeBarLayout({
    mode,
    n,
    innerW,
    seriesCount: series.length,
    barWidthCapPct,
  });
  const { barW, barSlotW } = barLayout;

  const xForBar = (i: number): number =>
    plotXForBar(i, barLayout, xScale, xFor);

  const xAtIndex = (i: number): number =>
    mode === "bar" ? xForBar(i) : xFor(i);

  useTrendPinWindowRemap({
    mode,
    n,
    timeAxisMs,
    series,
    histograms,
    eventLane,
    eventLaneH,
    eventLaneTop,
    chartH,
    viewW,
    xForMs,
    xAtIndex,
    yFor,
    setPinnedTips,
  });

  const {
    crossVRef,
    crossHRef,
    crossChipRef,
    crossChipTimeRef,
    crossChipTempRef,
    crossChipHumRef,
    crossChipMotorRef,
    crossChipOtherRef,
    setCrosshairChipVisible,
    fillCrosshairChip,
    setCrosshairVisible,
    setCrosshairAt,
  } = useTrendCrosshair({
    plotRef,
    plotW: plotPx.w,
    viewW,
    chartH,
    padL,
    innerW,
    innerH,
    n,
    timeAxisMs,
    categories,
    period,
    leftDomain: [lMin, lMax],
    leftUnit,
    crosshairValues,
    hoverActive: hoverIdx != null || Boolean(hoverEventMark),
  });

  const findDataPointHit = (
    xPx: number,
    yPx: number,
    plotW: number,
    plotH: number,
  ) =>
    findTrendDataPointHit({
      xPx,
      yPx,
      plotW,
      plotH,
      markerRadiusPx,
      eventLane: Boolean(eventLane),
      eventLaneH,
      eventLaneTop,
      chartH,
      innerW,
      innerH,
      n,
      viewW,
      mode,
      series,
      histograms,
      barW,
      barSlotW,
      padTop: PAD_TOP,
      yFor,
      xFor,
      xForBar,
      xAtIndex,
      markerRy,
      positionedEventMarks,
    });

  return {
    mode,
    categories,
    series,
    height,
    leftUnit,
    rightUnit,
    leftDomain,
    rightDomain,
    yAxisTicks,
    referenceLines,
    scaleEdgeLabels,
    yGutterStartCaption,
    yGutterEndCaption,
    rangeBands,
    envelopes,
    histograms,
    emptyLabel,
    period,
    barWidthCapPct,
    showLegend,
    legendTrailing,
    legendDensity,
    scaleEdgeHitPx,
    labelGutter,
    hideAxisChrome,
    showMarkers,
    markerDensity,
    markerRadiusPx,
    animate,
    splitBandGuides,
    showNullGaps,
    coverageBands,
    xScopeSelect,
    onLookbackWheel,
    onXScopeCommit,
    guidedXScopeGesture,
    onGuidedXScopeComplete,
    onXScopeBack,
    scopeMotionKey,
    scopeMotionDir,
    onPlotDoubleClick,
    onPlotBackgroundContextMenu,
    onBreachEquipmentNavigate,
    onScaleEdgeDrag,
    onScaleEdgeNumericCommit,
    onScaleEdgeApply,
    onScaleEdgeRevert,
    scaleEdgeApplyBusy,
    scaleEdgeApplyDisabled,
    overlayHoverMerge,
    crosshairValues,
    fillParent,
    eventLane,
    eventLaneHeight,
    commandSettingSegs,
    pinResetKey,
    clipWipeEnabled,
    hoverIdx,
    setHoverIdx,
    hoverSeries,
    setHoverSeries,
    hoverEventMark,
    setHoverEventMark,
    plotHovering,
    setPlotHovering,
    hoverIdxRef,
    hoverSeriesRef,
    hoverEventMarkRef,
    tipRef,
    lastAnchorRef,
    placeTipNear,
    pinCardSizes,
    setPinCardSizes,
    pinnedTips,
    setPinnedTips,
    bringPinToFront,
    chartRootRef,
    hoveredEdgeId,
    setHoveredEdgeId,
    pinClickArmRef,
    plotRef,
    plotPx,
    glowFilterId,
    plotEnterKey,
    plotEmptyTapRef,
    plotTouchDoubleTapLockRef,
    pinCardDragRef,
    seriesPresence,
    histPresence,
    envelopePresence,
    pinPresence,
    guidePresence,
    hasAny,
    n,
    timeAxisMs,
    axisH,
    yLabelColumn,
    chartH,
    showNativeLeftAxis,
    viewW,
    padL,
    padR,
    innerW,
    eventLaneH,
    innerH,
    eventLaneTop,
    markerRx,
    markerRy,
    usesRight,
    lMin,
    lMax,
    rMin,
    rMax,
    yFor,
    leftAxisTicks,
    xFor,
    xForMs,
    positionedEventMarks,
    positionedCommandHits,
    barW,
    barSlotW,
    xForBar,
    xAtIndex,
    crossVRef,
    crossHRef,
    crossChipRef,
    crossChipTimeRef,
    crossChipTempRef,
    crossChipHumRef,
    crossChipMotorRef,
    crossChipOtherRef,
    setCrosshairChipVisible,
    fillCrosshairChip,
    setCrosshairVisible,
    setCrosshairAt,
    findDataPointHit,
  };
}
