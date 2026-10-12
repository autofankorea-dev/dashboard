/**
 * 꺾인 축 위칸의 이탈 스케일.
 *
 * `unified-trend-split-y.ts`에서 분리(동작 보존).
 * 값↔밴드 매핑은 그대로 두고, 실측 min–max 맞춤만 여기 둔다.
 */
import {
  OVERFLOW_FIT_MIN_PAD_C,
  OVERFLOW_FIT_PAD_RATIO,
  tempBrokenLinearEdge,
} from "./unified-trend-split-y";

/** 기준(선형) 밖 실측 min–max + 여유. 위칸만 이 폭으로 채움. */
export function fitOverflowValueDomain(
  min: number,
  max: number,
): [number, number] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = Math.max(hi - lo, OVERFLOW_FIT_MIN_PAD_C * 2);
  const pad = Math.max(OVERFLOW_FIT_MIN_PAD_C, span * OVERFLOW_FIT_PAD_RATIO);
  return [lo - pad, hi + pad];
}

export function overflowExtentAbove(
  columns: readonly (readonly (number | null | undefined)[])[],
  linearHi: number,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const col of columns) {
    for (const v of col) {
      if (v == null || !Number.isFinite(v) || !(v > linearHi)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function resolveTempOverflowFitDomain(
  tempLow: number,
  tempHigh: number,
  columns: readonly (readonly (number | null | undefined)[])[],
): [number, number] | null {
  const [, linearHi] = tempBrokenLinearEdge(tempLow, tempHigh);
  const ext = overflowExtentAbove(columns, linearHi);
  if (!ext) return null;
  return fitOverflowValueDomain(ext.min, ext.max);
}

/** 온도 실측 열. 집계 타입에 묶지 않아 모듈 순환을 피한다. */
export function tempRawOverflowColumns(raw: {
  tempAvg: readonly (number | null | undefined)[];
  tempMin: readonly (number | null | undefined)[];
  tempMax: readonly (number | null | undefined)[];
  emaShortRaw: readonly (number | null | undefined)[];
  emaLongRaw: readonly (number | null | undefined)[];
}): (readonly (number | null | undefined)[])[] {
  return [
    raw.tempAvg,
    raw.tempMin,
    raw.tempMax,
    raw.emaShortRaw,
    raw.emaLongRaw,
  ];
}
