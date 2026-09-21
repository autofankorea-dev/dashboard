import { snapToStep } from "@/lib/controllers/controller-panel-map";
import type { AlarmThresholds } from "@/lib/data/alarms";

export const ALARM_TEMP_BOUNDS = { min: 10, max: 35, step: 0.1 } as const;
export const ALARM_HUM_BOUNDS = { min: 0, max: 100, step: 1 } as const;

export type AlarmRangeBounds = {
  min: number;
  max: number;
  step: number;
};

export type AlarmBaselineDeviation = {
  baseline: number;
  deviation: number;
};

function snap(n: number, step: number): number {
  return snapToStep(n, step);
}

export function alarmBaselineFromRange(
  lo: number,
  hi: number,
): AlarmBaselineDeviation {
  return {
    baseline: (lo + hi) / 2,
    deviation: Math.abs(hi - lo) / 2,
  };
}

/** 기준±편차 → 상·하한. 도메인 밖이면 편차를 줄인다(대칭 유지). */
export function alarmRangeFromBaseline(
  baseline: number,
  deviation: number,
  bounds: AlarmRangeBounds,
): { lo: number; hi: number } {
  const { min, max, step } = bounds;
  let mid = snap(baseline, step);
  let dev = Math.max(step, snap(deviation, step));
  const minMid = snap(min + step, step);
  const maxMid = snap(max - step, step);
  mid = Math.min(maxMid, Math.max(minMid, mid));
  const maxDev = Math.max(step, snap(Math.min(mid - min, max - mid), step));
  dev = Math.min(dev, maxDev);
  let lo = snap(mid - dev, step);
  let hi = snap(mid + dev, step);
  lo = Math.min(max - step, Math.max(min, lo));
  hi = Math.min(max, Math.max(min + step, hi));
  if (hi <= lo) hi = snap(lo + step, step);
  return { lo, hi };
}

export function formatAlarmBaselinePair(
  lo: number,
  hi: number,
  unit: "℃" | "%",
): string {
  const { baseline, deviation } = alarmBaselineFromRange(lo, hi);
  const fmt = (n: number) =>
    unit === "%"
      ? String(Math.round(n))
      : Number.isInteger(n)
        ? String(n)
        : n.toFixed(1);
  return `${fmt(baseline)}${unit} ±${fmt(deviation)}${unit}`;
}

export function formatAlarmBaselineSummary(t: AlarmThresholds): string {
  return `온도 ${formatAlarmBaselinePair(t.tempLow, t.tempHigh, "℃")} · 습도 ${formatAlarmBaselinePair(t.humidityLow, t.humidityHigh, "%")}`;
}

/** 한눈 표 알림 행 — 채널 격자와 같은 칸 */
export function formatAlarmGlanceCells(t: AlarmThresholds): {
  temp: string;
  tempDev: string;
  humidity: string;
} {
  const temp = alarmBaselineFromRange(t.tempLow, t.tempHigh);
  const hum = alarmBaselineFromRange(t.humidityLow, t.humidityHigh);
  const fmtTemp = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1);
  return {
    temp: fmtTemp(temp.baseline),
    tempDev: `±${fmtTemp(temp.deviation)}`,
    humidity: `${Math.round(hum.baseline)}±${Math.round(hum.deviation)}`,
  };
}

export type AlarmScaleEdgeKind =
  | "temp-baseline"
  | "temp-deviation"
  | "hum-baseline"
  | "hum-deviation";

export function alarmScaleEdgeKind(id: string): AlarmScaleEdgeKind | null {
  if (id === "temp-farm-mid" || id === "band-tick-temp-mid") {
    return "temp-baseline";
  }
  if (id === "hum-farm-mid" || id === "band-tick-hum-mid") {
    return "hum-baseline";
  }
  if (
    id === "temp-farm-hi" ||
    id === "temp-farm-lo" ||
    id === "temp-hi" ||
    id === "temp-lo"
  ) {
    return "temp-deviation";
  }
  if (
    id === "hum-farm-hi" ||
    id === "hum-farm-lo" ||
    id === "hum-hi" ||
    id === "hum-lo"
  ) {
    return "hum-deviation";
  }
  return null;
}

/** 차트 기준/편차 편집 → 저장용 상·하한. */
export function applyAlarmScaleEdgeCommit(
  current: AlarmThresholds,
  edgeId: string,
  value: number,
): AlarmThresholds | null {
  const kind = alarmScaleEdgeKind(edgeId);
  if (!kind) return null;
  if (kind === "temp-baseline" || kind === "temp-deviation") {
    const { baseline, deviation } = alarmBaselineFromRange(
      current.tempLow,
      current.tempHigh,
    );
    const next =
      kind === "temp-baseline"
        ? alarmRangeFromBaseline(value, deviation, ALARM_TEMP_BOUNDS)
        : alarmRangeFromBaseline(
            baseline,
            Math.abs(value - baseline),
            ALARM_TEMP_BOUNDS,
          );
    return { ...current, tempLow: next.lo, tempHigh: next.hi };
  }
  const { baseline, deviation } = alarmBaselineFromRange(
    current.humidityLow,
    current.humidityHigh,
  );
  const next =
    kind === "hum-baseline"
      ? alarmRangeFromBaseline(value, deviation, ALARM_HUM_BOUNDS)
      : alarmRangeFromBaseline(
          baseline,
          Math.abs(value - baseline),
          ALARM_HUM_BOUNDS,
        );
  return { ...current, humidityLow: next.lo, humidityHigh: next.hi };
}
