"use client";

import { useEffect, useRef, useState } from "react";
import {
  easeOutCubic,
  isOverlayStagedLayoutTransition,
  lerpSplitYLayout,
  lerpSplitYLayoutStaged,
  splitYLayoutsEqual,
  type SplitYLayout,
} from "@/lib/farm/unified-barn-trend-series";
import { motionDuration } from "@/lib/ui/motion-tokens";

export type UnifiedChartBandHeights = {
  plotPx: number;
  commandPx: number;
};

export type UnifiedChartBandMotion = {
  layout: SplitYLayout;
  heights: UnifiedChartBandHeights;
};

function layoutKey(layout: SplitYLayout): string {
  return [
    layout.motorLo,
    layout.motorHi,
    layout.humLo,
    layout.humHi,
    layout.tempLo,
    layout.tempHi,
  ]
    .map((n) => n.toFixed(3))
    .join(":");
}

function heightsEqual(
  a: UnifiedChartBandHeights,
  b: UnifiedChartBandHeights,
  eps = 0.5,
): boolean {
  return (
    Math.abs(a.plotPx - b.plotPx) < eps &&
    Math.abs(a.commandPx - b.commandPx) < eps
  );
}

function lerpHeights(
  from: UnifiedChartBandHeights,
  to: UnifiedChartBandHeights,
  t: number,
): UnifiedChartBandHeights {
  const u = Math.min(1, Math.max(0, t));
  return {
    plotPx: from.plotPx + (to.plotPx - from.plotPx) * u,
    commandPx: from.commandPx + (to.commandPx - from.commandPx) * u,
  };
}

function motionEqual(
  a: UnifiedChartBandMotion,
  b: UnifiedChartBandMotion,
): boolean {
  return (
    splitYLayoutsEqual(a.layout, b.layout) && heightsEqual(a.heights, b.heights)
  );
}

function lerpMotion(
  from: UnifiedChartBandMotion,
  to: UnifiedChartBandMotion,
  t: number,
  staged: boolean,
): UnifiedChartBandMotion {
  const clamped = Math.min(1, Math.max(0, t));
  if (staged) {
    return {
      layout: lerpSplitYLayoutStaged(from.layout, to.layout, clamped),
      heights: lerpHeights(
        from.heights,
        to.heights,
        easeOutCubic(clamped),
      ),
    };
  }
  const u = easeOutCubic(clamped);
  return {
    layout: lerpSplitYLayout(from.layout, to.layout, u),
    heights: lerpHeights(from.heights, to.heights, u),
  };
}

/**
 * split-Y 밴드 + 플롯/명령 픽셀 높이를 **같은 시계·easing**으로 보간.
 * 레이어 on/off 시 그래프 간 속도 어긋남 방지.
 * 오버레이(습도 슬롯 만남 → 위젯 높이 팽창)는 두 번의 `moderate` 단계.
 */
export function useUnifiedChartBandTransition(
  targetLayout: SplitYLayout,
  targetHeights: UnifiedChartBandHeights,
  durationMs: number = motionDuration.moderate,
): UnifiedChartBandMotion {
  const target: UnifiedChartBandMotion = {
    layout: targetLayout,
    heights: targetHeights,
  };
  const [current, setCurrent] = useState<UnifiedChartBandMotion>(target);
  const currentRef = useRef(current);
  const rafRef = useRef(0);
  const targetKey = `${layoutKey(targetLayout)}|${Math.round(targetHeights.plotPx)}:${Math.round(targetHeights.commandPx)}`;

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    let cancelled = false;
    const nextTarget = target;

    const snap = () => {
      if (cancelled) return;
      currentRef.current = nextTarget;
      setCurrent(nextTarget);
    };

    const start = () => {
      if (cancelled) return;

      if (typeof window === "undefined") {
        snap();
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches;
      if (reduced || durationMs <= 0) {
        snap();
        return;
      }

      if (motionEqual(currentRef.current, nextTarget)) {
        snap();
        return;
      }

      const from = currentRef.current;
      const staged = isOverlayStagedLayoutTransition(
        from.layout,
        nextTarget.layout,
      );
      const runMs = staged ? durationMs * 2 : durationMs;
      const started = performance.now();
      cancelAnimationFrame(rafRef.current);

      const tick = (now: number) => {
        if (cancelled) return;
        const raw = (now - started) / runMs;
        const t = Math.min(1, Math.max(0, raw));
        const eased = lerpMotion(from, nextTarget, t, staged);
        currentRef.current = eased;
        setCurrent(eased);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          currentRef.current = nextTarget;
          setCurrent(nextTarget);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    const boot = requestAnimationFrame(start);

    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
      cancelAnimationFrame(rafRef.current);
    };
    // target object identity changes every render; key drives restart
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targetKey
  }, [targetKey, durationMs]);

  return current;
}

/**
 * split-Y만 보간 (높이 고정 0). 단독 레이아웃 전환용.
 * 차트 패널은 {@link useUnifiedChartBandTransition} 사용.
 */
export function useSplitYLayoutTransition(
  target: SplitYLayout,
  durationMs: number = motionDuration.moderate,
): SplitYLayout {
  const { layout } = useUnifiedChartBandTransition(
    target,
    { plotPx: 0, commandPx: 0 },
    durationMs,
  );
  return layout;
}
