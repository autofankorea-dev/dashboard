"use client";

import {
  Fragment,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useId,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, RotateCcw } from "lucide-react";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import { cn } from "@/lib/utils";
import {
  buildTrendAxisMarks,
  parseCategoryTimelineMs,
  trendChartTickTargetForWidth,
} from "@/lib/farm/trend-display-buckets";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { useClipPresence, usePresenceValue } from "@/lib/ui/use-clip-presence";
import { motionDuration } from "@/lib/ui/motion-tokens";

import type {
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
} from "@/lib/domain/trend-chart-types";
import {
  inferHoverMetricGroup,
  isOverlayMergedHoverGroup,
  resolveBreachNavTarget,
  TREND_Y_LABEL_CHIP_SAMPLE,
} from "@/lib/farm/trend-chart-format";
import {
  OverlayMergedPointCards,
  TrendPointCardBody,
  TrendEventCardBody,
} from "./trend-hover-card";
import {
  PAD_TOP,
  PAD_BOTTOM,
  VIEW_W_NORM,
  SCALE_EDGE_HIT_PX,
  SCALE_EDGE_LABEL_DRAG_PX,
  buildEnvelopePaths,
  buildLineSegments,
  computeTipPlacement,
  domainFor,
  finiteValues,
  markerRadiusInViewUnits,
  parseScaleEdgeValueUnit,
  tipPinId,
  trendChartHasRenderableContent,
  trendPlotPadPx,
} from "@/lib/farm/trend-chart-geometry";
import {
  buildAxisTickViews,
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
import {
  MAX_PINNED_TIPS,
  PIN_CLICK_SLOP_PX,
  SCALE_EDGE_DOUBLE_TAP_MS,
  SCALE_EDGE_DOUBLE_TAP_SLOP_PX,
  handleScaleEdgeDoubleTap,
  hoverPairSlotDx,
  nearestByXView,
  chartTipPresenceClass,
  chartBandGuideClass,
  type PinnedTip,
} from "./trend-chart-interaction";
import { useTrendPinnedTips } from "./use-trend-pinned-tips";
import { useTrendPlotSize } from "./use-trend-plot-size";
import { useTrendLookbackGesture } from "./use-trend-lookback-gesture";
import { useTrendPinWindowRemap } from "./use-trend-pin-window-remap";
import { useTrendCrosshair } from "./use-trend-crosshair";
import { useTrendScaleEdgeEdit } from "./use-trend-scale-edge-edit";
import { useTrendEdgeBandLabels } from "./use-trend-edge-band-labels";
import { useTrendScopeGesture } from "./use-trend-scope-gesture";
import {
  BandGuidesLayer,
  CoverageBandsLayer,
  NullGapsLayer,
  type TrendPlotGeom,
} from "./trend-chart-svg-layers";
import { TrendChartDataLayers } from "./trend-chart-data-layers";
import {
  CommandHoldLaneSvg,
  CommandSettingHitOverlay,
  EventLaneHtmlOverlay,
  EventLaneSvgGuides,
} from "./trend-chart-event-lane";
import { TrendChartLegend } from "./trend-chart-legend";
import { TrendChartCrosshairChip } from "./trend-chart-crosshair-chip";
import { TrendYLabelChip } from "./trend-y-label-chip";
import type { TrendChartProps } from "./trend-chart-props";

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



export function TrendChart({
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
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);
  const [hoverEventMark, setHoverEventMark] = useState<TrendEventMark | null>(
    null,
  );
  const [plotHovering, setPlotHovering] = useState(false);
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
  const hoverIdxRef = useRef<number | null>(null);
  const hoverSeriesRef = useRef<string | null>(null);
  const hoverEventMarkRef = useRef<TrendEventMark | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = useRef({ x: 0, y: 0, w: 1, h: 1 });
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

  /** 데이터 점 근처 · 플롯 안 · 포인터/점을 가리지 않게 카드 배치 */
  const placeTipNear = (
    anchorX: number,
    anchorY: number,
    plotW: number,
    plotH: number,
  ) => {
    const el = tipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth || 168;
    const tipH = el.offsetHeight || 72;
    const { left, top } = computeTipPlacement(
      anchorX,
      anchorY,
      plotW,
      plotH,
      tipW,
      tipH,
    );
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.opacity = "1";
  };

  /**
   * 표시 데이터 지점(시리즈 샘플 · 막대 · 히스토그램 끝)에만 히트.
   * 빈 플롯 영역 X스냅은 하지 않음.
   */
  const findDataPointHit = (
    xPx: number,
    yPx: number,
    plotW: number,
    plotH: number,
  ): {
    idx: number;
    xView: number;
    yView: number;
    seriesKey: string;
    eventMark?: TrendEventMark;
  } | null => {
    if (plotW <= 0 || plotH <= 0) return null;
    const hitR = Math.max(14, markerRadiusPx * 4.2);
    const hitR2 = hitR * hitR;
    const laneTopPx =
      eventLane && eventLaneH > 0 && plotH > 0
        ? (eventLaneTop / chartH) * plotH
        : Infinity;
    const inCommandLane = yPx >= laneTopPx - 8;
    const pairMaxDx = Math.max(hoverPairSlotDx(innerW, n), 6);

    if (n === 0) return null;
    let bestD2 = hitR2;
    let best: {
      idx: number;
      xView: number;
      yView: number;
      seriesKey: string;
    } | null = null;

    const consider = (
      i: number,
      xView: number,
      yView: number,
      seriesKey: string,
    ) => {
      const sx = (xView / viewW) * plotW;
      const sy = (yView / chartH) * plotH;
      const dx = xPx - sx;
      const dy = yPx - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { idx: i, xView, yView, seriesKey };
      }
    };

    if (mode === "bar") {
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!;
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          const yTop = yFor(v, axis);
          const baseY = PAD_TOP + innerH;
          const gx = xForBar(i) - barSlotW / 2 + si * barW;
          const barWv = Math.max(0.4, barW * 0.92);
          const left = (gx / viewW) * plotW;
          const right = ((gx + barWv) / viewW) * plotW;
          const top = (yTop / chartH) * plotH;
          const bottom = (baseY / chartH) * plotH;
          if (xPx >= left && xPx <= right && yPx >= top && yPx <= bottom) {
            consider(i, gx + barWv / 2, yTop, s.name);
            continue;
          }
          consider(i, gx + barWv / 2, yTop, s.name);
        }
      }
    } else {
      for (const s of series) {
        const axis = s.axis ?? "left";
        for (let i = 0; i < n; i++) {
          const v = s.data[i];
          if (v == null || !Number.isFinite(v)) continue;
          consider(i, xFor(i), yFor(v, axis), s.name);
        }
      }
    }

    for (let hi = 0; hi < histograms.length; hi++) {
      const h = histograms[hi]!;
      const key = h.legendLabel ?? `hist-${hi}`;
      const slot =
        n > 1 ? (innerW) / (n - 1) : innerW;
      const isVolume = h.style === "volume";
      const isOverlay = h.style === "overlay";
      const gs = Math.max(1, h.groupSize ?? 1);
      const gi = h.groupIndex ?? 0;
      const barWHist = Math.max(
        0.22,
        slot *
          (isVolume && gs > 1
            ? 0.62 / gs
            : isVolume
              ? 0.5
              : isOverlay
                ? 0.28
                : 0.55),
      );
      const cluster =
        isVolume && gs > 1
          ? (gi - (gs - 1) / 2) * (barWHist + 0.12)
          : 0;
      const yBase = yFor(h.baseline, "left");

      for (let i = 0; i < n; i++) {
        const v = h.values[i];
        if (v == null || !Number.isFinite(v)) continue;
        const yVal = yFor(v, "left");
        const tipY = yVal;
        const gx = xAtIndex(i) + cluster - barWHist / 2;
        const top = Math.min(yBase, yVal);
        const bottom = Math.max(yBase, yVal);
        const left = (gx / viewW) * plotW;
        const right = ((gx + barWHist) / viewW) * plotW;
        const topPx = (top / chartH) * plotH;
        const bottomPx = (bottom / chartH) * plotH;
        /** 모터/편차 막대 — 바 전체 영역 히트 (끝점만 아님) */
        if (
          xPx >= left - 2 &&
          xPx <= right + 2 &&
          yPx >= Math.min(topPx, bottomPx) - 2 &&
          yPx <= Math.max(topPx, bottomPx) + 2
        ) {
          bestD2 = 0;
          best = { idx: i, xView: gx + barWHist / 2, yView: tipY, seriesKey: key };
          continue;
        }
        /** 바 근처 완화 히트 (모터 밴드에서 잡기 쉽게) */
        const padHit = isVolume ? hitR * 1.35 : hitR;
        const sx = ((gx + barWHist / 2) / viewW) * plotW;
        const sy = (tipY / chartH) * plotH;
        const dx = xPx - sx;
        const dy = yPx - sy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= padHit * padHit && d2 <= bestD2) {
          bestD2 = d2;
          best = {
            idx: i,
            xView: gx + barWHist / 2,
            yView: tipY,
            seriesKey: key,
          };
        }
      }
    }

    /** 마커 전용 시리즈 — 본선·막대보다 우선 */
    const markerHitR = hitR * 2.2;
    const markerLabelHalfW = Math.max(22, hitR * 1.4);
    let markerHitD2 = markerHitR * markerHitR;
    let markerHit: {
      idx: number;
      xView: number;
      yView: number;
      seriesKey: string;
    } | null = null;
    for (const s of series) {
      if (!s.markerOnly) continue;
      const axis = s.axis ?? "left";
      const rPx = Math.max(markerRadiusPx, 2.1);
      const labelYOff = markerRy(rPx) * 2.35;
      for (let i = 0; i < n; i++) {
        const v = s.data[i];
        if (v == null || !Number.isFinite(v)) continue;
        const xView = xFor(i);
        const yView = yFor(v, axis);
        const sx = (xView / viewW) * plotW;
        const sy = (yView / chartH) * plotH;
        const dx = xPx - sx;
        const dy = yPx - sy;
        const d2 = dx * dx + dy * dy;
        const labelSy = ((yView - labelYOff) / chartH) * plotH;
        const onLabel =
          Math.abs(dx) <= markerLabelHalfW &&
          yPx <= sy + 4 &&
          yPx >= labelSy - markerHitR * 0.45;
        if (onLabel || d2 <= markerHitD2) {
          markerHitD2 = onLabel ? Math.min(markerHitD2, d2) : d2;
          markerHit = { idx: i, xView, yView, seriesKey: s.name };
        }
      }
    }
    if (markerHit) {
      return markerHit;
    }

    const nearestMotorByX = (xView: number) => {
      let picked: {
        idx: number;
        xView: number;
        yView: number;
        seriesKey: string;
      } | null = null;
      let bestDx = pairMaxDx;
      for (let hi = 0; hi < histograms.length; hi++) {
        const h = histograms[hi]!;
        const key = h.legendLabel ?? `hist-${hi}`;
        if (inferHoverMetricGroup(key) !== "motor") continue;
        for (let i = 0; i < n; i++) {
          const v = h.values[i];
          if (v == null || !Number.isFinite(v)) continue;
          const cx = xAtIndex(i);
          const dx = Math.abs(cx - xView);
          if (dx <= bestDx) {
            bestDx = dx;
            picked = {
              idx: i,
              xView: cx,
              yView: yFor(v, "left"),
              seriesKey: key,
            };
          }
        }
      }
      return picked;
    };

    if (
      inCommandLane &&
      (!best || inferHoverMetricGroup(best.seriesKey) !== "motor")
    ) {
      const xView = (xPx / plotW) * viewW;
      const motorAtX = nearestMotorByX(xView);
      if (motorAtX) best = motorAtX;
    }

    const motorHit =
      best != null && inferHoverMetricGroup(best.seriesKey) === "motor";
    const eventMark =
      motorHit && best
        ? nearestByXView(positionedEventMarks, best.xView, pairMaxDx)?.mark
        : undefined;

    if (!best) return null;

    return { ...best, eventMark };
  };

  const clearHover = () => {
    hoverIdxRef.current = null;
    hoverSeriesRef.current = null;
    hoverEventMarkRef.current = null;
    setHoverIdx(null);
    setHoverSeries(null);
    setHoverEventMark(null);
    setCrosshairVisible(false);
  };

  const {
    edgeDragId,
    setEdgeDragId,
    edgeEdit,
    setEdgeEdit,
    edgeDragRef,
    labelDragArmRef,
    scaleEdgeTapRef,
    domainValueFromYView,
    hitDraggableScaleEdge,
    emitScaleEdgeDrag,
    beginScaleEdgeEdit,
    cancelScaleEdgeEdit,
    commitScaleEdgeEdit,
    endScaleEdgeDrag,
  } = useTrendScaleEdgeEdit({
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

  const {
    xDraft,
    xDraftRef,
    xScopeDraggingRef,
    beginXScopeAt,
    moveXScopeAt,
    endXScopeAt,
    onXScopePointerDown,
    onXScopePointerMove,
    onXScopePointerUp,
    onXScopePointerCancel,
    onXScopeContextMenu,
  } = useTrendScopeGesture({
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
  const { lookbackPinchActiveRef } = useTrendLookbackGesture({
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

  const onPlotPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPrimaryPress(e)) return;
    if (edgeEdit) return;
    /** 핀치 세션 중(또는 touchstart가 pointerdown보다 먼저인 경우) X스코프·핀 암 생략 */
    if (lookbackPinchActiveRef.current) return;
    pinClickArmRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
    };
    /** 플롯 본문·명령 레인 모두 시간 줌 가능 — 알람선 전체폭 hit로 X스코프를 가로채지 않음.
     *  알람 세로 조절은 좌·우측 숫자 라벨 더블클릭·우클릭 숫자 입력
     *  (현재 장비 경보값을 표시).
     *  명령 레인 유지띠 탭/드래그는 EventLaneHtmlOverlay가 처리. */
    if (xScopeSelect) onXScopePointerDown(e);
  };

  const onPlotPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pinDrag = pinCardDragRef.current;
    if (pinDrag && pinDrag.pointerId === e.pointerId) {
      const dx = e.clientX - pinDrag.startX;
      const dy = e.clientY - pinDrag.startY;
      setPinnedTips((prev) =>
        prev.map((p) =>
          p.id === pinDrag.id
            ? { ...p, ox: pinDrag.origOx + dx, oy: pinDrag.origOy + dy }
            : p,
        ),
      );
      return;
    }

    const arm = labelDragArmRef.current;
    if (arm && !edgeDragRef.current) {
      const dx = Math.abs(e.clientX - arm.x);
      const dy = Math.abs(e.clientY - arm.y);
                    if (dx >= SCALE_EDGE_LABEL_DRAG_PX || dy >= SCALE_EDGE_LABEL_DRAG_PX) {
        if (!onScaleEdgeDrag) {
          labelDragArmRef.current = null;
          return;
        }
        scaleEdgeTapRef.current = null;
        labelDragArmRef.current = null;
        pinClickArmRef.current = null;
        edgeDragRef.current = { id: arm.id, axis: arm.axis };
        setEdgeDragId(arm.id);
        clearHover();
        emitScaleEdgeDrag(arm.id, arm.value, "start");
        const rect = e.currentTarget.getBoundingClientRect();
        const yView = yViewFromClient(e.clientY, rect);
        const value = domainValueFromYView(yView, arm.axis);
        emitScaleEdgeDrag(arm.id, value, "move");
      }
      return;
    }
    const cur = edgeDragRef.current;
    if (cur) {
      const rect = e.currentTarget.getBoundingClientRect();
      const yView = yViewFromClient(e.clientY, rect);
      const value = domainValueFromYView(yView, cur.axis);
      emitScaleEdgeDrag(cur.id, value, "move");
      return;
    }
    if (xScopeSelect) onXScopePointerMove(e);
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      setPlotHovering(true);
    }
  };

  const onPlotPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      pinCardDragRef.current &&
      pinCardDragRef.current.pointerId === e.pointerId
    ) {
      pinCardDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const pinArm = pinClickArmRef.current;
    pinClickArmRef.current = null;

    const labelArm = labelDragArmRef.current;

    if (labelArm && labelArm.pointerId === e.pointerId && !edgeDragRef.current) {
      labelDragArmRef.current = null;
      if (onScaleEdgeNumericCommit) {
        handleScaleEdgeDoubleTap(
          e,
          labelArm,
          scaleEdgeTapRef,
          beginScaleEdgeEdit,
        );
      }
      return;
    }

    if (labelDragArmRef.current) {
      labelDragArmRef.current = null;
      return;
    }
    if (edgeDragRef.current) {
      endScaleEdgeDrag("end");
      return;
    }

    const wasScopeDrag = xScopeDraggingRef.current;
    if (xScopeSelect) onXScopePointerUp(e);

    if (wasScopeDrag) return;
    if (!pinArm || pinArm.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - pinArm.x, e.clientY - pinArm.y);
    if (dist > PIN_CLICK_SLOP_PX) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const hit = findDataPointHit(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );
    if (!hit) {
      const isTouchLike =
        e.pointerType === "touch" || e.pointerType === "pen";
      if (isTouchLike && onPlotDoubleClick) {
        const now = e.timeStamp;
        const prev = plotEmptyTapRef.current;
        if (
          prev &&
          now - prev.t <= SCALE_EDGE_DOUBLE_TAP_MS &&
          Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <=
            SCALE_EDGE_DOUBLE_TAP_SLOP_PX
        ) {
          plotEmptyTapRef.current = null;
          plotTouchDoubleTapLockRef.current = true;
          window.setTimeout(() => {
            plotTouchDoubleTapLockRef.current = false;
          }, 400);
          onPlotDoubleClick();
          return;
        }
        plotEmptyTapRef.current = { t: now, x: e.clientX, y: e.clientY };
      }
      return;
    }
    plotEmptyTapRef.current = null;

    /**
     * 오버레이(온도·습도·모터 겹침): 어느 쪽을 클릭해도 한 핀으로 정규화
     * → 병합 카드 1개만 고정(중복 방지·토글 일관).
     */
    const hitGroup = hit.seriesKey
      ? inferHoverMetricGroup(hit.seriesKey)
      : null;
    const yPx = e.clientY - rect.top;
    const laneTopPx =
      eventLane && eventLaneH > 0
        ? (eventLaneTop / chartH) * rect.height
        : Infinity;
    const pinAsEvent =
      Boolean(hit.eventMark) && yPx >= laneTopPx - 4;
    const mergePin =
      overlayHoverMerge &&
      !pinAsEvent &&
      isOverlayMergedHoverGroup(hitGroup);
    const pinSeriesKey = mergePin ? "온도" : hit.seriesKey;
    const id = pinAsEvent
      ? `event:${hit.eventMark!.id}`
      : tipPinId(hit.idx, pinSeriesKey);
    setPinnedTips((prev) => {
      if (prev.some((p) => p.id === id)) {
        return prev.filter((p) => p.id !== id);
      }
      const next: PinnedTip = {
        id,
        idx: hit.idx,
        seriesKey: pinSeriesKey,
        nx: hit.xView / viewW,
        ny: hit.yView / chartH,
        ox: 0,
        oy: 0,
        eventMark: pinAsEvent ? hit.eventMark : undefined,
        atMs: pinAsEvent
          ? hit.eventMark!.atMs
          : (timeAxisMs?.[hit.idx] ?? undefined),
      };
      return [...prev, next].slice(-MAX_PINNED_TIPS);
    });
  };

  const onPlotPointerCancel = () => {
    pinCardDragRef.current = null;
    pinClickArmRef.current = null;
    scaleEdgeTapRef.current = null;
    plotEmptyTapRef.current = null;
    labelDragArmRef.current = null;
    if (edgeDragRef.current) {
      endScaleEdgeDrag("cancel");
      return;
    }
    onXScopePointerCancel();
    setPlotHovering(false);
  };

  const onPlotDoubleClickHandler = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (plotTouchDoubleTapLockRef.current) return;
    if (edgeEdit || edgeDragRef.current || labelDragArmRef.current) return;
    if (xScopeDraggingRef.current) return;
    if (onScaleEdgeNumericCommit) {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = hitDraggableScaleEdge(e.clientY, rect);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        beginScaleEdgeEdit(hit.id);
        return;
      }
    }
    if (!onPlotDoubleClick) return;
    e.preventDefault();
    onPlotDoubleClick();
  };

  const onPlotContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onScaleEdgeNumericCommit) {
      const rect = e.currentTarget.getBoundingClientRect();
      const hit = hitDraggableScaleEdge(e.clientY, rect);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        beginScaleEdgeEdit(hit.id);
        return;
      }
    }
    // 빈 공간 우클릭: 고정 카드가 있으면 일괄 닫기(줌인 뒤로가기·스코프 뒤로가기보다 우선)
    if (pinnedTips.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      setPinnedTips([]);
      return;
    }
    /**
     * 한계 이탈 데이터 카드가 떠 있을 때만 장비 바로가기.
     * 카드가 없으면 스코프 뒤로가기·설정모드 종료로 통과.
     */
    if (onBreachEquipmentNavigate) {
      const idx = hoverIdxRef.current;
      if (idx != null) {
        const target = resolveBreachNavTarget({
          series,
          envelopes,
          hoverIdx: idx,
          hoverSeriesName: hoverSeriesRef.current,
        });
        if (target) {
          e.preventDefault();
          e.stopPropagation();
          onBreachEquipmentNavigate(target);
          return;
        }
      }
    }
    // 설정모드 종료 등 — 스코프 뒤로가기와 분리 (동시 등록하지 않음)
    if (onPlotBackgroundContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onPlotBackgroundContextMenu();
      return;
    }
    if (xScopeSelect && onXScopeBack) onXScopeContextMenu(e);
  };

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      edgeEdit != null ||
      edgeDragRef.current != null ||
      labelDragArmRef.current != null ||
      xScopeDraggingRef.current ||
      xDraftRef.current != null
    )
      return;
    setPlotHovering(true);
    if (n === 0 && positionedEventMarks.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    /** 십자선 — 플롯·명령 레인까지 (시간축 PAD_BOTTOM 제외) */
    const xView = Math.min(
      viewW - padR,
      Math.max(padL, (xPx / rect.width) * viewW),
    );
    const yView = Math.min(
      scopeYMax,
      Math.max(PAD_TOP, (yPx / rect.height) * chartH),
    );
    setCrosshairAt(xView, yView);

    const overEventMark =
      e.target instanceof Element &&
      Boolean(e.target.closest("[data-trend-event-mark]"));
    if (overEventMark) {
      setCrosshairChipVisible(false);
      return;
    }

    const hit = findDataPointHit(xPx, yPx, rect.width, rect.height);
    if (!hit) {
      fillCrosshairChip(xView, yView);
      setCrosshairChipVisible(true);
      if (
        hoverIdxRef.current != null ||
        hoverSeriesRef.current != null ||
        hoverEventMarkRef.current
      ) {
        hoverIdxRef.current = null;
        hoverSeriesRef.current = null;
        hoverEventMarkRef.current = null;
        setHoverIdx(null);
        setHoverSeries(null);
        setHoverEventMark(null);
      }
      return;
    }
    setCrosshairChipVisible(false);
    const anchorX = (hit.xView / viewW) * rect.width;
    const anchorY = (hit.yView / chartH) * rect.height;
    lastAnchorRef.current = {
      x: anchorX,
      y: anchorY,
      w: rect.width,
      h: rect.height,
    };
    if (hit.seriesKey && !hit.seriesKey.startsWith("event:")) {
      placeTipNear(anchorX, anchorY, rect.width, rect.height);
    }
    const same =
      hit.idx === hoverIdxRef.current &&
      hit.seriesKey === hoverSeriesRef.current &&
      (hit.eventMark?.id ?? null) === (hoverEventMarkRef.current?.id ?? null);
    if (same) return;
    hoverIdxRef.current = hit.idx;
    hoverSeriesRef.current = hit.seriesKey;
    hoverEventMarkRef.current = hit.eventMark ?? null;
    setHoverIdx(hit.idx);
    setHoverSeries(hit.seriesKey);
    setHoverEventMark(hit.eventMark ?? null);
  };

  useLayoutEffect(() => {
    if (hoverIdx == null && !hoverEventMark) return;
    const a = lastAnchorRef.current;
    placeTipNear(a.x, a.y, a.w, a.h);
  }, [hoverIdx, hoverEventMark]);

  const markerStride =
    markerDensity === "sparse" ? Math.max(1, Math.ceil(n / 8)) : 1;
  const shouldShowMarker = (i: number) => {
    if (markerDensity === "all") return true;
    if (i === 0 || i === n - 1) return true;
    return i % markerStride === 0;
  };

  const stackedAxis = labelGutter || (plotPx.w > 0 && plotPx.w < 480);
  const tickTarget = trendChartTickTargetForWidth(
    plotPx.w > 32 ? plotPx.w : labelGutter ? 360 : 800,
    { stacked: stackedAxis },
  );
  const axisMarks = useMemo(
    () => buildTrendAxisMarks(categories, tickTarget),
    [categories, tickTarget],
  );
  const axisTicks = axisMarks.majors;

  const axisTickViews = useMemo(
    () => buildAxisTickViews(axisTicks, { period, padL, innerW, viewW }),
    [axisTicks, innerW, padL, period, viewW],
  );

  const { alarmPresence, dedupedReferenceLines, edgeBandLabels } =
    useTrendEdgeBandLabels({
      mode,
      series,
      rangeBands,
      referenceLines,
      scaleEdgeLabels,
      usesRight,
      leftUnit,
      rightUnit,
      chartH,
      innerH,
      leftDomain: [lMin, lMax],
      rightDomain: [rMin, rMax],
      editingEdgeId: edgeEdit?.id,
      overlayHoverMerge,
      clipWipeEnabled,
    });

  /** hover 중인 스케일 칩(강조 대상). 없으면 dim 미적용 */
  const hoveredEdge =
    hoveredEdgeId != null
      ? (edgeBandLabels.find((l) => l.id === hoveredEdgeId) ?? null)
      : null;
  const hoveredEdgePresence = usePresenceValue(hoveredEdge);
  const draftPresence = usePresenceValue(xDraft);

  const hoverEventVisible =
    hoverEventMark != null &&
    !pinnedTips.some((p) => p.eventMark?.id === hoverEventMark.id);
  const hoverPointVisible =
    hoverIdx != null &&
    hoverIdx >= 0 &&
    hoverIdx < n &&
    hoverSeries != null &&
    !hoverSeries.startsWith("event:") &&
    !pinnedTips.some(
      (p) =>
        p.id ===
        tipPinId(
          hoverIdx,
          overlayHoverMerge &&
            isOverlayMergedHoverGroup(inferHoverMetricGroup(hoverSeries))
            ? "온도"
            : hoverSeries,
        ),
    );
  const hoverCardLive = useMemo(() => {
    if (hoverEventVisible && hoverEventMark) {
      return { kind: "event" as const, mark: hoverEventMark };
    }
    if (hoverPointVisible && hoverIdx != null && hoverSeries) {
      return { kind: "point" as const, idx: hoverIdx, seriesKey: hoverSeries };
    }
    return null;
  }, [
    hoverEventVisible,
    hoverEventMark,
    hoverPointVisible,
    hoverIdx,
    hoverSeries,
  ]);
  const hoverCardPresence = usePresenceValue(hoverCardLive);

  /** 플롯 위를 보는 중이면 기준 칩을 낮춤. 칩 호버는 제외 */
  const dimPlotValues =
    hoveredEdgeId == null &&
    (plotHovering || pinPresence.length > 0);

  const edgeValueMaxCh = edgeBandLabels.reduce(
    (max, label) => Math.max(max, label.text.length),
    TREND_Y_LABEL_CHIP_SAMPLE.length,
  );

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

  /** Build polyline segments, breaking on null (gap shading). */
  const lineSegments = (s: TrendSeries): string[] =>
    buildLineSegments(s, xFor, yFor);

  /** 결측 구간 — 커버리지 밴드가 있으면 희소/통신두절/없음으로 대체. */
  const nullGapRanges: { i0: number; i1: number }[] = [];
  if (
    coverageBands.length === 0 &&
    showNullGaps &&
    mode === "line" &&
    series.length > 0
  ) {
    const ref =
      series.find((s) => s.name === "온도" || s.name.startsWith("온도")) ??
      series[0]!;
    let start: number | null = null;
    const isGapAt = (i: number) => {
      const v = ref.data[i];
      return v == null || !Number.isFinite(v);
    };
    const flush = (end: number) => {
      if (start == null) return;
      if (end - start + 1 >= 2) nullGapRanges.push({ i0: start, i1: end });
      start = null;
    };
    for (let i = 0; i < n; i++) {
      if (isGapAt(i)) {
        if (start == null) start = i;
      } else {
        flush(i - 1);
      }
    }
    flush(n - 1);
  }

  const envelopePaths = (env: TrendEnvelope): string[] =>
    buildEnvelopePaths(env, n, xFor, yFor);

  const plotGeom: TrendPlotGeom = {
    xFor,
    yFor,
    padL,
    padR,
    viewW,
    innerW,
    innerH,
    n,
  };

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
      <svg
        viewBox={`0 0 ${viewW} ${chartH}`}
        preserveAspectRatio="none"
        className="w-full select-none"
        style={{ height: fillParent ? "100%" : chartH }}
        shapeRendering="geometricPrecision"
        role="img"
        aria-label="추이 차트"
      >
        <defs>
          <filter
            id={glowFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.35" />
          </filter>
        </defs>
        <g
          key={`${plotEnterKey}:${scopeMotionKey}`}
          className={cn(
            motionClass.farmChartCrosshair,
            animate && scopeMotionKey === 0
              ? motionClass.farmChartPlotReveal
              : undefined,
            scopeMotionKey > 0
              ? scopeMotionDir === "out"
                ? motionClass.farmChartScopeZoomOut
                : motionClass.farmChartScopeZoomIn
              : undefined,
          )}
        >
        <CoverageBandsLayer bands={coverageBands} geom={plotGeom} />
        <NullGapsLayer gaps={nullGapRanges} geom={plotGeom} />
        <BandGuidesLayer
          guides={guidePresence.map(({ item, key, phase }) => ({
            key,
            value: item.gy,
            className: chartBandGuideClass(phase),
          }))}
          geom={plotGeom}
        />
        <TrendChartDataLayers
          mode={mode}
          n={n}
          padL={padL}
          padR={padR}
          viewW={viewW}
          innerH={innerH}
          innerW={innerW}
          barW={barW}
          barSlotW={barSlotW}
          hoverIdx={hoverIdx}
          hoverSeries={hoverSeries}
          edgeDragId={edgeDragId}
          hoveredEdgeId={hoveredEdgeId}
          glowFilterId={glowFilterId}
          showMarkers={showMarkers}
          markerRadiusPx={markerRadiusPx}
          series={series}
          histPresence={histPresence}
          envelopePresence={envelopePresence}
          seriesPresence={seriesPresence}
          scaleEdgeLabels={scaleEdgeLabels}
          uniqueAlarmBands={alarmPresence}
          dedupedReferenceLines={dedupedReferenceLines}
          pinnedTips={pinnedTips}
          plotGeom={plotGeom}
          yFor={yFor}
          xFor={xFor}
          xForBar={xForBar}
          markerRx={markerRx}
          markerRy={markerRy}
          shouldShowMarker={shouldShowMarker}
          lineSegments={lineSegments}
          envelopePaths={envelopePaths}
          commandSettingHits={positionedCommandHits}
          commandHoverId={hoverEventMark?.id ?? null}
        />
        {eventLane && eventLaneH > 0 ? (
          <>
            <CommandHoldLaneSvg
              marks={positionedEventMarks}
              padL={padL}
              padR={padR}
              viewW={viewW}
              laneTop={eventLaneTop}
              laneH={eventLaneH}
              rowCount={eventLane.rowLabels.length}
            />
            <EventLaneSvgGuides
              padL={padL}
              padR={padR}
              viewW={viewW}
              laneTop={eventLaneTop}
              laneH={eventLaneH}
              rowCount={eventLane.rowLabels.length}
            />
          </>
        ) : null}
        </g>
        {/* 마우스 기준 회색 십자선 — DOM 직접 갱신(리렌더 최소화) */}
        <line
          ref={crossVRef}
          x1={padL}
          x2={padL}
          y1={PAD_TOP}
          y2={PAD_TOP + innerH + eventLaneH}
          stroke="var(--muted-foreground)"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          className={motionClass.farmChartCrosshair}
          style={{ opacity: 0 }}
          pointerEvents="none"
        />
        <line
          ref={crossHRef}
          x1={padL}
          x2={viewW - padR}
          y1={PAD_TOP}
          y2={PAD_TOP}
          stroke="var(--muted-foreground)"
          strokeWidth={0.7}
          strokeDasharray="2.5 2"
          vectorEffect="non-scaling-stroke"
          opacity={0}
          className={motionClass.farmChartCrosshair}
          style={{ opacity: 0 }}
          pointerEvents="none"
        />
        {(() => {
          const win = draftPresence.mounted ? draftPresence.value : null;
          if (win == null) return null;
          const x0 = win.a;
          const x1 = win.b;
          const y0 = win.y0;
          const y1 = win.y;
          const left = Math.min(x0, x1);
          const right = Math.max(x0, x1);
          const top = Math.min(y0, y1);
          const bot = Math.max(y0, y1);
          const w = Math.max(0.5, right - left);
          const rawH = bot - top;
          const h = Math.max(3.2, rawH);
          const yMid = (top + bot) / 2;
          const yBox = Math.min(
            scopeYMax - h,
            Math.max(PAD_TOP, rawH < 3.2 ? yMid - h / 2 : top),
          );
          const rx = markerRx(4.2);
          const ry = markerRy(4.2);
          const rxEnd = markerRx(5);
          const ryEnd = markerRy(5);
          return (
            <g
              pointerEvents="none"
              aria-hidden
              className={chartTipPresenceClass(draftPresence.phase)}
            >
              <rect
                x={left}
                y={yBox}
                width={w}
                height={h}
                fill="var(--channel-hum)"
                fillOpacity={0.12}
                stroke="var(--channel-hum)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={left}
                y={yBox}
                width={0.7}
                height={h}
                fill="var(--channel-hum)"
                opacity={0.95}
              />
              <rect
                className={motionClass.farmChartScopeHandlePulse}
                x={right - 0.7}
                y={yBox}
                width={0.7}
                height={h}
                fill="var(--channel-hum)"
                opacity={0.95}
              />
              <ellipse
                cx={x0}
                cy={y0}
                rx={rx}
                ry={ry}
                fill="var(--channel-hum)"
                stroke="#fff"
                strokeWidth={0.35}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={rxEnd}
                ry={ryEnd}
                fill="#fff"
                stroke="var(--channel-hum)"
                strokeWidth={0.55}
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx={x1}
                cy={y1}
                rx={markerRx(2)}
                ry={markerRy(2)}
                fill="var(--channel-hum)"
              />
              <line
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke="var(--channel-hum)"
                strokeWidth={0.35}
                strokeDasharray="1.2 1.2"
                vectorEffect="non-scaling-stroke"
                opacity={0.7}
              />
            </g>
          );
        })()}
      </svg>

      <TrendChartCrosshairChip
        chipRef={crossChipRef}
        timeRef={crossChipTimeRef}
        tempRef={crossChipTempRef}
        humRef={crossChipHumRef}
        motorRef={crossChipMotorRef}
        otherRef={crossChipOtherRef}
      />

      {eventLane && eventLaneH > 0 ? (
        <EventLaneHtmlOverlay
          lane={eventLane}
          marks={positionedEventMarks}
          viewW={viewW}
          chartH={chartH}
          laneTop={eventLaneTop}
          laneH={eventLaneH}
          padL={padL}
          padR={padR}
          labelGutter={labelGutter}
          selectedId={
            [...pinnedTips]
              .reverse()
              .find((p) => p.eventMark)?.eventMark?.id ??
            hoverEventMark?.id ??
            null
          }
          onSelect={(mark, anchor) => {
            const placed = positionedEventMarks.find(
              (row) => row.mark.id === mark.id,
            );
            if (!placed && !anchor) return;
            const id = `event:${mark.id}`;
            setPinnedTips((prev) => {
              if (prev.some((p) => p.id === id)) {
                return prev.filter((p) => p.id !== id);
              }
              const next: PinnedTip = {
                id,
                idx: 0,
                seriesKey: id,
                nx: anchor ? anchor.nx : placed!.xView / viewW,
                ny: anchor ? anchor.ny : placed!.yView / chartH,
                ox: 0,
                oy: 0,
                eventMark: mark,
                atMs: mark.atMs,
              };
              return [...prev, next].slice(-MAX_PINNED_TIPS);
            });
          }}
          onEmptyContextMenu={() => {
            // 카드가 있으면 일괄 닫기(줌인 뒤로가기보다 우선). 처리 시 true.
            if (pinnedTips.length > 0) {
              setPinnedTips([]);
              return true;
            }
            return false;
          }}
          onHover={(mark, client) => {
            if (!mark) {
              if (hoverEventMarkRef.current) {
                hoverEventMarkRef.current = null;
                setHoverEventMark(null);
              }
              if (hoverSeriesRef.current?.startsWith("event:")) {
                hoverIdxRef.current = null;
                hoverSeriesRef.current = null;
                setHoverIdx(null);
                setHoverSeries(null);
              }
              return;
            }
            const same = hoverEventMarkRef.current?.id === mark.id;
            hoverEventMarkRef.current = mark;
            if (!same) {
              hoverIdxRef.current = null;
              hoverSeriesRef.current = `event:${mark.id}`;
              setHoverIdx(null);
              setHoverSeries(`event:${mark.id}`);
              setHoverEventMark(mark);
            }
            const plot = plotRef.current;
            if (!plot) return;
            const rect = plot.getBoundingClientRect();
            const placed = positionedEventMarks.find(
              (row) => row.mark.id === mark.id,
            );
            const anchorX = client
              ? Math.min(rect.width, Math.max(0, client.x - rect.left))
              : placed
                ? (placed.xView / viewW) * rect.width
                : rect.width / 2;
            const anchorY = client
              ? Math.min(rect.height, Math.max(0, client.y - rect.top))
              : placed
                ? (placed.yView / chartH) * rect.height
                : rect.height / 2;
            lastAnchorRef.current = {
              x: anchorX,
              y: anchorY,
              w: rect.width,
              h: rect.height,
            };
            placeTipNear(anchorX, anchorY, rect.width, rect.height);
          }}
          scopeHandlers={
            xScopeSelect
              ? {
                  begin: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    beginXScopeAt(clientX, clientY, plot);
                  },
                  move: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    moveXScopeAt(clientX, clientY, plot);
                  },
                  end: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return false;
                    return endXScopeAt(clientX, clientY, plot);
                  },
                  cancel: () => onXScopePointerCancel(),
                }
              : null
          }
        />
      ) : null}

      {positionedCommandHits.length > 0 ? (
        <CommandSettingHitOverlay
          hits={positionedCommandHits}
          viewW={viewW}
          chartH={chartH}
          selectedId={
            [...pinnedTips]
              .reverse()
              .find((p) => p.eventMark)?.eventMark?.id ??
            hoverEventMark?.id ??
            null
          }
          onSelect={(mark, anchor) => {
            const hit = positionedCommandHits.find(
              (row) => row.seg.mark.id === mark.id,
            );
            if (!hit && !anchor) return;
            const id = `event:${mark.id}`;
            setPinnedTips((prev) => {
              if (prev.some((p) => p.id === id)) {
                return prev.filter((p) => p.id !== id);
              }
              const nx = anchor
                ? anchor.nx
                : (hit!.x0 + hit!.x1) / 2 / viewW;
              const ny = anchor
                ? anchor.ny
                : (hit!.y + hit!.h / 2) / chartH;
              const next: PinnedTip = {
                id,
                idx: 0,
                seriesKey: id,
                nx,
                ny,
                ox: 0,
                oy: 0,
                eventMark: mark,
                atMs: mark.atMs,
              };
              return [...prev, next].slice(-MAX_PINNED_TIPS);
            });
          }}
          onEmptyContextMenu={() => {
            if (pinnedTips.length > 0) {
              setPinnedTips([]);
              return true;
            }
            return false;
          }}
          onHover={(mark, client) => {
            if (!mark) {
              if (hoverEventMarkRef.current) {
                hoverEventMarkRef.current = null;
                setHoverEventMark(null);
              }
              if (hoverSeriesRef.current?.startsWith("event:")) {
                hoverIdxRef.current = null;
                hoverSeriesRef.current = null;
                setHoverIdx(null);
                setHoverSeries(null);
              }
              return;
            }
            const same = hoverEventMarkRef.current?.id === mark.id;
            hoverEventMarkRef.current = mark;
            if (!same) {
              hoverIdxRef.current = null;
              hoverSeriesRef.current = `event:${mark.id}`;
              setHoverIdx(null);
              setHoverSeries(`event:${mark.id}`);
              setHoverEventMark(mark);
            }
            const plot = plotRef.current;
            if (!plot) return;
            const rect = plot.getBoundingClientRect();
            const hit = positionedCommandHits.find(
              (row) => row.seg.mark.id === mark.id,
            );
            const anchorX = client
              ? Math.min(rect.width, Math.max(0, client.x - rect.left))
              : hit
                ? ((hit.x0 + hit.x1) / 2 / viewW) * rect.width
                : rect.width / 2;
            const anchorY = client
              ? Math.min(rect.height, Math.max(0, client.y - rect.top))
              : hit
                ? ((hit.y + hit.h / 2) / chartH) * rect.height
                : rect.height / 2;
            lastAnchorRef.current = {
              x: anchorX,
              y: anchorY,
              w: rect.width,
              h: rect.height,
            };
            placeTipNear(anchorX, anchorY, rect.width, rect.height);
          }}
          scopeHandlers={
            xScopeSelect
              ? {
                  begin: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    beginXScopeAt(clientX, clientY, plot);
                  },
                  move: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return;
                    moveXScopeAt(clientX, clientY, plot);
                  },
                  end: (clientX, clientY) => {
                    const plot = plotRef.current;
                    if (!plot) return false;
                    return endXScopeAt(clientX, clientY, plot, {
                      timeOnly: true,
                    });
                  },
                  cancel: () => onXScopePointerCancel(),
                }
              : null
          }
        />
      ) : null}

      {viewW > 0
        ? coverageBands.map((g) => {
            const x0 = xFor(g.i0);
            const x1 = xFor(g.i1);
            const slot = n > 1 ? innerW / (n - 1) : innerW;
            const left = Math.max(padL, x0 - slot / 2);
            const right = Math.min(viewW - padR, x1 + slot / 2);
            const width = Math.max(0, right - left);
            if (width / viewW < 0.08 && g.i1 - g.i0 < 1) return null;
            const color =
              g.kind === "sparse"
                ? "var(--status-warn-on-canvas)"
                  : g.kind === "offline"
                  ? "var(--status-danger-on-canvas)"
                  : undefined;
            return (
              <span
                key={`cov-lab-${g.kind}-${g.i0}-${g.i1}`}
                className="pointer-events-none absolute top-1 z-[1] truncate px-0.5 farm-chart-fs-axis tabular-nums"
                style={{
                  left: `${(left / viewW) * 100}%`,
                  width: `${(width / viewW) * 100}%`,
                  color: color ?? "var(--muted-foreground)",
                }}
              >
                {g.label}
              </span>
            );
          })
        : null}

      {yGutterStartCaption && !hideAxisChrome ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1 top-0.5 z-[2] farm-chart-fs-axis font-medium leading-none text-muted-foreground",
            "transition-opacity duration-motion-fast",
            dimPlotValues && "opacity-30",
          )}
        >
          {yGutterStartCaption}
        </span>
      ) : null}
      {yGutterEndCaption && !hideAxisChrome ? (
        <span
          className={cn(
            "pointer-events-none absolute right-1 top-0.5 z-[2] farm-chart-fs-axis font-medium leading-none text-muted-foreground",
            "transition-opacity duration-motion-fast",
            dimPlotValues && "opacity-30",
          )}
        >
          {yGutterEndCaption}
        </span>
      ) : null}

      {leftAxisTicks.map((tick) => (
        <span
          key={tick.id}
          className={cn(
            "pointer-events-none absolute left-1 z-[1] -translate-y-1/2 leading-none text-muted-foreground",
            labelGutter ? "farm-chart-fs-legend font-medium" : "farm-chart-fs-axis",
            "transition-opacity duration-motion-fast",
            dimPlotValues && "opacity-30",
          )}
          style={{ top: `${tick.topPct}%` }}
          aria-hidden
        >
          <TrendYLabelChip
            text={tick.text}
            className={
              labelGutter && !yLabelColumn
                ? "min-h-7 px-1.5 py-1 farm-chart-fs-legend font-medium"
                : "farm-chart-fs-axis"
            }
          />
        </span>
      ))}

      {hoveredEdgePresence.mounted && hoveredEdgePresence.value ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 z-[4] -translate-y-1/2",
            chartTipPresenceClass(hoveredEdgePresence.phase),
          )}
          style={{ top: `${hoveredEdgePresence.value.topPct}%` }}
          aria-hidden
        >
          <div
            className="h-[1.5px] w-full rounded-full"
            style={{
              background: hoveredEdgePresence.value.color,
              boxShadow: `0 0 3px 0.5px ${hoveredEdgePresence.value.color}`,
              opacity: 0.8,
            }}
          />
        </div>
      ) : null}

      {edgeBandLabels.map((label) => {
        const editing = edgeEdit?.id === label.id;
        const showActions =
          Boolean(label.showApplyActions) &&
          (onScaleEdgeApply != null || onScaleEdgeRevert != null);
        const alarmIconDomain =
          label.labelIcon === "temp-alarm"
            ? "temp"
            : label.labelIcon === "hum-alarm"
              ? "humidity"
              : null;
        const valueText = alarmIconDomain ? (
          <AlarmDomainIcon
            domain={alarmIconDomain}
            sizeClass={labelGutter ? "size-4" : "size-3.5"}
          />
        ) : (
          <TrendYLabelChip
            text={label.text}
            mark={!editing ? label.mark : undefined}
            className={
              labelGutter
                ? "min-h-7 px-1.5 py-1 text-xs font-semibold"
                : "farm-chart-fs-axis"
            }
          />
        );
        return (
          <span
            key={label.id}
            className={cn(
              "absolute z-[2] -translate-y-1/2 leading-none tabular-nums",
              labelGutter ? "text-xs font-semibold" : "farm-chart-fs-axis",
              showActions && "inline-flex items-center gap-0.5 pr-0",
              (editing || Boolean(label.leadingText) || Boolean(label.labelIcon)) &&
                "inline-flex items-center gap-1 whitespace-nowrap",
              Boolean(label.leadingText) &&
                !editing &&
                "shadow-sm ring-1 ring-current/20",
              Boolean(label.labelIcon) &&
                !editing &&
                "rounded-md bg-card/85 px-0.5 py-0.5",
              label.draggable && !editing
                ? onScaleEdgeDrag
                  ? "pointer-events-auto cursor-ns-resize select-none"
                  : "pointer-events-auto cursor-text select-none"
                : "pointer-events-auto",
              "transition-opacity duration-motion-fast",
              hoveredEdgeId != null &&
                hoveredEdgeId !== label.id &&
                "opacity-45",
              dimPlotValues && "opacity-30",
              hoveredEdgeId === label.id && "z-[6] font-semibold",
              label.side === "left" && "left-1 text-left",
              /** 설정 명칭 단독(레거시) — 수치 칩 바로 왼쪽 */
              label.side === "plotStart" &&
                "left-1/2 z-[3] -translate-x-[calc(100%+0.35rem)] text-right font-medium",
              /** 설정 수치 — 플롯 중앙 (leadingText 있으면 명칭+수치) */
              label.side === "center" &&
                "left-1/2 z-[3] -translate-x-1/2 text-center",
              /** 모바일 거터 — 우측 단일 열(큰 칩). PC 위젯은 플롯 밖 칸 */
              label.side === "right" &&
                yLabelColumn &&
                "right-1 z-[3] whitespace-nowrap",
              label.side === "right" &&
                labelGutter &&
                "right-1 max-w-[6.5rem] text-center",
              label.side === "right" &&
                !labelGutter &&
                !yLabelColumn &&
                label.labelLane === "inner" &&
                !showActions &&
                "right-11 text-center",
              label.side === "right" &&
                !labelGutter &&
                !yLabelColumn &&
                label.labelLane === "inner" &&
                showActions &&
                "right-1 text-center",
              label.side === "right" &&
                !labelGutter &&
                !yLabelColumn &&
                label.labelLane !== "inner" &&
                "right-0.5 text-center",
              edgeDragId === label.id &&
                (labelGutter ||
                label.side === "center" ||
                label.side === "plotStart"
                  ? "min-h-9 text-sm ring-2 ring-current/45"
                  : "ring-1 ring-current/40"),
            )}
            style={{ top: `${label.topPct}%`, color: label.color }}
            title={
              label.draggable
                ? onScaleEdgeDrag
                  ? `${label.title} ${label.text} · 드래그 조절 · 더블클릭(PC)·더블탭(모바일)·우클릭 숫자 입력`
                  : `${label.title} ${label.text} · 클릭·더블클릭·우클릭으로 숫자 입력`
                : `${label.title}${label.labelIcon ? ` ${label.text}` : ""}`
            }
            aria-label={
              label.labelIcon
                ? `${label.title} ${label.text}`
                : undefined
            }
            onPointerEnter={() => {
              clearHover();
              setHoveredEdgeId(label.id);
            }}
            onPointerLeave={() =>
              setHoveredEdgeId((cur) => (cur === label.id ? null : cur))
            }
            onPointerDown={
              label.draggable && !editing
                ? (e) => {
                    if (!isPrimaryPress(e) || !plotRef.current) return;
                    e.stopPropagation();
                    const guide = scaleEdgeLabels.find((g) => g.id === label.id);
                    if (!guide?.draggable) return;
                    if (!onScaleEdgeDrag) return;
                    e.preventDefault();
                    plotRef.current.setPointerCapture(e.pointerId);
                    labelDragArmRef.current = {
                      id: guide.id,
                      axis: guide.axis ?? "left",
                      value: guide.value,
                      x: e.clientX,
                      y: e.clientY,
                      pointerId: e.pointerId,
                      pointerType: e.pointerType,
                    };
                    clearHover();
                    setHoveredEdgeId(null);
                  }
                : undefined
            }
            onClick={
              label.draggable && !editing && onScaleEdgeNumericCommit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginScaleEdgeEdit(label.id);
                  }
                : undefined
            }
            onDoubleClick={
              label.draggable && onScaleEdgeNumericCommit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginScaleEdgeEdit(label.id);
                  }
                : undefined
            }
            onContextMenu={
              label.draggable && onScaleEdgeNumericCommit
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginScaleEdgeEdit(label.id);
                  }
                : undefined
            }
          >
            {editing ? (
              <>
                {label.leadingText ? (
                  <span className="font-medium not-italic tracking-tight">
                    {label.leadingText}
                  </span>
                ) : null}
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  aria-label={`${label.title} 숫자 입력`}
                  className={cn(
                    "rounded-sm border border-current/40 bg-background text-center tabular-nums outline-none select-text",
                    labelGutter
                      ? "h-7 w-14 px-1 text-xs font-semibold"
                      : "h-4 w-10 px-0.5 farm-chart-fs-axis",
                  )}
                  style={{
                    color: label.color,
                    minWidth: `${edgeValueMaxCh}ch`,
                  }}
                  value={edgeEdit.text}
                  onChange={(e) =>
                    setEdgeEdit({ id: label.id, text: e.target.value })
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => commitScaleEdgeEdit()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitScaleEdgeEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelScaleEdgeEdit();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                {parseScaleEdgeValueUnit(label.text) ? (
                  <span className="tabular-nums">
                    {parseScaleEdgeValueUnit(label.text)}
                  </span>
                ) : null}
              </>
            ) : label.leadingText ? (
              <>
                <span className="font-medium not-italic tracking-tight">
                  {label.leadingText}
                </span>
                {valueText}
              </>
            ) : (
              valueText
            )}
            {showActions ? (
              <span
                className="ml-0.5 inline-flex items-center gap-0.5"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {onScaleEdgeApply ? (
                  <button
                    type="button"
                    aria-label="설정값 적용"
                    title="적용 (명령 전송)"
                    disabled={scaleEdgeApplyBusy || scaleEdgeApplyDisabled}
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                      "hover:bg-current/10 disabled:opacity-40",
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (scaleEdgeApplyBusy || scaleEdgeApplyDisabled) return;
                      onScaleEdgeApply();
                    }}
                  >
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </button>
                ) : null}
                {onScaleEdgeRevert ? (
                  <button
                    type="button"
                    aria-label="설정값 되돌리기"
                    title="되돌리기"
                    disabled={scaleEdgeApplyBusy}
                    className={cn(
                      "inline-flex size-5 items-center justify-center rounded border border-current/35 bg-background/95",
                      "hover:bg-current/10 disabled:opacity-40",
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (scaleEdgeApplyBusy) return;
                      onScaleEdgeRevert();
                    }}
                  >
                    <RotateCcw className="size-3" strokeWidth={2.5} aria-hidden />
                  </button>
                ) : null}
              </span>
            ) : null}
          </span>
        );
      })}

      {pinPresence.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[15] h-full w-full overflow-visible"
          aria-hidden
        >
          {pinPresence.map(({ item: pin, key, phase }) => {
            if (!pin.eventMark && (pin.idx < 0 || pin.idx >= n)) return null;
            const plotW = plotPx.w || 1;
            const plotH = plotPx.h || 1;
            const anchorX = pin.nx * plotW;
            const anchorY = pin.ny * plotH;
            const tipW = pinCardSizes[pin.id]?.w ?? 168;
            const tipH = pinCardSizes[pin.id]?.h ?? 88;
            const base = computeTipPlacement(
              anchorX,
              anchorY,
              plotW,
              plotH,
              tipW,
              tipH,
            );
            const left = base.left + pin.ox;
            const top = base.top + pin.oy;
            // 앵커에서 카드 사각형에 가장 가까운 경계점 → 배치 방향과 무관하게
            // 점선이 항상 카드 모서리에 닿는다.
            const attachX = Math.min(Math.max(anchorX, left), left + tipW);
            const attachY = Math.min(Math.max(anchorY, top), top + tipH);
            const eventStroke =
              pin.eventMark?.tone === "ok"
                ? "var(--status-ok)"
                : "var(--channel-command)";
            return (
              <g
                key={`pin-link-${key}`}
                className={chartTipPresenceClass(phase)}
              >
                {pin.eventMark ? (
                  <>
                    <ellipse
                      cx={anchorX}
                      cy={anchorY}
                      rx={10}
                      ry={10}
                      fill="none"
                      stroke={eventStroke}
                      strokeWidth={1.35}
                      opacity={0.95}
                    />
                    <ellipse
                      cx={anchorX}
                      cy={anchorY}
                      rx={5}
                      ry={5}
                      fill={eventStroke}
                      opacity={0.9}
                    />
                  </>
                ) : null}
                <line
                  x1={anchorX}
                  y1={anchorY}
                  x2={attachX}
                  y2={attachY}
                  className="stroke-foreground/55"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                />
              </g>
            );
          })}
        </svg>
      ) : null}

      {pinPresence.map(({ item: pin, key, phase }, pinOrd) => {
        if (!pin.eventMark && (pin.idx < 0 || pin.idx >= n)) return null;
        const plotW = plotPx.w || 1;
        const plotH = plotPx.h || 1;
        const anchorX = pin.nx * plotW;
        const anchorY = pin.ny * plotH;
        const tipW = pinCardSizes[pin.id]?.w ?? 168;
        const tipH = pinCardSizes[pin.id]?.h ?? 88;
        const base = computeTipPlacement(
          anchorX,
          anchorY,
          plotW,
          plotH,
          tipW,
          tipH,
        );
        const left = base.left + pin.ox;
        const top = base.top + pin.oy;
        return (
          <div
            key={key}
            ref={(el) => {
              if (!el) return;
              const w = el.offsetWidth;
              const h = el.offsetHeight;
              if (w <= 0 || h <= 0) return;
              setPinCardSizes((prev) => {
                const cur = prev[pin.id];
                if (cur && cur.w === w && cur.h === h) return prev;
                return { ...prev, [pin.id]: { w, h } };
              });
            }}
            className={cn(
              "pointer-events-auto absolute w-max max-w-[16rem] cursor-grab touch-none select-none active:cursor-grabbing",
              chartTipPresenceClass(phase),
            )}
            style={{ left, top, zIndex: 20 + pinOrd }}
            data-tour-id="trend-chart-pinned-card"
            data-pin-id={pin.id}
            aria-label="데이터 카드 · 드래그로 이동, 우클릭으로 닫기"
            title="드래그로 이동 · 우클릭으로 닫기"
            onPointerDown={(e) => {
              e.stopPropagation();
              bringPinToFront(pin.id);
              // 카드 본문 아무 곳이나 잡아 드래그(핸들바 없이). 내부 버튼/입력은 제외.
              if (!isPrimaryPress(e) || !plotRef.current) return;
              const target = e.target as HTMLElement | null;
              if (target?.closest("button, a, input, select, textarea")) return;
              e.preventDefault();
              plotRef.current.setPointerCapture(e.pointerId);
              pinCardDragRef.current = {
                id: pin.id,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                origOx: pin.ox,
                origOy: pin.oy,
              };
            }}
            onContextMenu={(e) => {
              // 카드 위 우클릭 = 닫기 (위치 이동에도 카드 자체에 붙어 따라감)
              e.preventDefault();
              e.stopPropagation();
              setPinnedTips((prev) => prev.filter((p) => p.id !== pin.id));
            }}
          >
            <div className="overflow-hidden rounded-md border border-border/80 bg-popover/95 text-popover-foreground shadow-lg backdrop-blur-sm">
              <div className="px-2.5 py-1.5">
                {pin.eventMark ? (
                  <TrendEventCardBody mark={pin.eventMark} />
                ) : overlayHoverMerge &&
                  isOverlayMergedHoverGroup(
                    inferHoverMetricGroup(pin.seriesKey),
                  ) ? (
                  <OverlayMergedPointCards
                    idx={pin.idx}
                    categories={categories}
                    series={series}
                    envelopes={envelopes}
                    histograms={histograms}
                    leftUnit={leftUnit}
                    rightUnit={rightUnit}
                    onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                  />
                ) : (
                  <TrendPointCardBody
                    idx={pin.idx}
                    seriesKey={pin.seriesKey}
                    categories={categories}
                    series={series}
                    envelopes={envelopes}
                    histograms={histograms}
                    leftUnit={leftUnit}
                    rightUnit={rightUnit}
                    onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}

      {hoverCardPresence.mounted && hoverCardPresence.value ? (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[16rem]"
          style={{ opacity: 0, willChange: "transform" }}
          aria-live="polite"
          data-tour-id="trend-chart-hover-card"
        >
          <div
            className={cn(
              "rounded-md border border-border/80 bg-popover/95 px-2.5 py-1.5 text-popover-foreground shadow-lg backdrop-blur-sm",
              chartTipPresenceClass(hoverCardPresence.phase),
            )}
          >
            {hoverCardPresence.value.kind === "event" ? (
              <TrendEventCardBody mark={hoverCardPresence.value.mark} />
            ) : (
              <>
                {(() => {
                  const idx = hoverCardPresence.value.idx;
                  const band = coverageBands.find(
                    (b) => idx >= b.i0 && idx <= b.i1,
                  );
                  return band ? (
                    <p className="mb-1 farm-chart-fs-legend text-muted-foreground">
                      {band.label}
                    </p>
                  ) : null;
                })()}
                {(() => {
                  const card = hoverCardPresence.value;
                  if (card.kind !== "point") return null;
                  const hg = inferHoverMetricGroup(card.seriesKey);
                  if (overlayHoverMerge && isOverlayMergedHoverGroup(hg)) {
                    return (
                      <OverlayMergedPointCards
                        idx={card.idx}
                        categories={categories}
                        series={series}
                        envelopes={envelopes}
                        histograms={histograms}
                        leftUnit={leftUnit}
                        rightUnit={rightUnit}
                        onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                      />
                    );
                  }
                  return (
                    <TrendPointCardBody
                      idx={card.idx}
                      seriesKey={card.seriesKey}
                      categories={categories}
                      series={series}
                      envelopes={envelopes}
                      histograms={histograms}
                      leftUnit={leftUnit}
                      rightUnit={rightUnit}
                      onBreachEquipmentNavigate={onBreachEquipmentNavigate}
                    />
                  );
                })()}
              </>
            )}
          </div>
        </div>
      ) : null}
      </div>
      </div>

      {!hideAxisChrome ? (
      <div className="relative shrink-0 overflow-visible border-t border-border">
        <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1]" aria-hidden>
          {axisMarks.minors.map((t) => (
            <span
              key={`axis-minor-${t}`}
              className="absolute top-0 w-px h-1.5 -translate-x-1/2 bg-muted-foreground/30"
              style={{ left: `${viewW > 0 ? ((padL + t * innerW) / viewW) * 100 : 0}%` }}
            />
          ))}
          {axisTicks.map((m) => (
            <span
              key={`axis-major-${m.t}-${m.fullLabel}`}
              className="absolute top-0 w-px h-2 -translate-x-1/2 bg-muted-foreground/55"
              style={{
                left: `${viewW > 0 ? ((padL + m.t * innerW) / viewW) * 100 : 0}%`,
              }}
            />
          ))}
          <span
            className="absolute top-0 w-0.5 h-2.5 -translate-x-1/2 bg-muted-foreground/70"
            style={{
              left: `${viewW > 0 ? ((padL + innerW) / viewW) * 100 : 100}%`,
            }}
          />
        </div>
        <div className="relative farm-chart-tick-rail-stacked overflow-visible">
          {axisTickViews.map((v) =>
            v.parts.date ? (
              <span
                key={`tick-date-${v.key}`}
                className="pointer-events-none absolute top-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
              >
                {v.parts.date}
              </span>
            ) : null,
          )}
          {axisTickViews.map((v) =>
            v.parts.time ? (
              <span
                key={`tick-time-${v.key}`}
                className="pointer-events-none absolute bottom-0.5 -translate-x-1/2 text-center farm-chart-fs-axis leading-none text-muted-foreground tabular-nums whitespace-nowrap"
                style={{ left: `${v.leftPct}%` }}
                title={v.fullLabel}
              >
                {v.parts.time}
              </span>
            ) : null,
          )}
        </div>
        </div>
      </div>
      ) : null}
      </div>
    </div>
  );
}
