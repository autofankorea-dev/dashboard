"use client";

import { useMemo } from "react";
import type {
  TrendAxis,
  TrendRangeBand,
  TrendReferenceLine,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { SEV_COLOR } from "@/lib/farm/severity-score";
import { formatTrendBandEdge } from "@/lib/farm/trend-chart-format";
import {
  mergeOverlappingTempHumEdgeLabels,
  nudgeEdgeLabelTops,
  stackLeftAlarmBaselineLabels,
  type EdgeBandLabel,
} from "@/lib/farm/trend-chart-geometry";
import {
  collectUniqueAlarmBands,
  dedupeReferenceLines,
  plotYForValue,
} from "@/lib/farm/trend-chart-layout";
import { useClipPresence } from "@/lib/ui/use-clip-presence";

/**
 * 알람 밴드 · 기준선 · 스케일 엣지 가이드 → 끝단 라벨 뷰 모델.
 *
 * - `alarmPresence`: 채움 밴드(fillWindow) 등장/퇴장 애니메이션용 presence (시리즈 band 축·lo·hi 1회 + rangeBands)
 * - `dedupedReferenceLines`: 알람 밴드 모서리와 겹치는 기준선 제거
 * - `edgeBandLabels`: 단일 Y는 좌끝, 이중 Y는 축별 좌·우끝. 겹침 병합·간격 보정 포함
 *
 * Y 매핑은 `plotYForValue(value, domain, innerH)`를 직접 호출해 memo deps가 완전하다.
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendEdgeBandLabels(opts: {
  mode: "line" | "bar";
  series: TrendSeries[];
  rangeBands: TrendRangeBand[];
  referenceLines: TrendReferenceLine[];
  scaleEdgeLabels: TrendScaleEdgeLabel[];
  usesRight: boolean;
  leftUnit: string;
  rightUnit: string;
  chartH: number;
  innerH: number;
  leftDomain: readonly [number, number];
  rightDomain: readonly [number, number];
  /** 숫자 입력 중인 가이드 — hideLabel이어도 라벨 유지 */
  editingEdgeId: string | undefined;
  overlayHoverMerge: boolean;
  clipWipeEnabled: boolean;
}) {
  const {
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
    leftDomain,
    rightDomain,
    editingEdgeId,
    overlayHoverMerge,
    clipWipeEnabled,
  } = opts;
  const [lMin, lMax] = leftDomain;
  const [rMin, rMax] = rightDomain;

  /** 알람/한계 점선 — 동일 axis·밴드 1회. */
  const uniqueAlarmBands = useMemo(
    () => collectUniqueAlarmBands(series, rangeBands),
    [series, rangeBands],
  );

  const alarmFillBands = useMemo(
    () => uniqueAlarmBands.filter((b) => b.fillWindow !== false),
    [uniqueAlarmBands],
  );
  const alarmPresence = useClipPresence(
    alarmFillBands,
    (b) =>
      b.id ??
      `${b.axis}:${Number(b.band.lo).toFixed(3)}:${Number(b.band.hi).toFixed(3)}`,
    { enabled: clipWipeEnabled },
  );

  /** referenceLines 중 알람 band 모서리와 중복되는 점선 제거. */
  const dedupedReferenceLines = useMemo(
    () => dedupeReferenceLines(referenceLines, uniqueAlarmBands),
    [referenceLines, uniqueAlarmBands],
  );

  /**
   * 한계(점선) 끝단 라벨
   * - 단일 Y: 좌끝 / 이중 Y: 축별 좌·우끝 (상한 위선·하한 아래선)
   */
  const edgeBandLabels = useMemo(() => {
    if (mode !== "line") return [] as EdgeBandLabel[];
    const domainFor = (axis: TrendAxis): readonly [number, number] =>
      axis === "right" ? [rMin, rMax] : [lMin, lMax];
    const yFor = (value: number, axis: TrendAxis): number =>
      plotYForValue(value, domainFor(axis), innerH);
    const unitForAxis = (axis: TrendAxis) =>
      axis === "right" ? rightUnit : leftUnit;
    const out: EdgeBandLabel[] = [];
    const seriesColorForAxis = (axis: TrendAxis): string | null => {
      const match = series.find((s) => (s.axis ?? "left") === axis);
      return match?.color ?? null;
    };
    const sideForLimit = (axis: TrendAxis): "left" | "right" => {
      if (usesRight) return axis === "right" ? "right" : "left";
      return "left";
    };
    const colorForLimit = (axis: TrendAxis): string => {
      if (usesRight) {
        return seriesColorForAxis(axis) ?? SEV_COLOR.warning;
      }
      return SEV_COLOR.warning;
    };
    uniqueAlarmBands.forEach(({ band, axis, fillWindow }, idx) => {
      if (fillWindow) return;
      const unit = unitForAxis(axis);
      const side = sideForLimit(axis);
      const color = colorForLimit(axis);
      for (const edge of ["hi", "lo"] as const) {
        const value = band[edge];
        const y = yFor(value, axis);
        if (!Number.isFinite(y)) continue;
        out.push({
          id: `alarm-${idx}-${axis}-${edge}-${value}`,
          side,
          topPct: (y / chartH) * 100,
          text: formatTrendBandEdge(value, unit),
          color,
          title: `한계 ${edge === "hi" ? "상한" : "하한"}`,
          mark: edge === "hi" ? "overline" : "underline",
        });
      }
    });
    for (const ref of dedupedReferenceLines) {
      if (ref.hideLabel) continue;
      const axis = ref.axis ?? "left";
      const y = yFor(ref.value, axis);
      if (!Number.isFinite(y)) continue;
      const [mn, mx] = domainFor(axis);
      const mid = (mn + mx) / 2;
      out.push({
        id: `ref-${axis}-${ref.value}`,
        side: sideForLimit(axis),
        topPct: (y / chartH) * 100,
        text:
          ref.label?.trim() ||
          formatTrendBandEdge(ref.value, unitForAxis(axis)),
        color: usesRight
          ? seriesColorForAxis(axis) ?? ref.color
          : ref.color,
        title: "한계",
        mark: ref.value >= mid ? "overline" : "underline",
      });
    }
    for (const guide of scaleEdgeLabels) {
      if (guide.hideLabel && editingEdgeId !== guide.id) continue;
      const axis = guide.axis ?? "left";
      const y = yFor(guide.value, axis);
      if (!Number.isFinite(y)) continue;
      out.push({
        id: guide.id,
        side: guide.side ?? "right",
        topPct: (y / chartH) * 100,
        text: guide.text,
        leadingText: guide.leadingText,
        color: guide.color,
        title: guide.title ?? guide.text,
        mark: guide.mark,
        draggable: Boolean(guide.draggable),
        editValue: guide.editValue,
        labelLane: guide.labelLane ?? "outer",
        showApplyActions: Boolean(guide.showApplyActions),
        labelIcon: guide.labelIcon,
      });
    }
    return nudgeEdgeLabelTops(
      stackLeftAlarmBaselineLabels(
        mergeOverlappingTempHumEdgeLabels(out, 5.5),
        8.5,
        overlayHoverMerge,
      ),
      5.5,
    );
  }, [
    mode,
    usesRight,
    series,
    uniqueAlarmBands,
    dedupedReferenceLines,
    scaleEdgeLabels,
    leftUnit,
    rightUnit,
    chartH,
    lMin,
    lMax,
    rMin,
    rMax,
    innerH,
    editingEdgeId,
    overlayHoverMerge,
  ]);

  return { alarmPresence, dedupedReferenceLines, edgeBandLabels };
}
