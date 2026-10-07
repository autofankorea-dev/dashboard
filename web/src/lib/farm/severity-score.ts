/**
 * 정규화 심각도 점수 유틸 — 그리드 그래프 모드(히트맵·상세 라인)용.
 *
 * 단위가 다른 지표(온도 ℃ / 습도 % / 팬 %)를 하나의 축에서 비교하기 위해
 * 각 지표를 자기 밴드 [lo, hi] 기준의 정규화 편차 점수 s 로 환산한다.
 *
 *   center = (lo + hi) / 2
 *   half   = (hi - lo) / 2
 *   s      = |value - center| / half     // 0 = 밴드 중심, 1 = 밴드 경계
 *
 *   정상: s <= 0.85 · 주의: 0.85 < s <= 1 · 경고: s > 1
 *
 * 히트맵 정책: 현재 알람 밴드로 **최신 구간(맨 오른쪽 열)만** 채점한다.
 * 과거 열은 미채점(`neutral`) — 상·하한 변경이 이력을 소급 재단하지 않는다.
 *
 * 밴드 소스:
 *   온도 = 알람 tempLow ~ tempHigh (점선) — 녹색 fill은 기간 관측 min~max
 *   습도 = 알람 humidityLow ~ humidityHigh (점선)
 *   팬   = thermo.minVentPct ~ maxVentPct (없으면 자기 이력 통계 밴드로 폴백)
 * 설정온도·편차는 환기 제어용, 알람 점선 시각화와 분리.
 */

import type { AlarmThresholds } from "@/lib/data/alarms";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";

/** neutral = 히트맵 과거 구간 미채점(현재 알람으로 소급하지 않음) */
export type Sev = "neutral" | "normal" | "caution" | "warning";

export const S_CAUTION = 0.85;
export const S_WARNING = 1.0;

export type Band = { lo: number; hi: number };

export function bandCenter(b: Band): number {
  return (b.lo + b.hi) / 2;
}

export function bandHalf(b: Band): number {
  return Math.max(0.001, (b.hi - b.lo) / 2);
}

/** 정규화 편차 점수. 값/밴드가 유효하지 않으면 null. */
export function severityScore(value: number | null | undefined, band: Band | null): number | null {
  if (value == null || !Number.isFinite(value) || !band || !Number.isFinite(band.lo) || !Number.isFinite(band.hi) || band.lo >= band.hi) return null;
  return Math.abs(value - bandCenter(band)) / bandHalf(band);
}

export function sevOfScore(s: number | null): Sev {
  if (s == null || !Number.isFinite(s)) return "neutral";
  if (s <= S_CAUTION) return "normal";
  if (s <= S_WARNING) return "caution";
  return "warning";
}

export function worstSev(sevs: Sev[]): Sev {
  let w: Sev = "normal";
  for (const s of sevs) {
    if (s === "neutral") continue;
    if (s === "warning") return "warning";
    if (s === "caution") w = "caution";
  }
  return w;
}

/* ---------- 표시 해상도 집계(다운샘플) ----------
 * 원본 버킷(24h=96 15m, 7d=168 1h, 30d=720 1h)을 히트맵 열 수(bars: 24/28/30)로 묶는다.
 * 색 = 구간 내 최악(binWorst) — 짧은 이상·위기 구간 보존.
 */

export function binWorst(scores: (number | null)[], bars: number): (number | null)[] {
  const n = scores.length;
  if (!bars || bars >= n) return scores.slice();
  const g = Math.ceil(n / bars);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i += g) {
    let m: number | null = null;
    for (let j = i; j < Math.min(n, i + g); j++) {
      const v = scores[j];
      if (v != null && Number.isFinite(v)) m = m == null ? v : Math.max(m, v);
    }
    out.push(m);
  }
  return out;
}

/* ---------- 밴드 빌더 ---------- */

/** 온도 알람 구간 — 그래프 상하한·주의/경고 판정용. */
export function tempBand(thresholds: AlarmThresholds): Band | null {
  if (!Number.isFinite(thresholds.tempLow) || !Number.isFinite(thresholds.tempHigh) || thresholds.tempLow >= thresholds.tempHigh) return null;
  return { lo: thresholds.tempLow, hi: thresholds.tempHigh };
}

export function humidityBand(thresholds: AlarmThresholds): Band | null {
  if (!Number.isFinite(thresholds.humidityLow) || !Number.isFinite(thresholds.humidityHigh) || thresholds.humidityLow >= thresholds.humidityHigh) return null;
  return { lo: thresholds.humidityLow, hi: thresholds.humidityHigh };
}

/** 팬 밴드 = 최저~최고 환기. 설정이 없거나 폭이 0이면 null(→ 통계 폴백). */
export function fanBand(
  thermo: Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null
): Band | null {
  if (!thermo) return null;
  const { minVentPct, maxVentPct } = thermo;
  if (!Number.isFinite(minVentPct) || !Number.isFinite(maxVentPct)) return null;
  if (maxVentPct <= minVentPct) return null;
  return { lo: minVentPct, hi: maxVentPct };
}

/**
 * 기간 관측 편차 밴드 — 시리즈 min~max (그래프 녹색 fill용).
 * 표본이 없거나 폭이 0이면 null.
 */
export function observedRangeBand(
  values: (number | null | undefined)[],
): Band | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length === 0) return null;
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  if (!(hi > lo)) return null;
  return { lo, hi };
}

/**
 * 통계 폴백 밴드 — thermo 결측 시 자기 이력(중앙값 ± 2σ) 기준.
 * 표본이 부족하거나 변동이 거의 없으면 null(→ 심각도 판정 보류 = 정상 처리).
 */
export function statBand(values: (number | null | undefined)[]): Band | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length < 4) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const mean = xs.reduce((sum, v) => sum + v, 0) / xs.length;
  const variance = xs.reduce((sum, v) => sum + (v - mean) ** 2, 0) / xs.length;
  const std = Math.sqrt(variance);
  const halfWidth = Math.max(std * 2, Math.abs(median) * 0.15, 1);
  return { lo: median - halfWidth, hi: median + halfWidth };
}

/** 심각도 색 — `--status-*` (히트맵·덮개·현황 동일). */
export const SEV_COLOR: Record<Sev, string> = {
  neutral: "var(--muted-foreground)",
  normal: "var(--status-ok)",
  caution: "var(--status-warn)",
  warning: "var(--status-danger)",
};

export const SEV_LABEL: Record<Sev, string> = {
  neutral: "미판정",
  normal: "정상",
  caution: "주의",
  warning: "경고",
};

/** 히트맵 셀 투명도 — 미채점·정상은 옅게, 주의·경고는 진하게. 다크는 CSS 토큰. */
export function heatmapSevOpacity(sev: Sev): string {
  return sev === "neutral" || sev === "normal"
    ? "var(--heatmap-sev-faint)"
    : "var(--heatmap-sev-strong)";
}
