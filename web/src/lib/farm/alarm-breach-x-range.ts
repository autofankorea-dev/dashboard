/**
 * 통합 추이에서 알람(온도) 초과 연속 구간 → X 스코프 비율.
 * 차트 자동 드래그 스코프는 고정 0.18–0.6이 아니라 이 결과를 쓴다.
 *
 * 차트 `buildThresholdBreachCorridor`와 맞춘다:
 * - 산포 상단(tempMax) · 평균(tempAvg) 모두 검사
 * - 샘플 점 + 인접 샘플 보간 교차
 * - 상한에 걸린 run이 여러 개면 첫~끝 전부 커버
 */
import type { ChartTrendZoomHint } from "@/lib/farm/farm-chart-scope";

/** 차트 BREACH_TOUCH_EPS와 동일 — 접촉 포함 */
const BREACH_TOUCH_EPS = 1e-6;
/** 산포가 선에 “걸려 보이는” 여유 (℃) */
const BREACH_NEAR_EPS = 0.05;
/** 이 간격 이하면 같은 이벤트로 병합 */
const MERGE_GAP = 2;

export type TempAlarmBreachRun = {
  start: number;
  end: number;
  side: "high" | "low" | "both";
  peakExcess: number;
};

export type TempAlarmBreachWindow = {
  start: number;
  end: number;
  startRatio: number;
  endRatio: number;
  side: "high" | "low" | "both";
  peakExcess: number;
  runCount: number;
  runs: TempAlarmBreachRun[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function isHighBreach(v: number, alarmHigh: number): boolean {
  return v >= alarmHigh - BREACH_TOUCH_EPS - BREACH_NEAR_EPS;
}

function isLowBreach(v: number, alarmLow: number): boolean {
  return v <= alarmLow + BREACH_TOUCH_EPS + BREACH_NEAR_EPS;
}

function sampleAt(
  series: (number | null | undefined)[],
  i: number,
): number | null {
  const v = series[i];
  return v != null && Number.isFinite(v) ? v : null;
}

/** 점 또는 (i↔i+1) 보간이 임계를 가로지르면 true */
function highTouchAt(
  i: number,
  hiSeries: (number | null | undefined)[],
  avg: (number | null | undefined)[],
  alarmHigh: number,
): boolean {
  const hi = sampleAt(hiSeries, i) ?? sampleAt(avg, i);
  const a = sampleAt(avg, i);
  if (hi != null && isHighBreach(hi, alarmHigh)) return true;
  if (a != null && isHighBreach(a, alarmHigh)) return true;

  if (i >= hiSeries.length - 1 && i >= avg.length - 1) return false;
  const hi0 = sampleAt(hiSeries, i) ?? sampleAt(avg, i);
  const hi1 = sampleAt(hiSeries, i + 1) ?? sampleAt(avg, i + 1);
  if (hi0 != null && hi1 != null) {
    if (isHighBreach(hi0, alarmHigh) || isHighBreach(hi1, alarmHigh)) return true;
    /** 둘 다 아래인데 보간 직선이 임계를 스치는 경우는 없음(선형). 한쪽 위면 위에서 걸림 */
    if ((hi0 - alarmHigh) * (hi1 - alarmHigh) < 0) return true;
  }
  const a0 = sampleAt(avg, i);
  const a1 = sampleAt(avg, i + 1);
  if (a0 != null && a1 != null) {
    if (isHighBreach(a0, alarmHigh) || isHighBreach(a1, alarmHigh)) return true;
    if ((a0 - alarmHigh) * (a1 - alarmHigh) < 0) return true;
  }
  return false;
}

function lowTouchAt(
  i: number,
  loSeries: (number | null | undefined)[],
  avg: (number | null | undefined)[],
  alarmLow: number,
): boolean {
  const lo = sampleAt(loSeries, i) ?? sampleAt(avg, i);
  const a = sampleAt(avg, i);
  if (lo != null && isLowBreach(lo, alarmLow)) return true;
  if (a != null && isLowBreach(a, alarmLow)) return true;

  const lo0 = sampleAt(loSeries, i) ?? sampleAt(avg, i);
  const lo1 = sampleAt(loSeries, i + 1) ?? sampleAt(avg, i + 1);
  if (lo0 != null && lo1 != null) {
    if (isLowBreach(lo0, alarmLow) || isLowBreach(lo1, alarmLow)) return true;
    if ((lo0 - alarmLow) * (lo1 - alarmLow) < 0) return true;
  }
  const a0 = sampleAt(avg, i);
  const a1 = sampleAt(avg, i + 1);
  if (a0 != null && a1 != null) {
    if (isLowBreach(a0, alarmLow) || isLowBreach(a1, alarmLow)) return true;
    if ((a0 - alarmLow) * (a1 - alarmLow) < 0) return true;
  }
  return false;
}

function indexBreachSide(
  i: number,
  hiSeries: (number | null | undefined)[],
  loSeries: (number | null | undefined)[],
  avg: (number | null | undefined)[],
  alarmLow: number,
  alarmHigh: number,
): "high" | "low" | null {
  const high = highTouchAt(i, hiSeries, avg, alarmHigh);
  const low = lowTouchAt(i, loSeries, avg, alarmLow);
  if (high && low) return "high";
  if (high) return "high";
  if (low) return "low";
  return null;
}

function excessAt(
  i: number,
  side: "high" | "low",
  hiSeries: (number | null | undefined)[],
  loSeries: (number | null | undefined)[],
  avg: (number | null | undefined)[],
  alarmLow: number,
  alarmHigh: number,
): number {
  if (side === "high") {
    const hi = sampleAt(hiSeries, i) ?? sampleAt(avg, i);
    if (hi == null) return 0;
    return Math.max(0, hi - alarmHigh);
  }
  const lo = sampleAt(loSeries, i) ?? sampleAt(avg, i);
  if (lo == null) return 0;
  return Math.max(0, alarmLow - lo);
}

function mergeNearbyRuns(runs: TempAlarmBreachRun[]): TempAlarmBreachRun[] {
  if (runs.length <= 1) return runs;
  const sorted = [...runs].sort((a, b) => a.start - b.start);
  const out: TempAlarmBreachRun[] = [];
  let cur = { ...sorted[0]! };
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (r.start <= cur.end + MERGE_GAP + 1) {
      cur = {
        start: cur.start,
        end: Math.max(cur.end, r.end),
        side:
          cur.side === r.side
            ? cur.side
            : cur.side === "both" || r.side === "both"
              ? "both"
              : "both",
        peakExcess: Math.max(cur.peakExcess, r.peakExcess),
      };
    } else {
      out.push(cur);
      cur = { ...r };
    }
  }
  out.push(cur);
  return out;
}

/** 연속 초과 run 목록 */
export function listTempAlarmBreachRuns(
  tempAvg: (number | null | undefined)[],
  tempAlarmLow: number,
  tempAlarmHigh: number,
  opts?: {
    tempMax?: (number | null | undefined)[];
    tempMin?: (number | null | undefined)[];
  },
): TempAlarmBreachRun[] {
  const n = tempAvg.length;
  if (n < 2) return [];
  if (
    !Number.isFinite(tempAlarmLow) ||
    !Number.isFinite(tempAlarmHigh) ||
    tempAlarmHigh <= tempAlarmLow
  ) {
    return [];
  }

  const hiSeries = opts?.tempMax ?? tempAvg;
  const loSeries = opts?.tempMin ?? tempAvg;
  const flagged = new Array<boolean>(n).fill(false);
  const sideAt = new Array<"high" | "low" | null>(n).fill(null);

  for (let i = 0; i < n; i++) {
    const side = indexBreachSide(
      i,
      hiSeries,
      loSeries,
      tempAvg,
      tempAlarmLow,
      tempAlarmHigh,
    );
    if (side) {
      flagged[i] = true;
      sideAt[i] = side;
    }
  }

  const runs: TempAlarmBreachRun[] = [];
  let runStart = -1;
  let runSide: "high" | "low" | "both" | null = null;
  let peak = 0;

  const flush = (end: number) => {
    if (runStart < 0 || !runSide) return;
    runs.push({
      start: runStart,
      end,
      side: runSide,
      peakExcess: peak,
    });
    runStart = -1;
    runSide = null;
    peak = 0;
  };

  for (let i = 0; i < n; i++) {
    if (flagged[i]) {
      const side = sideAt[i] ?? "high";
      const ex = excessAt(
        i,
        side === "low" ? "low" : "high",
        hiSeries,
        loSeries,
        tempAvg,
        tempAlarmLow,
        tempAlarmHigh,
      );
      if (runStart < 0) {
        runStart = i;
        runSide = side;
        peak = ex;
      } else {
        if (runSide !== side && runSide !== "both") runSide = "both";
        peak = Math.max(peak, ex);
      }
    } else {
      flush(i - 1);
    }
  }
  flush(n - 1);

  return mergeNearbyRuns(runs);
}

function coverRuns(
  runs: TempAlarmBreachRun[],
  n: number,
  padLeft: number,
  padRight: number,
  minSpanRatio: number,
): TempAlarmBreachWindow {
  let start = Math.max(0, Math.min(...runs.map((r) => r.start)) - padLeft);
  let end = Math.min(n - 1, Math.max(...runs.map((r) => r.end)) + padRight);
  const peakExcess = Math.max(...runs.map((r) => r.peakExcess));
  const sides = new Set(runs.map((r) => r.side));
  const side: "high" | "low" | "both" =
    sides.has("both") || (sides.has("high") && sides.has("low"))
      ? "both"
      : sides.has("high")
        ? "high"
        : "low";

  const denom = n - 1;
  let startRatio = start / denom;
  let endRatio = end / denom;
  if (endRatio - startRatio < minSpanRatio) {
    const mid = (startRatio + endRatio) / 2;
    startRatio = clamp01(mid - minSpanRatio / 2);
    endRatio = clamp01(mid + minSpanRatio / 2);
    if (endRatio - startRatio < minSpanRatio) {
      endRatio = Math.min(1, startRatio + minSpanRatio);
    }
    start = Math.round(startRatio * denom);
    end = Math.round(endRatio * denom);
    if (end - start < 2) {
      /** 최소 폭은 왼쪽으로만 */
      end = Math.min(n - 1, Math.max(end, start + 2));
      start = Math.max(0, end - 2);
      startRatio = start / denom;
      endRatio = end / denom;
    }
  }

  return {
    start,
    end,
    startRatio: clamp01(startRatio),
    endRatio: clamp01(endRatio),
    side,
    peakExcess,
    runCount: runs.length,
    runs,
  };
}

/**
 * 산포·평균이 임계에 닿거나 넘는 모든 구간을 덮는 X 윈도우.
 */
export function findTempAlarmBreachXRange(
  tempAvg: (number | null | undefined)[],
  tempAlarmLow: number,
  tempAlarmHigh: number,
  opts?: {
    tempMax?: (number | null | undefined)[];
    tempMin?: (number | null | undefined)[];
    /** @deprecated padIndices — 좌우 동일. padLeft/padRight 권장 */
    padIndices?: number;
    /** 첫 초과 앞쪽 여유(산포 시작이 보이도록). 기본 1 */
    padLeft?: number;
    /** 마지막 초과 뒤 여유. 기본 0 (다음 정상 봉 유입 방지) */
    padRight?: number;
    minSpanRatio?: number;
    singleBestRun?: boolean;
  },
): TempAlarmBreachWindow | null {
  const n = tempAvg.length;
  if (n < 2) return null;

  const legacyPad = opts?.padIndices;
  const padLeft = Math.max(0, opts?.padLeft ?? legacyPad ?? 1);
  const padRight = Math.max(0, opts?.padRight ?? legacyPad ?? 0);
  const minSpanRatio = opts?.minSpanRatio ?? 0.04;
  const runs = listTempAlarmBreachRuns(tempAvg, tempAlarmLow, tempAlarmHigh, {
    tempMax: opts?.tempMax,
    tempMin: opts?.tempMin,
  });
  if (!runs.length) return null;

  if (opts?.singleBestRun) {
    const scored = runs
      .map((r) => {
        const len = r.end - r.start + 1;
        const score = len * (1 + r.peakExcess);
        return { r, score };
      })
      .sort((a, b) => b.score - a.score || b.r.peakExcess - a.r.peakExcess);
    return coverRuns([scored[0]!.r], n, padLeft, padRight, minSpanRatio);
  }

  const highish = runs.filter((r) => r.side === "high" || r.side === "both");
  const lowish = runs.filter((r) => r.side === "low" || r.side === "both");
  const chosen =
    highish.length > 0 ? highish : lowish.length > 0 ? lowish : runs;

  return coverRuns(chosen, n, padLeft, padRight, minSpanRatio);
}

export function chartZoomFromTempBreach(
  win: TempAlarmBreachWindow | null,
): ChartTrendZoomHint | null {
  if (!win) return null;
  return {
    yBands: ["temp"],
    startRatio: win.startRatio,
    endRatio: win.endRatio,
    startIndex: win.start,
    endIndex: win.end,
  };
}
