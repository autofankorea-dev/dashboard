"use client";

import { useRef, useState } from "react";
import type {
  ScaleEdgeDragEvent,
  ScaleEdgeNumericCommitEvent,
  TrendAxis,
  TrendScaleEdgeLabel,
} from "@/lib/domain/trend-chart-types";
import {
  PAD_TOP,
  parseScaleEdgeEditSeed,
} from "@/lib/farm/trend-chart-geometry";
import { pickDraggableScaleEdgeHit } from "./trend-chart-interaction";

export type ScaleEdgeLabelDragArm = {
  id: string;
  axis: TrendAxis;
  value: number;
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
};

/**
 * 스케일 엣지(알람 상·하한 등) 라벨의 드래그 조절 · 숫자 직접 입력 상태.
 *
 * - `edgeDragRef`/`edgeDragId`: 드래그 중인 가이드 (ref는 핸들러용, state는 렌더용)
 * - `labelDragArmRef`: 라벨 pointerdown 후 드래그 임계 전 대기 상태
 * - `scaleEdgeTapRef`: 터치 더블탭 판정용 마지막 탭
 * - `edgeEdit`: 숫자 입력 중인 가이드와 입력 텍스트
 * - `domainValueFromYView`: 뷰 Y → 축 도메인 값(클램프)
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendScaleEdgeEdit(opts: {
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  scaleEdgeHitPx: number;
  chartH: number;
  innerH: number;
  leftDomain: readonly [number, number];
  rightDomain: readonly [number, number];
  yFor: (value: number, axis: TrendAxis) => number;
  onScaleEdgeDrag?: (e: ScaleEdgeDragEvent) => void;
  onScaleEdgeNumericCommit?: (e: ScaleEdgeNumericCommitEvent) => void;
  clearHover: () => void;
}) {
  const {
    scaleEdgeLabels,
    scaleEdgeHitPx,
    chartH,
    innerH,
    leftDomain,
    rightDomain,
    yFor,
    onScaleEdgeDrag,
    onScaleEdgeNumericCommit,
    clearHover,
  } = opts;
  const [lMin, lMax] = leftDomain;
  const [rMin, rMax] = rightDomain;

  const [edgeDragId, setEdgeDragId] = useState<string | null>(null);
  const [edgeEdit, setEdgeEdit] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const edgeDragRef = useRef<{
    id: string;
    axis: TrendAxis;
  } | null>(null);
  const labelDragArmRef = useRef<ScaleEdgeLabelDragArm | null>(null);
  const scaleEdgeTapRef = useRef<{
    id: string;
    t: number;
    x: number;
    y: number;
  } | null>(null);

  const domainValueFromYView = (yView: number, axis: TrendAxis): number => {
    const [mn, mx] = axis === "right" ? [rMin, rMax] : [lMin, lMax];
    if (innerH <= 0) return (mn + mx) / 2;
    const t = 1 - (yView - PAD_TOP) / innerH;
    return mn + Math.min(1, Math.max(0, t)) * (mx - mn);
  };

  const hitDraggableScaleEdge = (
    clientY: number,
    rect: DOMRect,
  ): { id: string; axis: TrendAxis; value: number } | null => {
    if (!onScaleEdgeDrag && !onScaleEdgeNumericCommit) return null;
    return pickDraggableScaleEdgeHit(
      scaleEdgeLabels,
      clientY - rect.top,
      yFor,
      chartH,
      rect.height,
      scaleEdgeHitPx,
    );
  };

  const emitScaleEdgeDrag = (
    id: string,
    value: number,
    phase: ScaleEdgeDragEvent["phase"],
  ) => {
    onScaleEdgeDrag?.({ id, value, phase });
  };

  const beginScaleEdgeEdit = (guideId: string) => {
    if (!onScaleEdgeNumericCommit) return;
    const guide = scaleEdgeLabels.find((g) => g.id === guideId);
    if (!guide?.draggable) return;
    if (edgeDragRef.current) {
      endScaleEdgeDrag("cancel");
    }
    labelDragArmRef.current = null;
    scaleEdgeTapRef.current = null;
    setEdgeEdit({
      id: guideId,
      text: parseScaleEdgeEditSeed(guide),
    });
    clearHover();
  };

  const cancelScaleEdgeEdit = () => {
    setEdgeEdit(null);
  };

  const commitScaleEdgeEdit = () => {
    if (!edgeEdit || !onScaleEdgeNumericCommit) {
      setEdgeEdit(null);
      return;
    }
    const parsed = Number(edgeEdit.text.trim());
    if (!Number.isFinite(parsed)) {
      setEdgeEdit(null);
      return;
    }
    const id = edgeEdit.id;
    setEdgeEdit(null);
    onScaleEdgeNumericCommit({ id, value: parsed });
  };

  const endScaleEdgeDrag = (phase: "end" | "cancel") => {
    const cur = edgeDragRef.current;
    if (!cur) return;
    const guide = scaleEdgeLabels.find((g) => g.id === cur.id);
    emitScaleEdgeDrag(cur.id, guide?.value ?? 0, phase);
    edgeDragRef.current = null;
    setEdgeDragId(null);
  };

  return {
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
  };
}
