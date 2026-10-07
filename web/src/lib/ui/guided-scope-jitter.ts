/**
 * 차트 가이드 스코프 — 사람처럼 “적당한” 구간이 되도록
 * 기준 초과 구간에 X/Y 소량 오차·여유를 준다.
 */

export type GuidedScopeRect = {
  startRatio: number;
  endRatio: number;
  yStartRatio: number;
  yEndRatio: number;
  durationMs?: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** [-amp, +amp] 균등 */
function jitter(amp: number, rand: () => number): number {
  return (rand() * 2 - 1) * amp;
}

/**
 * 기준 직사각형에 사람처럼 소량 변동을 주되,
 * X는 기준 구간 **밖으로 확장하지 않음** (인접 정상 봉이 끌려오지 않게).
 * 안쪽으로만 살짝 줄이거나 창 안에서 이동.
 */
export function humanizeGuidedScopeRect(
  base: GuidedScopeRect,
  rand: () => number = Math.random,
): GuidedScopeRect {
  const xA = Math.min(base.startRatio, base.endRatio);
  const xB = Math.max(base.startRatio, base.endRatio);
  const yA = Math.min(base.yStartRatio, base.yEndRatio);
  const yB = Math.max(base.yStartRatio, base.yEndRatio);
  const spanX = Math.max(xB - xA, 0.06);
  const spanY = Math.max(yB - yA, 0.05);

  /** X: 창 안 이동 + 안쪽 수축만 (외측 확장 금지) */
  const shiftX = jitter(Math.min(0.015, spanX * 0.1), rand);
  const shrinkL = rand() * Math.min(0.018, spanX * 0.08);
  const shrinkR = rand() * Math.min(0.018, spanX * 0.08);
  let nx0 = xA + shrinkL + shiftX;
  let nx1 = xB - shrinkR + shiftX;
  nx0 = clamp(nx0, xA, Math.max(xA, xB - 0.06));
  nx1 = clamp(nx1, Math.min(xB, nx0 + 0.06), xB);
  if (nx1 - nx0 < 0.06) {
    nx0 = xA;
    nx1 = Math.min(1, xA + Math.max(0.06, spanX));
    nx1 = Math.min(nx1, xB);
  }

  /** Y: ±소량 (온도 레인 안) */
  const shiftY = jitter(Math.min(0.025, spanY * 0.22), rand);
  const padY = Math.abs(jitter(Math.min(0.03, spanY * 0.18), rand));
  let ny0 = yA + shiftY - padY * 0.35;
  let ny1 = yB + shiftY + padY * 0.35;
  ny0 = clamp(ny0, 0, 0.9);
  ny1 = clamp(ny1, ny0 + 0.05, 1);

  const durationMs =
    base.durationMs == null
      ? undefined
      : Math.round(base.durationMs * (0.9 + rand() * 0.2));

  return {
    startRatio: nx0,
    endRatio: nx1,
    yStartRatio: ny0,
    yEndRatio: ny1,
    durationMs,
  };
}
