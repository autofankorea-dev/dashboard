/**
 * 추이 차트 호버 카드에 올릴 값.
 *
 * `trend-chart.tsx`에서 분리(동작 보존). 카드 위치와 presence는 차트에 남긴다.
 */
import type { TrendEventMark } from "@/lib/domain/trend-chart-types";
import {
  inferHoverMetricGroup,
  isOverlayMergedHoverGroup,
} from "@/lib/farm/trend-chart-format";
import { tipPinId } from "@/lib/farm/trend-chart-geometry";
import type { PinnedTip } from "./trend-chart-interaction";

export type TrendHoverCardValue =
  | { kind: "event"; mark: TrendEventMark }
  | { kind: "point"; idx: number; seriesKey: string };

export function resolveTrendHoverCardLive(input: {
  hoverEventMark: TrendEventMark | null;
  pinnedTips: readonly PinnedTip[];
  hoverIdx: number | null;
  n: number;
  hoverSeries: string | null;
  overlayHoverMerge: boolean;
}): TrendHoverCardValue | null {
  const {
    hoverEventMark,
    pinnedTips,
    hoverIdx,
    n,
    hoverSeries,
    overlayHoverMerge,
  } = input;
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
  if (hoverEventVisible && hoverEventMark) {
    return { kind: "event", mark: hoverEventMark };
  }
  if (hoverPointVisible && hoverIdx != null && hoverSeries) {
    return { kind: "point", idx: hoverIdx, seriesKey: hoverSeries };
  }
  return null;
}
