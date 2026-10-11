"use client";

import { useEffect, useRef } from "react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import type { BarnGraphExpanded } from "@/components/farm/use-barn-graphs";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";

type Options = {
  barns: BarnMapSnapshot[];
  metricIdsByBarnId: Map<string, string[]>;
  setExpanded: (expanded: BarnGraphExpanded | null) => void;
};

/** 스포트라이트 투어 — 그리드 확대 상세 열기/닫기 (canvas·mobile 공용). */
export function useFarmTourGridAction({
  barns,
  metricIdsByBarnId,
  setExpanded,
}: Options): void {
  const barnsRef = useRef(barns);
  useEffect(() => {
    barnsRef.current = barns;
  });

  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent).detail?.action as string | undefined;
      if (action === "collapse") {
        setExpanded(null);
        // 상세 unmount·레이아웃 안정 후 done — 2 rAF만으로는 7번 탭 포착이 빗나감.
        void (async () => {
          await afterFrames(2);
          await waitForTourTarget([
            '[data-tour-id="barn-card"]',
            '[data-tour-id="view-toggle"]',
          ]);
          dispatchTourGridActionDone("collapse");
        })();
        return;
      }
      if (action === "expand-first") {
        const first = barnsRef.current.find(
          (b) => (metricIdsByBarnId.get(b.meta.id)?.length ?? 0) > 0,
        );
        const ids = first ? metricIdsByBarnId.get(first.meta.id) : undefined;
        if (first && ids?.[0]) {
          setExpanded({ barnId: first.meta.id, metricId: ids[0] });
          // morph(opacity 0→1) 후 헤더 present까지 대기 — 2 rAF만으로는 레이스.
          void (async () => {
            await afterFrames(2);
            await waitForTourTarget([
              '[data-tour-id="detail-panel-header"]',
              '[data-tour-id="detail-panel"]',
            ]);
            dispatchTourGridActionDone("expand-first");
          })();
        } else {
          dispatchTourGridActionDone("expand-first");
        }
      }
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () => window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, [metricIdsByBarnId, setExpanded]);
}
