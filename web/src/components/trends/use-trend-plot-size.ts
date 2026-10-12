"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * 플롯 컨테이너 실측 크기(px) 추적.
 *
 * - `plotRef`: 플롯 div에 부착 (JSX 그대로)
 * - `plotPx`: `{ w, h }` — 0.5px 미만 변동은 무시해 리렌더 억제
 * - `fillParent`가 아니면 100ms 디바운스, 4px 이상 폭 변화 시 `onPlotWidthChange` 통지
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendPlotSize(opts: {
  fillParent: boolean;
  height: number;
  categoriesLength: number;
  seriesLength: number;
  onPlotWidthChange?: (widthPx: number) => void;
}) {
  const { fillParent, height, categoriesLength, seriesLength, onPlotWidthChange } =
    opts;
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [plotPx, setPlotPx] = useState({ w: 1, h: 1 });
  const plotWidthNotifyRef = useRef(0);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let tid = 0;
    const apply = (size?: { width: number; height: number }) => {
      const run = () => {
        // SVG coordinates use layout pixels. Ancestor expand transforms affect
        // getBoundingClientRect(), but must not affect the viewBox or dot size.
        const rect = size ?? { width: el.clientWidth, height: el.clientHeight };
        if (rect.width > 0 && rect.height > 0) {
          setPlotPx((prev) =>
            Math.abs(prev.w - rect.width) < 0.5 &&
            Math.abs(prev.h - rect.height) < 0.5
              ? prev
              : { w: rect.width, h: rect.height },
          );
          if (Math.abs(plotWidthNotifyRef.current - rect.width) >= 4) {
            plotWidthNotifyRef.current = rect.width;
            onPlotWidthChange?.(rect.width);
          }
        }
      };
      if (fillParent) {
        run();
        return;
      }
      window.clearTimeout(tid);
      tid = window.setTimeout(run, 100);
    };
    apply();
    const ro = new ResizeObserver((entries) => {
      const entry = entries.find((item) => item.target === el);
      if (entry) apply(entry.contentRect);
    });
    ro.observe(el);
    return () => {
      window.clearTimeout(tid);
      ro.disconnect();
    };
  }, [fillParent, height, categoriesLength, seriesLength, onPlotWidthChange]);

  return { plotRef, plotPx };
}
