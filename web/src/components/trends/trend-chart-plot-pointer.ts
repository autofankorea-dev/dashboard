"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  inferHoverMetricGroup,
  isOverlayMergedHoverGroup,
  resolveBreachNavTarget,
} from "@/lib/farm/trend-chart-format";
import {
  PAD_TOP,
  SCALE_EDGE_LABEL_DRAG_PX,
  tipPinId,
} from "@/lib/farm/trend-chart-geometry";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import {
  MAX_PINNED_TIPS,
  PIN_CLICK_SLOP_PX,
  SCALE_EDGE_DOUBLE_TAP_MS,
  SCALE_EDGE_DOUBLE_TAP_SLOP_PX,
  handleScaleEdgeDoubleTap,
  type PinnedTip,
} from "./trend-chart-interaction";
import { useTrendChartModel } from "./use-trend-chart-model";
import { useTrendLookbackGesture } from "./use-trend-lookback-gesture";
import { useTrendScaleEdgeEdit } from "./use-trend-scale-edge-edit";
import { useTrendScopeGesture } from "./use-trend-scope-gesture";

type Model = ReturnType<typeof useTrendChartModel>;
type ScaleEdge = ReturnType<typeof useTrendScaleEdgeEdit>;
type ScopeGesture = ReturnType<typeof useTrendScopeGesture>;
type Lookback = ReturnType<typeof useTrendLookbackGesture>;

type PointerDeps = Model &
  ScaleEdge &
  ScopeGesture &
  Lookback & {
    clearHover: () => void;
    scopeYMax: number;
    yViewFromClient: (clientY: number, rect: DOMRect) => number;
  };

/**
 * 플롯 루트에 붙는 포인터 핸들러.
 * `trend-chart.tsx`가 이 함수의 반환값을 플롯 루트에 그대로 단다.
 */
export function createTrendChartPlotPointer(deps: PointerDeps) {
  const {
    edgeEdit,
    lookbackPinchActiveRef,
    pinClickArmRef,
    xScopeSelect,
    onXScopePointerDown,
    pinCardDragRef,
    setPinnedTips,
    labelDragArmRef,
    edgeDragRef,
    onScaleEdgeDrag,
    scaleEdgeTapRef,
    setEdgeDragId,
    clearHover,
    emitScaleEdgeDrag,
    yViewFromClient,
    domainValueFromYView,
    onXScopePointerMove,
    setPlotHovering,
    onXScopePointerUp,
    onXScopePointerCancel,
    onScaleEdgeNumericCommit,
    beginScaleEdgeEdit,
    endScaleEdgeDrag,
    xScopeDraggingRef,
    xDraftRef,
    findDataPointHit,
    onPlotDoubleClick,
    plotEmptyTapRef,
    plotTouchDoubleTapLockRef,
    eventLane,
    eventLaneH,
    eventLaneTop,
    chartH,
    overlayHoverMerge,
    viewW,
    timeAxisMs,
    pinnedTips,
    series,
    envelopes,
    hoverIdxRef,
    hoverSeriesRef,
    onBreachEquipmentNavigate,
    onPlotBackgroundContextMenu,
    onXScopeBack,
    onXScopeContextMenu,
    n,
    positionedEventMarks,
    setCrosshairAt,
    scopeYMax,
    padR,
    padL,
    setCrosshairChipVisible,
    fillCrosshairChip,
    hoverEventMarkRef,
    setHoverIdx,
    setHoverSeries,
    setHoverEventMark,
    placeTipNear,
    lastAnchorRef,
    hitDraggableScaleEdge,
  } = deps;

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


  return {
    onPlotPointerDown,
    onPlotPointerMove,
    onPlotPointerUp,
    onPlotPointerCancel,
    onPlotDoubleClickHandler,
    onPlotContextMenu,
    onMove,
  };
}
