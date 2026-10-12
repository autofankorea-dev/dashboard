"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { TrendEventMark } from "@/lib/domain/trend-chart-types";
import { computeTipPlacement } from "@/lib/farm/trend-chart-geometry";

/**
 * 호버 인덱스·시리즈·이벤트와 호버 카드 배치.
 * clearHover는 십자선 숨김이 필요해 TrendChart에 둔다.
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendHover() {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);
  const [hoverEventMark, setHoverEventMark] = useState<TrendEventMark | null>(
    null,
  );
  const [plotHovering, setPlotHovering] = useState(false);
  const hoverIdxRef = useRef<number | null>(null);
  const hoverSeriesRef = useRef<string | null>(null);
  const hoverEventMarkRef = useRef<TrendEventMark | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = useRef({ x: 0, y: 0, w: 1, h: 1 });

  /** 데이터 점 근처 · 플롯 안 · 포인터/점을 가리지 않게 카드 배치 */
  const placeTipNear = (
    anchorX: number,
    anchorY: number,
    plotW: number,
    plotH: number,
  ) => {
    const el = tipRef.current;
    if (!el) return;
    const tipW = el.offsetWidth || 168;
    const tipH = el.offsetHeight || 72;
    const { left, top } = computeTipPlacement(
      anchorX,
      anchorY,
      plotW,
      plotH,
      tipW,
      tipH,
    );
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.opacity = "1";
  };

  useLayoutEffect(() => {
    if (hoverIdx == null && !hoverEventMark) return;
    const a = lastAnchorRef.current;
    placeTipNear(a.x, a.y, a.w, a.h);
  }, [hoverIdx, hoverEventMark]);

  return {
    hoverIdx,
    setHoverIdx,
    hoverSeries,
    setHoverSeries,
    hoverEventMark,
    setHoverEventMark,
    plotHovering,
    setPlotHovering,
    hoverIdxRef,
    hoverSeriesRef,
    hoverEventMarkRef,
    tipRef,
    lastAnchorRef,
    placeTipNear,
  };
}
