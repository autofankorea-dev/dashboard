/**
 * 통합 추세 패널의 X 스코프 순수 계산.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존).
 * 스택 setState와 제스처 재생은 패널에 남긴다.
 */
import {
  bucketAtsRangeMs,
  mapIndexWindowToSlice,
} from "@/components/farm/unified-barn-trend-panel-helpers";
import {
  TREND_PERIODS,
  TREND_ZOOM_15M_MAX_DAYS,
} from "@/lib/domain/farm-trend-types";
import type { ChartTrendZoomHint } from "@/lib/farm/farm-chart-scope";
import type { UnifiedYBandId } from "@/lib/farm/unified-barn-trend-layout";

export type PanelXScopeEntry = {
  start: number;
  end: number;
  /** null = Y필터 없음 · ["temp","hum"] = 걸린 밴드만 */
  yBands: UnifiedYBandId[] | null;
};

/** 데이터 길이/인덱스 불일치 — 스택을 비울 조건 */
export function xScopeEntryOutOfRange(
  categoryCount: number,
  scope: { start: number; end: number },
): boolean {
  return (
    categoryCount < 2 ||
    scope.start < 0 ||
    scope.end >= categoryCount ||
    scope.start > scope.end ||
    scope.end - scope.start < 2
  );
}

/** URL 힌트·비교 줌 → 카테고리 인덱스 스코프. 구간이 너무 짧으면 null. */
export function scopeEntryFromZoomHint(
  categoryCount: number,
  zoom: ChartTrendZoomHint,
): PanelXScopeEntry | null {
  const n = categoryCount;
  if (n < 3) return null;
  let start: number;
  let end: number;
  if (
    zoom.startIndex != null &&
    zoom.endIndex != null &&
    Number.isFinite(zoom.startIndex) &&
    Number.isFinite(zoom.endIndex)
  ) {
    start = Math.max(
      0,
      Math.min(n - 1, Math.round(Math.min(zoom.startIndex, zoom.endIndex))),
    );
    end = Math.max(
      0,
      Math.min(n - 1, Math.round(Math.max(zoom.startIndex, zoom.endIndex))),
    );
  } else {
    const i0 = Math.round(zoom.startRatio * (n - 1));
    const i1 = Math.round(zoom.endRatio * (n - 1));
    start = Math.max(0, Math.min(i0, i1));
    end = Math.min(n - 1, Math.max(i0, i1));
  }
  if (end - start < 2) {
    if (end < n - 1) end = Math.min(n - 1, start + 2);
    else start = Math.max(0, end - 2);
  }
  if (end - start < 2) return null;
  const measureBands = zoom.yBands.filter((b) => b !== "command");
  return {
    start,
    end,
    yBands: measureBands.length ? (measureBands as UnifiedYBandId[]) : null,
  };
}

/** 스코프 인덱스 → 15분 창 요청 구간. 개요·과대 구간은 null. */
export function resolveXScopeRangeMs(input: {
  overview: boolean;
  scope: { start: number; end: number } | null;
  categoryCount: number;
  bucketAts: string[] | null | undefined;
}): { fromMs: number; toMs: number } | null {
  const { overview, scope, categoryCount, bucketAts } = input;
  if (overview || !scope || !bucketAts) return null;
  const slice = mapIndexWindowToSlice(
    categoryCount,
    scope.start,
    scope.end,
    bucketAts.length,
  );
  const range = bucketAtsRangeMs(bucketAts, slice.from, slice.to);
  if (!range) return null;
  const maxMs = TREND_ZOOM_15M_MAX_DAYS * TREND_PERIODS["24h"].durationMs;
  if (range.toMs - range.fromMs > maxMs + 1) return null;
  return range;
}
