"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PinnedTip } from "./trend-chart-interaction";

/**
 * 고정(핀) 데이터 카드 상태를 캡슐화한다.
 *
 * - `pinnedTips` / `setPinnedTips`: 다중 고정 카드 목록 (추가·삭제는 호출측 핸들러에서)
 * - `bringPinToFront`: 카드 클릭 시 z-순서 맨 앞으로
 * - `chartRootRef`: 차트 루트. 외부 클릭 시 전체 해제 이펙트가 사용 (JSX에 그대로 부착)
 * - `resetKey` 변경(기간·데이터 교체) 시 고정 카드 초기화
 *
 * trend-chart.tsx 내부 로직을 동작 변경 없이 1:1 이동.
 */
export function useTrendPinnedTips(opts: { resetKey: string }) {
  const { resetKey } = opts;
  const chartRootRef = useRef<HTMLDivElement | null>(null);
  const [pinnedTips, setPinnedTips] = useState<PinnedTip[]>([]);

  const bringPinToFront = useCallback((id: string) => {
    setPinnedTips((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      if (i < 0 || i === prev.length - 1) return prev;
      const next = prev.slice();
      const [item] = next.splice(i, 1);
      if (!item) return prev;
      next.push(item);
      return next;
    });
  }, []);

  // 기간·데이터 바뀌면 고정 카드 초기화 (layout — 렌더 중 setState 금지)
  const resetKeyRef = useRef(resetKey);
  useLayoutEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    setPinnedTips([]);
  }, [resetKey]);

  // 차트 밖 클릭 — 고정 데이터 카드 전부 해제
  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const root = chartRootRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Node && root.contains(t)) return;
      setPinnedTips((prev) => (prev.length ? [] : prev));
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, []);

  return { pinnedTips, setPinnedTips, bringPinToFront, chartRootRef };
}
