import type { AlarmThresholds } from "@/lib/domain/alarms";
import type {
  SplitYVisibility,
  UnifiedBarnTrendRaw,
} from "@/lib/farm/unified-barn-trend-series";

export type ScopeMetricId = "temp" | "hum" | "motor";

export type ScopeMetricSummary = {
  id: ScopeMetricId;
  label: string;
  unit: string;
  avg: number;
  min: number;
  max: number;
  /** 유한 샘플 수 */
  n: number;
  /**
   * 알람 구간 밖 비율 0–1.
   * 모터는 임계 없음 → null.
   */
  breachRate: number | null;
};

export type UnifiedScopeSummary = {
  start: number;
  end: number;
  sampleCount: number;
  metrics: ScopeMetricSummary[];
};

export function summarizeNumericWindow(
  values: (number | null | undefined)[],
  start: number,
  end: number,
): { avg: number; min: number; max: number; n: number } | null {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(values.length - 1, Math.max(start, end));
  if (values.length === 0 || lo > hi) return null;

  let sum = 0;
  let n = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = lo; i <= hi; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    n += 1;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (n === 0) return null;
  return { avg: sum / n, min, max, n };
}

/** 알람 [low, high] 밖인 샘플 비율 */
export function alarmBreachRate(
  values: (number | null | undefined)[],
  start: number,
  end: number,
  low: number,
  high: number,
): number | null {
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return null;
  }
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(values.length - 1, Math.max(start, end));
  if (values.length === 0 || lo > hi) return null;

  let n = 0;
  let bad = 0;
  for (let i = lo; i <= hi; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    n += 1;
    if (v < low || v > high) bad += 1;
  }
  if (n === 0) return null;
  return bad / n;
}

/**
 * P3 — 스코프 구간 원단위 요약 (평균·min/max·이탈률).
 * raw는 layout 무관 집계, start/end는 categories inclusive.
 */
export function buildUnifiedScopeSummary(
  raw: UnifiedBarnTrendRaw,
  start: number,
  end: number,
  visibility: SplitYVisibility,
): UnifiedScopeSummary | null {
  const metrics: ScopeMetricSummary[] = [];

  if (visibility.showTemp) {
    const win = summarizeNumericWindow(raw.tempAvg, start, end);
    if (win) {
      metrics.push({
        id: "temp",
        label: "온도",
        unit: "℃",
        ...win,
        breachRate: alarmBreachRate(
          raw.tempAvg,
          start,
          end,
          raw.tempLow,
          raw.tempHigh,
        ),
      });
    }
  }

  if (visibility.showHum) {
    const win = summarizeNumericWindow(raw.humAvg, start, end);
    if (win) {
      metrics.push({
        id: "hum",
        label: "습도",
        unit: "%",
        ...win,
        breachRate: alarmBreachRate(
          raw.humAvg,
          start,
          end,
          raw.humidityLow,
          raw.humidityHigh,
        ),
      });
    }
  }

  if (visibility.showMotors) {
    const win = summarizeNumericWindow(raw.fanMaxRaw, start, end);
    if (win) {
      metrics.push({
        id: "motor",
        label: "모터",
        unit: "%",
        ...win,
        breachRate: null,
      });
    }
  }

  if (!metrics.length) return null;

  const sampleCount = Math.max(...metrics.map((m) => m.n));
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    sampleCount,
    metrics,
  };
}

/** 표시용 — thresholds 직접 넘길 때(테스트·외부) */
export function buildScopeSummaryFromColumns(
  columns: {
    temp?: (number | null)[];
    hum?: (number | null)[];
    motor?: (number | null)[];
  },
  start: number,
  end: number,
  thresholds: AlarmThresholds,
  visibility: SplitYVisibility,
): UnifiedScopeSummary | null {
  const fakeRaw = {
    categories: [],
    controllerCount: 1,
    thresholds,
    tempLow: thresholds.tempLow,
    tempHigh: thresholds.tempHigh,
    humidityLow: thresholds.humidityLow,
    humidityHigh: thresholds.humidityHigh,
    tempMid: (thresholds.tempLow + thresholds.tempHigh) / 2,
    humMid: (thresholds.humidityLow + thresholds.humidityHigh) / 2,
    fanA: [],
    fanB: [],
    fanC: [],
    fanMaxRaw: columns.motor ?? [],
    tempAvg: columns.temp ?? [],
    humAvg: columns.hum ?? [],
    tempMin: [],
    tempMax: [],
    humMin: [],
    humMax: [],
    emaShortRaw: [],
    emaLongRaw: [],
    humEmaShortRaw: [],
    humEmaLongRaw: [],
    tempDevRaw: [],
    humDevRaw: [],
    tempDevOpacity: [],
    humDevOpacity: [],
    tempSpreadExtremes: { high: [], low: [] },
    humSpreadExtremes: { high: [], low: [] },
    tempRangeLabel: "",
    humidityRangeLabel: "",
    thermoWindows: null,
  } satisfies UnifiedBarnTrendRaw;

  return buildUnifiedScopeSummary(fakeRaw, start, end, visibility);
}

export function formatScopeStat(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function formatBreachPct(rate: number | null): string | null {
  if (rate == null || !Number.isFinite(rate)) return null;
  return `${Math.round(rate * 100)}%`;
}
