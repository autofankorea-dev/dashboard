/**
 * 추이 차트 데이터 지점 히트.
 *
 * `trend-chart.tsx`에서 분리(동작 보존).
 * 클라이언트 좌표 → 뷰 좌표 변환과 포인터 핸들러는 플롯 루트에 남긴다.
 */
import type {
  TrendAxis,
  TrendEventMark,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { inferHoverMetricGroup } from "@/lib/farm/trend-chart-format";
import type { PositionedEventMark } from "@/lib/farm/trend-chart-layout";
import { hoverPairSlotDx, nearestByXView } from "./trend-chart-interaction";

export type TrendDataPointHit = {
  idx: number;
  xView: number;
  yView: number;
  seriesKey: string;
  eventMark?: TrendEventMark;
};

type HitCandidate = {
  idx: number;
  xView: number;
  yView: number;
  seriesKey: string;
};

/**
 * 표시 데이터 지점(시리즈 샘플 · 막대 · 히스토그램 끝)에만 히트.
 * 빈 플롯 영역 X스냅은 하지 않음.
 */
export function findTrendDataPointHit(input: {
  xPx: number;
  yPx: number;
  plotW: number;
  plotH: number;
  markerRadiusPx: number;
  eventLane: boolean;
  eventLaneH: number;
  eventLaneTop: number;
  chartH: number;
  innerW: number;
  innerH: number;
  n: number;
  viewW: number;
  mode: "line" | "bar";
  series: readonly TrendSeries[];
  histograms: readonly TrendHistogram[];
  barW: number;
  barSlotW: number;
  padTop: number;
  yFor: (value: number, axis: TrendAxis) => number;
  xFor: (i: number) => number;
  xForBar: (i: number) => number;
  xAtIndex: (i: number) => number;
  markerRy: (rPx: number) => number;
  positionedEventMarks: readonly PositionedEventMark[];
}): TrendDataPointHit | null {
  const {
    xPx,
    yPx,
    plotW,
    plotH,
    markerRadiusPx,
    eventLane,
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
    padTop,
    yFor,
    xFor,
    xForBar,
    xAtIndex,
    markerRy,
    positionedEventMarks,
  } = input;
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
  let best: HitCandidate | null = null;

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
        const baseY = padTop + innerH;
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
    const slot = n > 1 ? innerW / (n - 1) : innerW;
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
      isVolume && gs > 1 ? (gi - (gs - 1) / 2) * (barWHist + 0.12) : 0;
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
        best = {
          idx: i,
          xView: gx + barWHist / 2,
          yView: tipY,
          seriesKey: key,
        };
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
  let markerHit: HitCandidate | null = null;
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
    let picked: HitCandidate | null = null;
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
}
