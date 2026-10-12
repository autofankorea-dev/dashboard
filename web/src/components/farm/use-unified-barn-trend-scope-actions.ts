"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { UnifiedBarnTrendSeriesModel } from "@/components/farm/use-unified-barn-trend-series";
import type { PanelXScopeEntry } from "@/components/farm/unified-barn-trend-x-scope";
import {
  chartScopeEntryToZoomHint,
  type ChartTrendZoomHint,
} from "@/lib/farm/farm-chart-scope";
import {
  countSplitYBands,
  domainYFromViewRatio,
  hitSplitYBand,
  resolveYScopeBands,
  type UnifiedYBandId,
} from "@/lib/farm/unified-barn-trend-series";

type ScopeEntry = PanelXScopeEntry;

/**
 * 통합 추세 패널의 X스코프 커밋·팝·초기화.
 * 스택 state와 줌 effect·humanize 캐시는 패널에 남긴다.
 */
export function useUnifiedBarnTrendScopeActions({
  series,
  xScope,
  xScopeStack,
  setXScopeStack,
  bumpScopeMotion,
  onZoomChange,
  comparisonZoom,
}: {
  series: UnifiedBarnTrendSeriesModel;
  xScope: PanelXScopeEntry | null;
  xScopeStack: PanelXScopeEntry[];
  setXScopeStack: Dispatch<SetStateAction<PanelXScopeEntry[]>>;
  bumpScopeMotion: (dir: "in" | "out") => void;
  onZoomChange?: (zoom: ChartTrendZoomHint | null) => void;
  comparisonZoom: ChartTrendZoomHint | null | undefined;
}) {
  const { picked, built, layerVisibility, layerLayout, overlayActive } = series;

  const emitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      if (!onZoomChange) return;
      const n = picked?.categories.length ?? 0;
      if (comparisonZoom !== undefined && entry && n > 1) {
        // Transfer the common time window without per-panel absolute indices.
        onZoomChange({ yBands: entry.yBands ?? [], startRatio: entry.start / (n - 1), endRatio: entry.end / (n - 1) });
      } else {
        onZoomChange(chartScopeEntryToZoomHint(entry, n));
      }
    },
    [onZoomChange, picked?.categories.length, comparisonZoom],
  );

  /** 부모 URL 동기화 — 렌더/updater 중 setState 금지 */
  const deferEmitZoom = useCallback(
    (entry: ScopeEntry | null) => {
      queueMicrotask(() => emitZoom(entry));
    },
    [emitZoom],
  );

  const commitXScope = (
    range: {
      start: number;
      end: number;
      yStartRatio: number;
      yEndRatio: number;
    },
    mode: "push" | "replace" = "push",
    opts?: { timeOnly?: boolean },
  ) => {
    if (!picked) return;
    const domain = built?.leftDomain ?? ([0, 100] as [number, number]);
    const timeOnly = Boolean(opts?.timeOnly);
    const domainY0 = domainYFromViewRatio(range.yStartRatio, domain);
    const domainY1 = domainYFromViewRatio(range.yEndRatio, domain);
    const multiPlot = countSplitYBands(layerVisibility) > 1;
    const detected =
      timeOnly || mode === "replace" || xScope?.yBands != null
        ? null
        : multiPlot
          ? resolveYScopeBands(domainY0, domainY1, layerLayout, layerVisibility)
          : null;
    let yBands: UnifiedYBandId[] | null =
      mode === "replace"
        ? ((overlayActive ? ["overlay"] : ["temp"]) as UnifiedYBandId[])
        : (xScope?.yBands ?? detected);
    if (timeOnly) {
      yBands = xScope?.yBands ?? null;
    } else if (mode !== "replace" && xScope?.yBands == null) {
      if (detected == null && multiPlot) {
        const centerY = (domainY0 + domainY1) / 2;
        const hit = hitSplitYBand(centerY, layerLayout, layerVisibility);
        if (hit === "overlay") {
          if (layerVisibility.showHum) yBands = ["overlay"];
        } else if (hit === "temp") yBands = ["temp"];
        else if (hit === "hum") yBands = ["hum"];
        else if (hit === "motor") yBands = ["motor"];
      }
    }
    if (yBands?.includes("command")) {
      yBands = yBands.filter((b) => b !== "command");
      if (yBands.length === 0) yBands = null;
    }
    /** replace=가이드 시연 — 전체 축 절대 인덱스(중첩 금지) */
    const next: ScopeEntry = {
      start:
        mode === "replace" || xScope == null
          ? range.start
          : xScope.start + range.start,
      end:
        mode === "replace" || xScope == null
          ? range.end
          : xScope.start + range.end,
      yBands,
    };
    if (mode === "replace") {
      setXScopeStack([next]);
    } else {
      setXScopeStack((stack) => [...stack, next]);
    }
    bumpScopeMotion("in");
    deferEmitZoom(next);
  };

  const popXScope = useCallback(() => {
    if (xScopeStack.length === 0) return;
    const nextStack = xScopeStack.slice(0, -1);
    const entry = nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null;
    setXScopeStack(nextStack);
    bumpScopeMotion(xScopeStack.length <= 1 ? "out" : "in");
    deferEmitZoom(entry);
  }, [xScopeStack, bumpScopeMotion, deferEmitZoom, setXScopeStack]);

  const clearXScope = () => {
    if (xScopeStack.length > 0) bumpScopeMotion("out");
    setXScopeStack([]);
    deferEmitZoom(null);
  };

  return { commitXScope, popXScope, clearXScope };
}
