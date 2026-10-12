"use client";

import { useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  TrendAxis,
  TrendEventLane,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import type { PinnedTip } from "./trend-chart-interaction";

/**
 * 윈도우(줌) 도메인이 바뀌면 고정 카드를 재배치한다 (layout — 렌더 중 setState 금지).
 * - 새 구간 밖(atMs 범위 밖) → 닫기
 * - 새 구간 안 → 새 도메인 기준으로 앵커(nx/ny/idx) 재계산 (드래그 오프셋 초기화)
 *
 * `winSig`가 바뀐 렌더의 기하(xForMs·xAtIndex·yFor 클로저)를 그대로 쓴다.
 * series identity를 dep에 넣으면 재진입 루프가 나므로 트리거는 `winSig` 하나뿐이다.
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendPinWindowRemap(opts: {
  mode: "line" | "bar";
  n: number;
  timeAxisMs: number[] | null;
  series: TrendSeries[];
  histograms: TrendHistogram[];
  eventLane: TrendEventLane | null;
  eventLaneH: number;
  eventLaneTop: number;
  chartH: number;
  viewW: number;
  xForMs: (ms: number) => number | null;
  xAtIndex: (i: number) => number;
  yFor: (value: number, axis: TrendAxis) => number;
  setPinnedTips: Dispatch<SetStateAction<PinnedTip[]>>;
}) {
  const {
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
  } = opts;

  const winSig =
    mode === "bar" || !timeAxisMs || timeAxisMs.length !== n || n < 1
      ? ""
      : `${timeAxisMs[0]}|${timeAxisMs[n - 1]}|${n}`;
  const winSigSeenRef = useRef(winSig);
  useLayoutEffect(() => {
    if (winSigSeenRef.current === winSig) return;
    winSigSeenRef.current = winSig;
    setPinnedTips((prev) => {
      if (prev.length === 0) return prev;
      if (winSig === "" || !timeAxisMs) return prev;
      const tLo = Math.min(timeAxisMs[0]!, timeAxisMs[n - 1]!);
      const tHi = Math.max(timeAxisMs[0]!, timeAxisMs[n - 1]!);
      const remapPinToWindow = (p: PinnedTip): PinnedTip | null => {
        if (p.atMs == null) return p;
        if (p.atMs < tLo || p.atMs > tHi) return null;
        let bestIdx = 0;
        let bestD = Infinity;
        for (let i = 0; i < n; i++) {
          const ti = timeAxisMs[i];
          if (ti == null) continue;
          const d = Math.abs(ti - p.atMs);
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        if (p.eventMark) {
          const xView = xForMs(p.atMs);
          if (xView == null) return null;
          const rows = eventLane ? Math.max(1, eventLane.rowLabels.length) : 1;
          const row = Math.min(rows - 1, Math.max(0, p.eventMark.row));
          const yView =
            eventLaneH > 0
              ? eventLaneTop + ((row + 0.5) / rows) * eventLaneH
              : p.ny * chartH;
          return {
            ...p,
            idx: 0,
            nx: xView / viewW,
            ny: yView / chartH,
            ox: 0,
            oy: 0,
          };
        }
        const s = series.find((x) => x.name === p.seriesKey);
        if (s) {
          const v = s.data[bestIdx];
          if (v == null || !Number.isFinite(v)) return null;
          return {
            ...p,
            idx: bestIdx,
            nx: xAtIndex(bestIdx) / viewW,
            ny: yFor(v, s.axis ?? "left") / chartH,
            ox: 0,
            oy: 0,
          };
        }
        const hi = histograms.findIndex(
          (h, i) => (h.legendLabel ?? `hist-${i}`) === p.seriesKey,
        );
        if (hi >= 0) {
          const h = histograms[hi]!;
          const v = h.values[bestIdx];
          if (v == null || !Number.isFinite(v)) return null;
          return {
            ...p,
            idx: bestIdx,
            nx: xAtIndex(bestIdx) / viewW,
            ny: yFor(v, "left") / chartH,
            ox: 0,
            oy: 0,
          };
        }
        return { ...p, idx: bestIdx, nx: xAtIndex(bestIdx) / viewW, ox: 0, oy: 0 };
      };
      const out: PinnedTip[] = [];
      for (const p of prev) {
        const r = remapPinToWindow(p);
        if (r) out.push(r);
      }
      return out;
    });
    // winSig가 바뀐 렌더의 기하를 쓴다. series identity를 dep에 넣으면 재진입 루프가 난다.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- winSig is the window trigger
  }, [winSig]);
}
