import type { AlarmThresholds } from "@/lib/domain/alarms";

/**
 * 구간 내 연속 양호도 (B안).
 * 중심=100 · 경계≈60 · 이탈 시 half-width 추가 구간에서 0으로 감점.
 */
export function dimensionComfortScore(
  value: number,
  low: number,
  high: number,
): number | null {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(low) ||
    !Number.isFinite(high) ||
    high <= low
  ) {
    return null;
  }
  const mid = (low + high) / 2;
  const half = (high - low) / 2;
  const dist = Math.abs(value - mid);
  if (dist <= half) {
    return 100 - 40 * (dist / half);
  }
  const over = dist - half;
  return Math.max(0, 60 * (1 - over / half));
}

/** 온도·습도 점수 평균. 한쪽만 있으면 그 값. 모터 제외. */
export function envComfortScore(
  tempC: number | null | undefined,
  humidityPct: number | null | undefined,
  thresholds: AlarmThresholds,
): number | null {
  const scores: number[] = [];
  if (tempC != null && Number.isFinite(tempC)) {
    const s = dimensionComfortScore(
      tempC,
      thresholds.tempLow,
      thresholds.tempHigh,
    );
    if (s != null) scores.push(s);
  }
  if (humidityPct != null && Number.isFinite(humidityPct)) {
    const s = dimensionComfortScore(
      humidityPct,
      thresholds.humidityLow,
      thresholds.humidityHigh,
    );
    if (s != null) scores.push(s);
  }
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** 점수 → 브러시 막대 색 (양호→주의→불량). 히트맵·덮개와 같은 상태 토큰. */
export function comfortScoreToColor(score: number): string {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 45) {
    const t = Math.round(((s - 45) / 55) * 100);
    return `color-mix(in oklch, var(--status-ok) ${t}%, var(--status-warn))`;
  }
  const t = Math.round((s / 45) * 100);
  return `color-mix(in oklch, var(--status-warn) ${t}%, var(--status-danger))`;
}

/** 브러시·팝업용 구간 라벨 (색 임계와 동일) */
export function comfortScoreBandLabel(
  score: number,
): "양호" | "주의" | "이탈" {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 75) return "양호";
  if (s >= 45) return "주의";
  return "이탈";
}

/** 아래칸 − 위칸. 이 이내면 비슷. */
export const COMFORT_DELTA_NEAR = 8;

/** 양호도 차이 막대 색. 양수=아래칸이 더 양호. */
export function comfortDeltaToColor(delta: number): string {
  const d = Math.max(-100, Math.min(100, delta));
  if (d >= COMFORT_DELTA_NEAR) {
    const t = Math.round(
      ((d - COMFORT_DELTA_NEAR) / (100 - COMFORT_DELTA_NEAR)) * 100,
    );
    return `color-mix(in oklch, var(--status-ok) ${t}%, var(--status-warn))`;
  }
  if (d <= -COMFORT_DELTA_NEAR) {
    const t = Math.round(
      ((Math.abs(d) - COMFORT_DELTA_NEAR) / (100 - COMFORT_DELTA_NEAR)) * 100,
    );
    return `color-mix(in oklch, var(--status-danger) ${t}%, var(--status-warn))`;
  }
  return "var(--status-warn)";
}

export function comfortDeltaBandLabel(
  delta: number,
): "아래칸이 더 양호" | "위칸이 더 양호" | "비슷" {
  if (delta >= COMFORT_DELTA_NEAR) return "아래칸이 더 양호";
  if (delta <= -COMFORT_DELTA_NEAR) return "위칸이 더 양호";
  return "비슷";
}

export function formatComfortDelta(delta: number): string {
  const n = Math.round(delta);
  if (n > 0) return `+${n}`;
  return String(n);
}
