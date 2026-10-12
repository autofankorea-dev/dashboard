"use client";

import { useMemo } from "react";
import {
  buildTrendAxisMarks,
  trendChartTickTargetForWidth,
} from "@/lib/farm/trend-display-buckets";
import { TREND_Y_LABEL_CHIP_SAMPLE } from "@/lib/farm/trend-chart-format";
import { buildAxisTickViews } from "@/lib/farm/trend-chart-layout";
import { usePresenceValue } from "@/lib/ui/use-clip-presence";
import { resolveTrendHoverCardLive } from "./trend-chart-hover-live";
import { useTrendEdgeBandLabels } from "./use-trend-edge-band-labels";
import { useTrendChartModel } from "./use-trend-chart-model";
import { useTrendScopeGesture } from "./use-trend-scope-gesture";
import { useTrendScaleEdgeEdit } from "./use-trend-scale-edge-edit";

type DecorDeps = ReturnType<typeof useTrendChartModel> &
  Pick<ReturnType<typeof useTrendScaleEdgeEdit>, "edgeEdit"> &
  Pick<ReturnType<typeof useTrendScopeGesture>, "xDraft">;

/**
 * 축 눈금·기준선 칩·호버 카드 presence.
 * TrendChart에서 분리(동작 보존).
 */
export function useTrendChartDecor(deps: DecorDeps) {
  const {
    labelGutter,
    plotPx,
    categories,
    period,
    padL,
    innerW,
    viewW,
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
    lMin,
    lMax,
    rMin,
    rMax,
    edgeEdit,
    overlayHoverMerge,
    clipWipeEnabled,
    hoveredEdgeId,
    xDraft,
    hoverEventMark,
    pinnedTips,
    hoverIdx,
    n,
    hoverSeries,
    plotHovering,
    pinPresence,
  } = deps;

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

  const hoverCardLive = useMemo(
    () =>
      resolveTrendHoverCardLive({
        hoverEventMark,
        pinnedTips,
        hoverIdx,
        n,
        hoverSeries,
        overlayHoverMerge,
      }),
    [
      hoverEventMark,
      pinnedTips,
      hoverIdx,
      n,
      hoverSeries,
      overlayHoverMerge,
    ],
  );
  const hoverCardPresence = usePresenceValue(hoverCardLive);

  /** 플롯 위를 보는 중이면 기준 칩을 낮춤. 칩 호버는 제외 */
  const dimPlotValues =
    hoveredEdgeId == null &&
    (plotHovering || pinPresence.length > 0);

  const edgeValueMaxCh = edgeBandLabels.reduce(
    (max, label) => Math.max(max, label.text.length),
    TREND_Y_LABEL_CHIP_SAMPLE.length,
  );

  return {
    axisMarks,
    axisTicks,
    axisTickViews,
    alarmPresence,
    dedupedReferenceLines,
    edgeBandLabels,
    hoveredEdgePresence,
    draftPresence,
    hoverCardPresence,
    dimPlotValues,
    edgeValueMaxCh,
  };
}
