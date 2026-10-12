"use client";

import { useEffect, useRef, type RefObject } from "react";
import { shouldPreferLookbackPinch } from "./trend-chart-interaction";

/**
 * 룩백(기간 확대/축소) 제스처 — 휠 · 2손가락 핀치.
 *
 * - 비passive 네이티브 리스너를 플롯 div에 직접 부착 (preventDefault 필요)
 * - 휠: X스코프 드래그/draft·스케일 편집·드래그 중에는 무시
 * - 핀치: 진입 시 X스코프 draft와 핀 클릭 암을 취소하고 `lookbackPinchActiveRef`를 올림
 * - `lookbackPinchActiveRef`: 핀치 세션 중 pointerdown 핸들러가 X스코프·핀 암을 생략하도록 노출
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendLookbackGesture(opts: {
  plotRef: RefObject<HTMLDivElement | null>;
  onLookbackWheel?: (dir: 1 | -1) => void;
  /** 스케일 엣지 숫자 편집 중 — 휠·핀치 모두 차단 */
  edgeEdit: object | null;
  edgeDragRef: RefObject<object | null>;
  labelDragArmRef: RefObject<object | null>;
  xDraftRef: RefObject<object | null>;
  xScopeDraggingRef: RefObject<boolean>;
  pinClickArmRef: RefObject<object | null>;
  onXScopePointerCancel: () => void;
}) {
  const {
    plotRef,
    onLookbackWheel,
    edgeEdit,
    edgeDragRef,
    labelDragArmRef,
    xDraftRef,
    xScopeDraggingRef,
    pinClickArmRef,
    onXScopePointerCancel,
  } = opts;

  /** 2손가락 룩백 핀치 중 — X스코프 draft 재진입·커밋 방지 */
  const lookbackPinchActiveRef = useRef(false);
  const cancelXScopeRef = useRef(onXScopePointerCancel);
  useEffect(() => {
    cancelXScopeRef.current = onXScopePointerCancel;
  }, [onXScopePointerCancel]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !onLookbackWheel) return;
    const pinchFactor = 1.18;
    /** 휠: X스코프·편집 중에는 막음. 핀치: draft는 진입 시 취소하므로 편집만 막음. */
    const wheelBlocked = () =>
      edgeEdit != null ||
      edgeDragRef.current != null ||
      labelDragArmRef.current != null ||
      Boolean(xScopeDraggingRef.current) ||
      xDraftRef.current != null;
    const pinchBlocked = () =>
      edgeEdit != null ||
      edgeDragRef.current != null ||
      labelDragArmRef.current != null;

    const yieldToLookbackPinch = () => {
      lookbackPinchActiveRef.current = true;
      pinClickArmRef.current = null;
      cancelXScopeRef.current();
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (wheelBlocked()) return;
      e.preventDefault();
      onLookbackWheel(e.deltaY > 0 ? 1 : -1);
    };

    let pinchDist = 0;
    const dist = (touches: TouchList) => {
      if (touches.length < 2) return 0;
      const a = touches.item(0);
      const b = touches.item(1);
      if (!a || !b) return 0;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (!shouldPreferLookbackPinch(e.touches.length)) return;
      yieldToLookbackPinch();
      pinchDist = dist(e.touches);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!shouldPreferLookbackPinch(e.touches.length) || pinchBlocked()) return;
      if (xDraftRef.current != null || xScopeDraggingRef.current) {
        yieldToLookbackPinch();
      }
      const d = dist(e.touches);
      if (!(pinchDist > 0) || !(d > 0)) {
        pinchDist = d;
        return;
      }
      const ratio = d / pinchDist;
      if (ratio >= pinchFactor) {
        e.preventDefault();
        pinchDist = d;
        onLookbackWheel(-1);
      } else if (ratio <= 1 / pinchFactor) {
        e.preventDefault();
        pinchDist = d;
        onLookbackWheel(1);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (shouldPreferLookbackPinch(e.touches.length)) return;
      lookbackPinchActiveRef.current = false;
      pinchDist = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    onLookbackWheel,
    edgeEdit,
    plotRef,
    edgeDragRef,
    labelDragArmRef,
    pinClickArmRef,
    xDraftRef,
    xScopeDraggingRef,
  ]);

  return { lookbackPinchActiveRef };
}
