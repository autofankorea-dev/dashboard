/**
 * 추이 차트 상호작용 보조 — 컴포넌트 상태에 의존하지 않는 최상위 헬퍼/타입/상수.
 *
 * (스코프 드래그/줌처럼 렌더 시점 기하 클로저에 강결합된 로직은 컴포넌트에 유지)
 */

import type { PointerEvent as ReactPointerEvent } from "react";
import { motionClass } from "@/lib/ui/motion-classes";
import type { ClipPhase } from "@/lib/ui/use-clip-presence";
import type { TrendEventMark } from "@/lib/data/trend-chart-types";

export const MAX_PINNED_TIPS = 5;
export const PIN_CLICK_SLOP_PX = 10;
/** 모바일 — 설정값 라벨 더블탭 → 숫자 입력 */
export const SCALE_EDGE_DOUBLE_TAP_MS = 320;
export const SCALE_EDGE_DOUBLE_TAP_SLOP_PX = 28;
export const SCALE_EDGE_TAP_SLOP_PX = 12;

export type ScaleEdgeTapRecord = {
  id: string;
  t: number;
  x: number;
  y: number;
};

export type PinnedTip = {
  id: string;
  idx: number;
  seriesKey: string;
  /** plot 상대 좌표 0~1 (ellipse 앵커) */
  nx: number;
  ny: number;
  /** 기본 배치 대비 사용자 드래그 오프셋(px) */
  ox: number;
  oy: number;
  eventMark?: TrendEventMark;
  /** 데이터 절대시각(ms) — 윈도우 줌 시 범위 판정·재배치용 */
  atMs?: number;
};

export function handleScaleEdgeDoubleTap(
  e: ReactPointerEvent<HTMLDivElement>,
  labelArm: { id: string; x: number; y: number; pointerType: string },
  scaleEdgeTapRef: { current: ScaleEdgeTapRecord | null },
  beginScaleEdgeEdit: (id: string) => void,
): void {
  const dist = Math.hypot(e.clientX - labelArm.x, e.clientY - labelArm.y);
  const isTouchLike =
    labelArm.pointerType === "touch" || labelArm.pointerType === "pen";
  if (dist > SCALE_EDGE_TAP_SLOP_PX || !isTouchLike) return;

  const now = e.timeStamp;
  const prev = scaleEdgeTapRef.current;
  if (
    prev &&
    prev.id === labelArm.id &&
    now - prev.t <= SCALE_EDGE_DOUBLE_TAP_MS &&
    Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <=
      SCALE_EDGE_DOUBLE_TAP_SLOP_PX
  ) {
    scaleEdgeTapRef.current = null;
    beginScaleEdgeEdit(labelArm.id);
    return;
  }

  scaleEdgeTapRef.current = {
    id: labelArm.id,
    t: now,
    x: e.clientX,
    y: e.clientY,
  };
}

export function clipWipeClass(phase: ClipPhase): string | undefined {
  if (phase === "enter") return motionClass.farmChartClipWipeIn;
  if (phase === "exit") return motionClass.farmChartClipWipeOut;
  return undefined;
}

/** 호버·핀 카드·칩 — 등장/퇴장 동일 프리셋 */
export function chartTipPresenceClass(
  phase: ClipPhase | "enter" | "exit",
): string | undefined {
  if (phase === "exit") return motionClass.farmChartTipOut;
  if (phase === "enter") return motionClass.farmChartTipIn;
  return undefined;
}

export function chartBandGuideClass(phase: ClipPhase): string | undefined {
  if (phase === "enter") return motionClass.farmChartBandGuideIn;
  if (phase === "exit") return motionClass.farmChartBandGuideOut;
  return undefined;
}

export type ScaleEdgeHitGuide = {
  id: string;
  value: number;
  axis?: "left" | "right";
  draggable?: boolean;
};

/** 왼쪽/오른쪽 거터 칩 — 칩 높이(~27px)를 덮도록 플롯 선 hit보다 넓게 */
export const SCALE_EDGE_GUTTER_HIT_PX = 28;

export type ScaleEdgeGutterLabel = {
  id: string;
  side: "left" | "right" | "center" | "plotStart";
  draggable?: boolean;
  topPct: number;
};

export function isScaleEdgeMidId(id: string): boolean {
  return id.endsWith("-mid");
}

/**
 * 모바일 룩백 핀치 — 터치 2개 이상이면 X스코프(윈도우 줌)보다 우선.
 * 1손가락 드래그-줌·휠·핀은 그대로 둔다.
 */
export function shouldPreferLookbackPinch(touchCount: number): boolean {
  return touchCount >= 2;
}

function pickPreferredScaleEdgeHit<T extends { d: number; mid: boolean }>(
  hits: T[],
): T | null {
  if (hits.length === 0) return null;
  const mids = hits.filter((h) => h.mid);
  const pool = mids.length > 0 ? mids : hits;
  pool.sort((a, b) => a.d - b.d);
  return pool[0] ?? null;
}

/**
 * 스케일 끝단 히트. 기준(mid) 칩은 선이 없어도 잡고,
 * hit 안에 중간값이 있으면 더 가까운 상·하한보다 중간값을 고른다.
 */
export function pickDraggableScaleEdgeHit(
  guides: readonly ScaleEdgeHitGuide[],
  screenY: number,
  yFor: (value: number, axis: "left" | "right") => number,
  chartH: number,
  rectHeight: number,
  hitPx: number,
): { id: string; axis: "left" | "right"; value: number } | null {
  if (!(rectHeight > 0) || !(chartH > 0) || !(hitPx > 0)) return null;
  if (!Number.isFinite(screenY)) return null;
  const hits: {
    id: string;
    axis: "left" | "right";
    value: number;
    d: number;
    mid: boolean;
  }[] = [];
  for (const guide of guides) {
    if (!guide.draggable) continue;
    const axis = guide.axis ?? "left";
    const y = yFor(guide.value, axis);
    if (!Number.isFinite(y)) continue;
    const d = Math.abs(screenY - (y / chartH) * rectHeight);
    if (d > hitPx) continue;
    hits.push({
      id: guide.id,
      axis,
      value: guide.value,
      d,
      mid: isScaleEdgeMidId(guide.id),
    });
  }
  const best = pickPreferredScaleEdgeHit(hits);
  if (!best) return null;
  return { id: best.id, axis: best.axis, value: best.value };
}

/**
 * 거터 클릭 — 그 쪽(left/right) 칩만 본다.
 * 왼쪽은 알람 기준(중간값), 오른쪽은 권장/상하한.
 */
export function pickGutterScaleEdgeId(
  labels: readonly ScaleEdgeGutterLabel[],
  side: "left" | "right",
  clientY: number,
  rectTop: number,
  rectHeight: number,
  hitPx: number,
): string | null {
  if (!(rectHeight > 0) || !(hitPx > 0) || !Number.isFinite(clientY)) {
    return null;
  }
  const yPct = ((clientY - rectTop) / rectHeight) * 100;
  const hitPct = (hitPx / rectHeight) * 100;
  const hits: { id: string; d: number; mid: boolean }[] = [];
  for (const label of labels) {
    if (label.side !== side || !label.draggable) continue;
    const d = Math.abs(label.topPct - yPct);
    if (d > hitPct) continue;
    hits.push({
      id: label.id,
      d,
      mid: isScaleEdgeMidId(label.id),
    });
  }
  return pickPreferredScaleEdgeHit(hits)?.id ?? null;
}
export function hoverPairSlotDx(innerW: number, n: number): number {
  if (!(innerW > 0)) return 0;
  if (n <= 1) return innerW;
  return (innerW / (n - 1)) * 0.75;
}

export function nearestByXView<T extends { xView: number }>(
  items: readonly T[],
  xView: number,
  maxDx: number,
): T | null {
  if (!(maxDx > 0) || items.length === 0 || !Number.isFinite(xView)) {
    return null;
  }
  let best: T | null = null;
  let bestD = maxDx;
  for (const item of items) {
    if (!Number.isFinite(item.xView)) continue;
    const d = Math.abs(item.xView - xView);
    if (d <= bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}
