import type { TrendPeriodId } from "@/lib/data/farm-trend-types";
import { computeBinnedMetricValues } from "@/lib/farm/stack-metric";

/**
 * 그리드·sheet 공용 표시 막대 수.
 * 원본은 TREND_PERIODS → 히트맵 색은 binWorst, 값/라인은 구간 평균.
 * 24h=1시간(15m×4), 7d=6시간(1h×6), 30d=1일(1h×24).
 * 차트 탭 미니 칸은 GRAPH_BARS가 아니라 TREND_MINI_STRIDE_MS(2시간 평균).
 */
export const GRAPH_BARS: Record<TrendPeriodId, number> = {
  "24h": 24,
  "7d": 28,
  "30d": 30,
};

/** 표시 구간의 대표 라벨(구간 시작 bucket). */
export function binTrendCategories(categories: string[], bars: number): string[] {
  const n = categories.length;
  if (!bars || bars >= n) return categories.slice();
  const g = Math.ceil(n / bars);
  const out: string[] = [];
  for (let i = 0; i < n; i += g) {
    out.push(categories[i] ?? "");
  }
  return out;
}

export function downsampleTrendValues(
  values: (number | null)[],
  bars: number,
): (number | null)[] {
  return computeBinnedMetricValues(values, bars);
}

/** 차트 표시 점 — 약 2.5px당 1점. 소스보다 늘리지 않음. */
export const CHART_PX_PER_POINT = 2.5;

export function targetChartDisplayBars(
  sourceLen: number,
  plotWidthPx = 800,
): number {
  if (sourceLen <= 1) return Math.max(0, sourceLen);
  const width = Number.isFinite(plotWidthPx) && plotWidthPx > 32 ? plotWidthPx : 800;
  const byPixel = Math.max(32, Math.floor(width / CHART_PX_PER_POINT));
  return Math.min(sourceLen, byPixel);
}

function lttbY(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

/** LTTB — 첫·끝점 고정, 피크를 남기는 인덱스. */
export function pickLttbIndices(
  values: (number | null)[],
  target: number,
): number[] {
  const n = values.length;
  if (n <= 0) return [];
  if (target >= n || n <= 2) {
    return Array.from({ length: n }, (_, i) => i);
  }
  const threshold = Math.max(2, Math.min(target, n));
  if (threshold === 2) return [0, n - 1];

  const sampled: number[] = [0];
  const bucketSize = (n - 2) / (threshold - 2);
  let a = 0;
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, n);
    const avgLen = Math.max(1, avgRangeEnd - avgRangeStart);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += j;
      avgY += lttbY(values[j]);
    }
    avgX /= avgLen;
    avgY /= avgLen;

    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
    const ax = a;
    const ay = lttbY(values[a]);
    let maxArea = -1;
    let nextA = rangeOffs;
    for (let j = rangeOffs; j < rangeTo && j < n - 1; j++) {
      const area = Math.abs(
        (ax - avgX) * (lttbY(values[j]) - ay) - (ax - j) * (avgY - ay),
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push(nextA);
    a = nextA;
  }
  sampled.push(n - 1);
  return sampled;
}

export function downsampleByIndices<T>(arr: T[], indices: number[]): T[] {
  return indices.map((i) => arr[i]!);
}

export function downsampleTrendAxisToBars(
  categories: string[],
  dataColumns: (number | null)[][],
  bars: number,
): { categories: string[]; columns: (number | null)[][] } {
  return {
    categories: binTrendCategories(categories, bars),
    columns: dataColumns.map((col) => downsampleTrendValues(col, bars)),
  };
}

/** 원본 RPC 버킷 → GRAPH_BARS 표시 해상도(평균 집계). */
export function downsampleTrendAxis(
  categories: string[],
  dataColumns: (number | null)[][],
  period: TrendPeriodId,
): { categories: string[]; columns: (number | null)[][] } {
  return downsampleTrendAxisToBars(categories, dataColumns, GRAPH_BARS[period]);
}

/** 라인 차트용 — 플롯 너비 기준 LTTB. 히트맵은 GRAPH_BARS 유지. */
export function downsampleColumnsForChart(
  categories: string[],
  dataColumns: (number | null)[][],
  plotWidthPx: number,
): { categories: string[]; columns: (number | null)[][] } {
  const n = categories.length;
  const bars = targetChartDisplayBars(n, plotWidthPx);
  if (n <= 1 || bars >= n) {
    return { categories, columns: dataColumns };
  }
  const driver =
    dataColumns.find((col) =>
      col.some((v) => v != null && Number.isFinite(v)),
    ) ??
    dataColumns[0] ??
    [];
  const idx = pickLttbIndices(driver, bars);
  return {
    categories: downsampleByIndices(categories, idx),
    columns: dataColumns.map((col) => downsampleByIndices(col, idx)),
  };
}

/** X축 tick 목표 개수 — 축약 라벨(월 1회·일만) 기준 */
export const TREND_CHART_TICK_TARGET = 8;
export const TREND_CHART_TICK_TARGET_COMPACT = 6;
/** 모바일 — 짧은 시간 라벨 기준, 최대 4개 */
export const TREND_CHART_TICK_TARGET_STACKED = 4;
export const TREND_CHART_TICK_MIN_SLOT_PX = 52;
export const TREND_CHART_TICK_MIN_SLOT_PX_STACKED = 88;

/** compact/TrendChart — 기간별 표시 막대 수에 맞춘 tick 간격. */
export function tickEveryForDisplayBars(
  count: number,
  opts?: { compact?: boolean },
): number {
  const target = opts?.compact
    ? TREND_CHART_TICK_TARGET_COMPACT
    : TREND_CHART_TICK_TARGET;
  if (count <= target) return 1;
  return Math.max(1, Math.ceil(count / target));
}

/** 플롯 너비에 맞춰 라벨이 잘리지 않을 tick 개수. */
export function trendChartTickTargetForWidth(
  plotWidthPx: number,
  opts?: { stacked?: boolean },
): number {
  const stacked = Boolean(opts?.stacked);
  const slot = stacked
    ? TREND_CHART_TICK_MIN_SLOT_PX_STACKED
    : TREND_CHART_TICK_MIN_SLOT_PX;
  const width =
    Number.isFinite(plotWidthPx) && plotWidthPx > 32 ? plotWidthPx : 800;
  const byWidth = Math.max(3, Math.floor(width / slot));
  const cap = stacked
    ? TREND_CHART_TICK_TARGET_STACKED
    : TREND_CHART_TICK_TARGET;
  return Math.min(cap, byWidth);
}

/** tickIndices dedup — 라벨 겹침 방지 최소 인덱스 간격 */
export function trendChartTickMinGap(
  count: number,
  every: number,
  target = TREND_CHART_TICK_TARGET,
): number {
  if (count <= 0) return 1;
  return Math.max(every, Math.ceil(count / target));
}

/** 첫·끝 고정, every 간격 + 목표 개수 상한. */
export function buildTrendTickIndices(
  count: number,
  every: number,
  target: number,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const step = Math.max(1, every);
  const candidates: number[] = [];
  for (let i = 0; i < count; i += step) candidates.push(i);
  if (candidates[candidates.length - 1] !== count - 1) {
    candidates.push(count - 1);
  }
  const minGap = trendChartTickMinGap(count, step, target);
  const out: number[] = [candidates[0]!];
  for (let k = 1; k < candidates.length; k++) {
    const idx = candidates[k]!;
    const prev = out[out.length - 1]!;
    const isLast = k === candidates.length - 1;
    if (idx - prev >= minGap) {
      out.push(idx);
    } else if (isLast) {
      out[out.length - 1] = idx;
    }
  }
  return out;
}

/** 화면 px 간격이 부족하면 중간 tick을 뺀다. 첫·끝은 유지. */
export function thinTrendTicksByMinGapPx(
  indices: number[],
  xPxAt: (index: number) => number,
  minGapPx: number,
): number[] {
  if (indices.length <= 2) return indices.slice();
  const last = indices[indices.length - 1]!;
  const lastX = xPxAt(last);
  const gap = Math.max(1, minGapPx);
  const out: number[] = [indices[0]!];
  for (let k = 1; k < indices.length - 1; k++) {
    const idx = indices[k]!;
    const x = xPxAt(idx);
    const prevX = xPxAt(out[out.length - 1]!);
    if (x - prevX >= gap && lastX - x >= gap) {
      out.push(idx);
    }
  }
  out.push(last);
  return out;
}

/** 브러시 격자 눈금 — t(0~1) 기준 px 솎기. 첫·끝 유지. */
export function thinBrushTicksByMinGapPx(
  ticks: TrendBrushAxisTick[],
  xPxAt: (t: number) => number,
  minGapPx: number,
): TrendBrushAxisTick[] {
  if (ticks.length <= 2) return ticks.slice();
  const last = ticks[ticks.length - 1]!;
  const lastX = xPxAt(last.t);
  const gap = Math.max(1, minGapPx);
  const out: TrendBrushAxisTick[] = [ticks[0]!];
  for (let k = 1; k < ticks.length - 1; k++) {
    const tick = ticks[k]!;
    const x = xPxAt(tick.t);
    const prevX = xPxAt(out[out.length - 1]!.t);
    if (x - prevX >= gap && lastX - x >= gap) {
      out.push(tick);
    }
  }
  out.push(last);
  return out;
}

/** 풀 라벨 `M/D` · `M/D HH` · `M/D HH:mm` 파싱 (호버용 categories 형식). */
export function parseTrendAxisMdLabel(
  fullLabel: string,
): { month: number; day: number } | null {
  const m = fullLabel.match(
    /^(\d{1,2})\/(\d{1,2})(?:\s+\d{1,2}(?::\d{2})?)?$/,
  );
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { month, day };
}

/** `M/D HH:mm` · `M/D HH` · `HH:mm` — 24h tick·스코프용 */
export function parseTrendAxisTimeLabel(fullLabel: string): {
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const mdHm = fullLabel.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (mdHm) {
    return {
      month: Number(mdHm[1]),
      day: Number(mdHm[2]),
      hour: Number(mdHm[3]),
      minute: Number(mdHm[4]),
    };
  }
  const mdH = fullLabel.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})$/);
  if (mdH) {
    return {
      month: Number(mdH[1]),
      day: Number(mdH[2]),
      hour: Number(mdH[3]),
      minute: 0,
    };
  }
  const hm = fullLabel.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    return {
      month: 0,
      day: 0,
      hour: Number(hm[1]),
      minute: Number(hm[2]),
    };
  }
  return null;
}

export type TrendAxisLabelKind = "md-hm" | "md-h" | "hm" | "md";

export type TrendBrushAxisTick = {
  /** 0 = 브러시 왼쪽 끝, 1 = 오른쪽 끝 */
  t: number;
  fullLabel: string;
};

export function inferTrendAxisLabelKind(
  label: string,
): TrendAxisLabelKind | null {
  const s = label.trim();
  if (/^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}$/.test(s)) return "md-hm";
  if (/^\d{1,2}\/\d{1,2}\s+\d{1,2}$/.test(s)) return "md-h";
  if (/^\d{1,2}:\d{2}$/.test(s)) return "hm";
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) return "md";
  return null;
}

function trendAxisLabelToDate(label: string, year: number): Date | null {
  const t = parseTrendAxisTimeLabel(label);
  if (t) {
    const month = t.month > 0 ? t.month : 1;
    const day = t.day > 0 ? t.day : 1;
    return new Date(year, month - 1, day, t.hour, t.minute, 0, 0);
  }
  const md = parseTrendAxisMdLabel(label);
  if (!md) return null;
  return new Date(year, md.month - 1, md.day, 0, 0, 0, 0);
}

function formatTrendAxisDate(date: Date, kind: TrendAxisLabelKind): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = padTrendAxis2(date.getHours());
  const mm = padTrendAxis2(date.getMinutes());
  if (kind === "hm") return `${hh}:${mm}`;
  if (kind === "md") return `${month}/${day}`;
  if (kind === "md-h") return `${month}/${day} ${hh}`;
  return `${month}/${day} ${hh}:${mm}`;
}

function pickTrendAxisLabelKind(
  start: string,
  end: string,
): TrendAxisLabelKind | null {
  const a = inferTrendAxisLabelKind(start);
  const b = inferTrendAxisLabelKind(end);
  if (!a && !b) return null;
  const rank = (k: TrendAxisLabelKind | null) =>
    k === "md-hm" ? 4 : k === "md-h" ? 3 : k === "hm" ? 2 : k === "md" ? 1 : 0;
  return rank(a) >= rank(b) ? a : b;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 카테고리 라벨 → 시간축 ms. 점과 눈금을 같은 달력 축에 놓기 위함.
 * 파싱 실패 시 null.
 */
export function parseCategoryTimelineMs(
  categories: string[],
  now = new Date(),
): number[] | null {
  const labels = categories.map((c) => c.trim());
  if (labels.length === 0 || labels.some((c) => !c)) return null;
  const kind = pickTrendAxisLabelKind(labels[0]!, labels[labels.length - 1]!);
  if (!kind) return null;
  let year = now.getFullYear();
  let prev: Date | null = null;
  const out: number[] = [];
  for (const label of labels) {
    let d = trendAxisLabelToDate(label, year);
    if (!d) return null;
    if (prev && d.getTime() < prev.getTime() - 500) {
      const prevMd = parseTrendAxisMdLabel(labels[out.length - 1] ?? "");
      const curMd = parseTrendAxisMdLabel(label);
      const wrappedYear =
        curMd != null &&
        prevMd != null &&
        prevMd.month >= 11 &&
        curMd.month <= 2 &&
        curMd.month < prevMd.month;
      if (wrappedYear) {
        year += 1;
        d = trendAxisLabelToDate(label, year);
        if (!d) return null;
      } else {
        d = new Date(d.getTime() + DAY_MS);
      }
    }
    prev = d;
    out.push(d.getTime());
  }
  return out;
}

/** 정각·15·30·45분 및 그보다 큰 보기 좋은 간격 */
export const TREND_AXIS_NICE_STEPS_MS = [
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  DAY_MS,
  2 * DAY_MS,
  7 * DAY_MS,
] as const;

function isDayStep(stepMs: number): boolean {
  return stepMs >= DAY_MS && stepMs % DAY_MS === 0;
}

function localDayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function ceilToNiceLocal(from: Date, stepMs: number): Date {
  if (isDayStep(stepMs)) {
    const days = stepMs / DAY_MS;
    const start = localDayStart(from);
    if (from.getTime() <= start.getTime() + 500) {
      return start;
    }
    if (days <= 1) {
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    }
    const origin = new Date(from.getFullYear(), 0, 1);
    const dayIndex = Math.round((start.getTime() - origin.getTime()) / DAY_MS);
    const nextIndex = Math.ceil((dayIndex + 1) / days) * days;
    return new Date(origin.getFullYear(), 0, 1 + nextIndex);
  }
  const stepMin = stepMs / 60_000;
  const day0 = localDayStart(from);
  const minFloat =
    from.getHours() * 60 +
    from.getMinutes() +
    from.getSeconds() / 60 +
    from.getMilliseconds() / 60_000;
  const snapped = Math.ceil(minFloat / stepMin - 1e-9) * stepMin;
  return new Date(day0.getTime() + snapped * 60_000);
}

function addNiceStep(d: Date, stepMs: number): Date {
  if (isDayStep(stepMs)) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + stepMs / DAY_MS,
    );
  }
  return new Date(d.getTime() + stepMs);
}

function enumerateNiceLocalTimes(
  start: Date,
  end: Date,
  stepMs: number,
): Date[] {
  const out: Date[] = [];
  let t = ceilToNiceLocal(start, stepMs);
  const endMs = end.getTime();
  let guard = 0;
  while (t.getTime() <= endMs + 500 && guard++ < 256) {
    if (t.getTime() >= start.getTime() - 500) out.push(new Date(t.getTime()));
    t = addNiceStep(t, stepMs);
  }
  return out;
}

function pickNiceStepMs(start: Date, end: Date, maxTicks: number): number {
  const cap = Math.max(1, maxTicks);
  let last = TREND_AXIS_NICE_STEPS_MS[TREND_AXIS_NICE_STEPS_MS.length - 1]!;
  for (const step of TREND_AXIS_NICE_STEPS_MS) {
    last = step;
    if (enumerateNiceLocalTimes(start, end, step).length <= cap) return step;
  }
  return last;
}

function labelKindForStep(
  kind: TrendAxisLabelKind,
  stepMs: number,
): TrendAxisLabelKind {
  if (kind === "hm") return "hm";
  if (isDayStep(stepMs)) return "md";
  if (kind === "md") return "md";
  return "md-hm";
}

function minorStepMsFor(majorStepMs: number): number | null {
  if (majorStepMs >= 7 * DAY_MS) return DAY_MS;
  if (majorStepMs >= 2 * DAY_MS) return DAY_MS;
  if (majorStepMs >= DAY_MS) return 6 * 60 * 60 * 1000;
  if (majorStepMs >= 6 * 60 * 60 * 1000) return 60 * 60 * 1000;
  if (majorStepMs >= 60 * 60 * 1000) return 15 * 60 * 1000;
  return null;
}

export type TrendAxisMarks = {
  majors: TrendBrushAxisTick[];
  /** 글자 없는 보조 눈금 (0=왼쪽, 1=오른쪽) */
  minors: number[];
};

/**
 * 격자 눈금만. 구간 끝의 격자 밖 날짜는 붙이지 않는다.
 * 파싱 실패 시 인덱스 등간격 메이저만.
 */
export function buildTrendAxisMarks(
  categories: string[],
  tickCount: number,
  now = new Date(),
): TrendAxisMarks {
  const labels = categories.filter((c) => c.trim());
  const n = labels.length;
  if (n <= 0) return { majors: [], minors: [] };
  if (n === 1) {
    return { majors: [{ t: 0.5, fullLabel: labels[0]! }], minors: [] };
  }

  const maxTicks = Math.max(2, Math.min(12, Math.floor(tickCount) || 2));
  const startLabel = labels[0]!;
  const endLabel = labels[n - 1]!;
  const kind = pickTrendAxisLabelKind(startLabel, endLabel);
  const year = now.getFullYear();
  const startAt = kind ? trendAxisLabelToDate(startLabel, year) : null;
  let endAt = kind ? trendAxisLabelToDate(endLabel, year) : null;

  if (startAt && endAt && endAt.getTime() <= startAt.getTime()) {
    if (kind === "hm") {
      endAt = new Date(endAt.getTime() + DAY_MS);
    } else {
      endAt = trendAxisLabelToDate(endLabel, year + 1);
    }
  }

  if (kind && startAt && endAt && endAt.getTime() > startAt.getTime()) {
    const span = endAt.getTime() - startAt.getTime();
    const stepMs = pickNiceStepMs(startAt, endAt, maxTicks);
    let times = enumerateNiceLocalTimes(startAt, endAt, stepMs);
    if (times.length === 0) {
      const mid = new Date(startAt.getTime() + span / 2);
      times = [ceilToNiceLocal(mid, stepMs)];
    }
    const outKind = labelKindForStep(kind, stepMs);
    const majors = times.map((at) => {
      const rawT = (at.getTime() - startAt.getTime()) / span;
      const t = Math.min(1, Math.max(0, rawT));
      return { t, fullLabel: formatTrendAxisDate(at, outKind) };
    });
    const minorStep = minorStepMsFor(stepMs);
    const minors: number[] = [];
    if (minorStep != null) {
      const minorTimes = enumerateNiceLocalTimes(startAt, endAt, minorStep);
      for (const at of minorTimes) {
        const t = Math.min(
          1,
          Math.max(0, (at.getTime() - startAt.getTime()) / span),
        );
        if (t > 0.996) continue;
        const onMajor = majors.some((m) => Math.abs(m.t - t) < 0.004);
        if (!onMajor) minors.push(t);
      }
    }
    return { majors, minors };
  }

  const majors: TrendBrushAxisTick[] = [];
  for (let k = 0; k < maxTicks; k++) {
    const t = k / (maxTicks - 1);
    const idx = Math.round(t * (n - 1));
    majors.push({ t, fullLabel: labels[idx]! });
  }
  if (majors[0]) majors[0].fullLabel = startLabel;
  if (majors[majors.length - 1]) {
    majors[majors.length - 1]!.fullLabel = endLabel;
  }
  return { majors, minors: [] };
}

export function buildBrushAlignedAxisTicks(
  categories: string[],
  tickCount: number,
  now = new Date(),
): TrendBrushAxisTick[] {
  return buildTrendAxisMarks(categories, tickCount, now).majors;
}

/**
 * X축 tick 표시용 축약.
 * categories는 풀 라벨(호버/툴팁용)을 유지하고, tick만 축약.
 *
 * - 24h: 양끝 `HH:mm` · 중간 `HH` (categories는 `M/D HH:mm` — 월/일은 tick에 노출 안 함)
 *   자정 넘김 틱만 `M/D HH`로 일 맥락 유지.
 * - 7d/30d: 월이 바뀌는 틱(또는 1일) → `N월`, 그 외 → 일 숫자만.
 *   구간 첫 틱이 월 중이면 `M/D`로 월 맥락 유지.
 */
export function abbreviateTrendAxisLabel(
  period: TrendPeriodId,
  fullLabel: string,
  opts: { endpoint: boolean; prevLabel?: string | null },
): string {
  if (!fullLabel) return fullLabel;

  if (period === "24h") {
    const t = parseTrendAxisTimeLabel(fullLabel);
    if (!t) return fullLabel;
    const hh = String(t.hour).padStart(2, "0");
    const mm = String(t.minute).padStart(2, "0");
    const prev = opts.prevLabel
      ? parseTrendAxisTimeLabel(opts.prevLabel)
      : null;
    const dayChanged =
      prev != null &&
      t.month > 0 &&
      (prev.month !== t.month || prev.day !== t.day);

    if (opts.endpoint) {
      return `${hh}:${mm}`;
    }
    if (dayChanged) {
      return `${t.month}/${t.day} ${hh}`;
    }
    return hh;
  }

  const cur = parseTrendAxisMdLabel(fullLabel);
  if (!cur) return fullLabel;

  const prev = opts.prevLabel ? parseTrendAxisMdLabel(opts.prevLabel) : null;
  const monthChanged = !prev || prev.month !== cur.month;

  if (monthChanged) {
    // 1일에만 `N월`. 8/6 같은 월 중 경계는 M/D (8월로 보이면 1일로 오해).
    if (cur.day === 1) return `${cur.month}월`;
    return `${cur.month}/${cur.day}`;
  }
  return String(cur.day);
}

function padTrendAxis2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * X축 2줄: 날짜 행 + 시간 행.
 * 같은 날은 날짜를 반복하지 않는다. 정각은 분 생략.
 */
export function formatTrendAxisTickParts(
  _period: TrendPeriodId,
  fullLabel: string,
  opts: {
    endpoint: boolean;
    prevLabel?: string | null;
    stacked?: boolean;
  },
): { date: string | null; time: string | null } {
  if (!fullLabel) return { date: null, time: null };

  const clock = parseTrendAxisTimeLabel(fullLabel);
  const md = parseTrendAxisMdLabel(fullLabel);
  const hasClock =
    clock != null &&
    (fullLabel.includes(":") || /\/\d{1,2}\s+\d/.test(fullLabel));
  const prevMd = opts.prevLabel
    ? parseTrendAxisMdLabel(opts.prevLabel)
    : null;
  const showDate =
    md != null &&
    md.month > 0 &&
    (prevMd == null ||
      prevMd.month !== md.month ||
      prevMd.day !== md.day);

  if (hasClock && clock) {
    const hh = padTrendAxis2(clock.hour);
    const mm = padTrendAxis2(clock.minute);
    const time = clock.minute === 0 ? hh : `${hh}:${mm}`;
    return {
      date: showDate && md ? `${md.month}/${md.day}` : null,
      time,
    };
  }

  if (md) {
    return {
      date: showDate ? `${md.month}/${md.day}` : null,
      time: null,
    };
  }
  return { date: null, time: fullLabel };
}

/**
 * X축 tick 줄.
 * stacked: [날짜?, 시간]. 한 줄은 날짜가 있을 때만 앞에 붙인다.
 */
export function formatTrendAxisTickLines(
  period: TrendPeriodId,
  fullLabel: string,
  opts: {
    endpoint: boolean;
    prevLabel?: string | null;
    stacked?: boolean;
  },
): string[] {
  if (!opts.stacked) {
    if (!fullLabel) return [];
    const parts = formatTrendAxisTickParts(period, fullLabel, opts);
    if (parts.date && parts.time) return [`${parts.date} ${parts.time}`];
    if (parts.time) return [parts.time];
    return [abbreviateTrendAxisLabel(period, fullLabel, opts)];
  }

  const parts = formatTrendAxisTickParts(period, fullLabel, opts);
  if (parts.date && parts.time) return [parts.date, parts.time];
  if (parts.time) return [parts.time];
  if (parts.date) return [parts.date];
  return [];
}

/** 구간 줌 칩 — `8/3 ~ 5` (같은 달이면 끝쪽 월 생략). 24h는 `HH:mm ~ HH:mm`. */
export function formatTrendScopeRangeLabel(
  startLabel: string,
  endLabel: string,
): string {
  const start = startLabel.trim();
  const end = endLabel.trim();
  if (!start && !end) return "…";
  if (!start) return end;
  if (!end) return start;

  const startHm = start.match(/\s(\d{1,2}:\d{2})$/)?.[1];
  const endHm = end.match(/\s(\d{1,2}:\d{2})$/)?.[1];
  if (startHm && endHm) {
    return `${startHm} ~ ${endHm}`;
  }

  if (/^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
    return `${start} ~ ${end}`;
  }

  const a = parseTrendAxisMdLabel(start);
  const b = parseTrendAxisMdLabel(end);
  if (!a || !b) return `${start} ~ ${end}`;

  const startHour = start.match(/\s+(\d{1,2})$/)?.[1];
  const endHour = end.match(/\s+(\d{1,2})$/)?.[1];
  const left = startHour
    ? `${a.month}/${a.day} ${startHour}`
    : `${a.month}/${a.day}`;
  const right =
    a.month === b.month
      ? endHour
        ? `${b.day} ${endHour}`
        : String(b.day)
      : endHour
        ? `${b.month}/${b.day} ${endHour}`
        : `${b.month}/${b.day}`;
  return `${left} ~ ${right}`;
}

