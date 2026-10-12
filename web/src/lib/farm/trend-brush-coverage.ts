import { TREND_ZOOM_15M_MAX_DAYS } from "@/lib/domain/farm-trend-types";

/** 30일 브러시 창 (0~1). 차트 컴포넌트 BrushWindow와 동일. */
export type TrendBrushWindow = { start: number; width: number };

/** 30일 트랙에서 최근 7일이 시작하는 비율 */
export const TREND_BRUSH_LOADED_7D_START = 1 - 7 / 30;

const WINDOW_15M_STRIDE_MS = 15 * 60 * 1000;

/** 브러시 창이 이미 받은 7일 안에 들어가는지. */
export function brushWindowCoveredBy7d(win: TrendBrushWindow): boolean {
  return win.start + 1e-6 >= TREND_BRUSH_LOADED_7D_START;
}

/** 창 × 30일 ≤ 48시간이면 구간 15분을 요청. */
export function brushWindowNeeds15m(win: TrendBrushWindow): boolean {
  return win.width * 30 <= TREND_ZOOM_15M_MAX_DAYS + 1e-9;
}

export function brushWindowToRangeMs(
  win: TrendBrushWindow,
  periodFromMs: number,
  durationMs: number,
): { fromMs: number; toMs: number } {
  return {
    fromMs: periodFromMs + win.start * durationMs,
    toMs: periodFromMs + (win.start + win.width) * durationMs,
  };
}

export function alignTrendWindow15m(
  fromMs: number,
  toMs: number,
): { fromMs: number; toMs: number } {
  const alignedFrom =
    Math.floor(fromMs / WINDOW_15M_STRIDE_MS) * WINDOW_15M_STRIDE_MS;
  let alignedTo = Math.ceil(toMs / WINDOW_15M_STRIDE_MS) * WINDOW_15M_STRIDE_MS;
  if (alignedTo <= alignedFrom) {
    alignedTo = alignedFrom + WINDOW_15M_STRIDE_MS * 2;
  }
  return { fromMs: alignedFrom, toMs: alignedTo };
}

export function window15mCovers(
  snap: { fromMs: number; toMs: number } | null | undefined,
  fromMs: number,
  toMs: number,
): boolean {
  if (!snap) return false;
  return snap.fromMs <= fromMs + 1 && snap.toMs >= toMs - 1;
}

/** 7일 축 위로 30일 브러시 창을 투영 (창은 최근 7일 안에 있어야 함). */
export function mapBrushWindowOnto7d(
  win: TrendBrushWindow,
  length7d: number,
): { from: number; to: number } {
  const span = 7 / 30;
  const localStart = (win.start - TREND_BRUSH_LOADED_7D_START) / span;
  const localEnd = (win.start + win.width - TREND_BRUSH_LOADED_7D_START) / span;
  const from = Math.max(
    0,
    Math.min(length7d - 2, Math.floor(localStart * length7d)),
  );
  const to = Math.max(
    from + 2,
    Math.min(length7d, Math.ceil(localEnd * length7d)),
  );
  return { from, to };
}
