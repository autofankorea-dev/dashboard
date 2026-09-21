import { type BrushWindow } from "@/components/farm/unified-trend-period-brush";
import type { AlarmSettings, AlarmThresholds } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { snapToStep } from "@/lib/controllers/controller-panel-map";
import {
  TREND_MINI_STRIDE_MS,
  TREND_PERIODS,
  isContextControllerTrend30d,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { envComfortScore } from "@/lib/farm/env-comfort-score";
import {
  findControllerTrendSeries,
  resolveReadingAlarmThresholds,
} from "@/lib/farm/controller-summary-display";
import {
  applyUplinkCoverageToSeries,
  pickUplinkCoverageIndex,
  type UplinkCoverageIndex,
} from "@/lib/farm/trend-uplink-coverage";
import {
  downsampleByIndices,
  pickLttbIndices,
  targetChartDisplayBars,
} from "@/lib/farm/trend-display-buckets";
import {
  downsampleThermoByIndices,
  sliceChannelThermo,
  type ChannelThermoVec,
} from "@/lib/farm/channel-thermo";

/**
 * UnifiedBarnTrendPanel의 순수 계산 헬퍼.
 *
 * `unified-barn-trend-panel.tsx`에서 분리(동작 보존). 시리즈 슬라이스·
 * 다운샘플·커버리지 적용·알람 드래프트 스냅 등 React 상태에 의존하지 않는
 * 순수 로직만 모은다.
 */

const TEMP_STEP = 0.1;

/** 현장 알람 구간 — 기준±편차, 투명 정상색 띠만(분리 보기) */
export const FARM_ALARM_RANGE_FILL = "var(--status-ok)";
export const FARM_ALARM_RANGE_FILL_OPACITY = 0.22;
/** 오버레이 — 온·습 각자 채널색. 겹치면 source-over로 조금 더 진해진다. */
export const FARM_ALARM_RANGE_TEMP_OVERLAY_OPACITY = 0.2;
export const FARM_ALARM_RANGE_HUM_OVERLAY_OPACITY = 0.16;

export function farmAlarmMidValue(lo: number, hi: number): number | null {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return null;
  return (lo + hi) / 2;
}

/**
 * 차트 스케일 라벨 id → 알람 상·하한.
 * `temp-hi`는 권장 띠가 없을 때. `temp-farm-hi`는 현장 알람 편차 커밋용.
 */
export const SCALE_EDGE_ALARM_KEY: Record<string, keyof AlarmThresholds> = {
  "temp-hi": "tempHigh",
  "temp-lo": "tempLow",
  "hum-hi": "humidityHigh",
  "hum-lo": "humidityLow",
  "temp-farm-hi": "tempHigh",
  "temp-farm-lo": "tempLow",
  "hum-farm-hi": "humidityHigh",
  "hum-farm-lo": "humidityLow",
};
const HUM_STEP = 1;
const TEMP_MIN = 10;
const TEMP_MAX = 35;
const HUM_MIN = 0;
const HUM_MAX = 100;

export function sliceControllerSeries(
  series: TrendControllerSeries,
  from: number,
  to: number,
): TrendControllerSeries {
  return {
    ...series,
    temp: series.temp.slice(from, to),
    humidity: series.humidity.slice(from, to),
    fanA: series.fanA.slice(from, to),
    fanB: series.fanB.slice(from, to),
    fanC: series.fanC.slice(from, to),
    fanSupply: series.fanSupply.slice(from, to),
    fanExhaust: series.fanExhaust.slice(from, to),
    fanIntake: series.fanIntake.slice(from, to),
    sampleCount: series.sampleCount.slice(from, to),
    uplinkKind: series.uplinkKind?.slice(from, to),
    thermoA: sliceChannelThermo(series.thermoA, from, to),
    thermoB: sliceChannelThermo(series.thermoB, from, to),
    thermoC: sliceChannelThermo(series.thermoC, from, to),
  };
}

export function brushSliceRange(
  length: number,
  win: BrushWindow,
): { from: number; to: number } {
  const from = Math.max(0, Math.min(length - 2, Math.floor(win.start * length)));
  const to = Math.max(
    from + 2,
    Math.min(length, Math.ceil((win.start + win.width) * length)),
  );
  return { from, to };
}

function meanTempDriver(
  seriesList: TrendControllerSeries[],
  len: number,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: len }, () => null);
  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;
    for (const s of seriesList) {
      const v = s.temp[i];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

export function downsampleSeriesForChart(
  seriesList: TrendControllerSeries[],
  categories: string[],
  plotWidthPx: number,
): { seriesList: TrendControllerSeries[]; categories: string[] } {
  const bars = targetChartDisplayBars(categories.length, plotWidthPx);
  if (bars >= categories.length) {
    return { seriesList, categories };
  }
  const idx = pickLttbIndices(
    meanTempDriver(seriesList, categories.length),
    bars,
  );
  return {
    categories: downsampleByIndices(categories, idx),
    seriesList: seriesList.map((s) => ({
      ...s,
      temp: downsampleByIndices(s.temp, idx),
      humidity: downsampleByIndices(s.humidity, idx),
      fanA: downsampleByIndices(s.fanA, idx),
      fanB: downsampleByIndices(s.fanB, idx),
      fanC: downsampleByIndices(s.fanC, idx),
      fanSupply: downsampleByIndices(s.fanSupply, idx),
      fanExhaust: downsampleByIndices(s.fanExhaust, idx),
      fanIntake: downsampleByIndices(s.fanIntake, idx),
      sampleCount: downsampleByIndices(s.sampleCount, idx),
      uplinkKind: s.uplinkKind
        ? downsampleByIndices(s.uplinkKind, idx)
        : undefined,
      thermoA: downsampleThermoByIndices(s.thermoA, idx),
      thermoB: downsampleThermoByIndices(s.thermoB, idx),
      thermoC: downsampleThermoByIndices(s.thermoC, idx),
    })),
  };
}

export type ControllerWindowBundle = {
  seriesList: TrendControllerSeries[];
  categories: string[];
  bucketAts: string[];
};

export function controllerWindowHasValues(
  window: ControllerWindowBundle,
): boolean {
  return window.seriesList.some((s) =>
    [s.temp, s.humidity, s.fanA, s.fanB, s.fanC].some((col) =>
      col.some((v) => v != null && Number.isFinite(v)),
    ),
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function avgRange(
  values: (number | null)[],
  from: number,
  to: number,
): number | null {
  let sum = 0;
  let n = 0;
  for (let i = from; i < to; i += 1) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? round1(sum / n) : null;
}

function lastRange<T>(values: T[], from: number, to: number): T | undefined {
  for (let i = to - 1; i >= from; i -= 1) {
    const v = values[i];
    if (v != null) return v;
  }
  return values[to - 1];
}

function binNumericAvg(
  values: (number | null)[],
  group: number,
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i += group) {
    out.push(avgRange(values, i, Math.min(values.length, i + group)));
  }
  return out;
}

function binCountSum(values: number[], group: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i += group) {
    const to = Math.min(values.length, i + group);
    let sum = 0;
    for (let j = i; j < to; j += 1) sum += values[j] ?? 0;
    out.push(sum);
  }
  return out;
}

function binFirst<T>(values: T[], group: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += group) {
    out.push(values[i]!);
  }
  return out;
}

function binLast<T>(values: T[], group: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < values.length; i += group) {
    const to = Math.min(values.length, i + group);
    out.push(lastRange(values, i, to) as T);
  }
  return out;
}

function binThermo(vec: ChannelThermoVec | undefined, group: number) {
  if (!vec) return undefined;
  return {
    setpoint: binLast(vec.setpoint, group),
    deviation: binLast(vec.deviation, group),
    minVent: binLast(vec.minVent, group),
    maxVent: binLast(vec.maxVent, group),
  };
}

function inferBucketStrideMs(bucketAts: string[]): number | null {
  if (bucketAts.length < 2) return null;
  const a = Date.parse(bucketAts[0] ?? "");
  const b = Date.parse(bucketAts[1] ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return b - a;
}

/** 미니 칸 — 15분/1시간 창을 목표 간격(기본 2시간) 평균으로 묶는다. */
export function binControllerWindowToStride(
  window: ControllerWindowBundle,
  targetStrideMs: number = TREND_MINI_STRIDE_MS,
): ControllerWindowBundle {
  const stride = inferBucketStrideMs(window.bucketAts);
  if (
    !stride ||
    targetStrideMs <= stride + 1 ||
    window.categories.length < 2 ||
    window.categories.length !== window.bucketAts.length
  ) {
    return window;
  }
  const group = Math.max(2, Math.round(targetStrideMs / stride));
  if (group <= 1) return window;
  return {
    categories: binFirst(window.categories, group),
    bucketAts: binFirst(window.bucketAts, group),
    seriesList: window.seriesList.map((s) => ({
      ...s,
      temp: binNumericAvg(s.temp, group),
      humidity: binNumericAvg(s.humidity, group),
      fanA: binNumericAvg(s.fanA, group),
      fanB: binNumericAvg(s.fanB, group),
      fanC: binNumericAvg(s.fanC, group),
      fanSupply: binNumericAvg(s.fanSupply, group),
      fanExhaust: binNumericAvg(s.fanExhaust, group),
      fanIntake: binNumericAvg(s.fanIntake, group),
      sampleCount: binCountSum(s.sampleCount, group),
      uplinkKind: s.uplinkKind ? binLast(s.uplinkKind, group) : undefined,
      thermoA: binThermo(s.thermoA, group),
      thermoB: binThermo(s.thermoB, group),
      thermoC: binThermo(s.thermoC, group),
    })),
  };
}

/** 표시 축 인덱스 → 원본 창 슬라이스. */
export function mapIndexWindowToSlice(
  displayLen: number,
  start: number,
  end: number,
  dataLen: number,
): { from: number; to: number } {
  const span = Math.max(1, displayLen - 1);
  const r0 = start / span;
  const r1 = end / span;
  const from = Math.max(0, Math.floor(r0 * (dataLen - 1)));
  const to = Math.min(
    dataLen,
    Math.max(from + 2, Math.ceil(r1 * (dataLen - 1)) + 1),
  );
  return { from, to };
}

export function bucketAtsRangeMs(
  bucketAts: string[],
  from: number,
  to: number,
): { fromMs: number; toMs: number } | null {
  if (bucketAts.length < 1) return null;
  const start = Date.parse(bucketAts[from] ?? "");
  const lastIdx = Math.max(from, Math.min(bucketAts.length, to) - 1);
  const last = Date.parse(bucketAts[lastIdx] ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(last)) return null;
  const stride = inferBucketStrideMs(bucketAts) ?? TREND_PERIODS["30d"].strideMs;
  return { fromMs: start, toMs: last + stride };
}

export function applyCoverageToWindow(
  seriesList: TrendControllerSeries[],
  bucketAts: string[],
  indexes: UplinkCoverageIndex[],
): TrendControllerSeries[] {
  if (!indexes.length || bucketAts.length < 1) return seriesList;
  const fromMs = Date.parse(bucketAts[0] ?? "");
  const last = Date.parse(bucketAts[bucketAts.length - 1] ?? "");
  if (!Number.isFinite(fromMs) || !Number.isFinite(last)) return seriesList;
  const strideMs =
    bucketAts.length > 1
      ? Math.max(1, (last - fromMs) / (bucketAts.length - 1))
      : TREND_PERIODS["24h"].strideMs;
  const coverage = pickUplinkCoverageIndex(indexes, fromMs, strideMs);
  if (!coverage || coverage.byController.size === 0) return seriesList;
  return seriesList.map((s) =>
    applyUplinkCoverageToSeries(s, coverage, bucketAts),
  );
}

function snapStep(n: number, step: number): number {
  return snapToStep(n, step);
}

export function clampAlarmDraft(
  next: AlarmThresholds,
  key: keyof AlarmThresholds,
): AlarmThresholds {
  let { tempLow, tempHigh, humidityLow, humidityHigh } = next;
  if (key === "tempHigh" || key === "tempLow") {
    tempHigh = snapStep(tempHigh, TEMP_STEP);
    tempLow = snapStep(tempLow, TEMP_STEP);
    tempHigh = Math.min(TEMP_MAX, Math.max(TEMP_MIN + TEMP_STEP, tempHigh));
    tempLow = Math.min(TEMP_MAX - TEMP_STEP, Math.max(TEMP_MIN, tempLow));
    if (tempHigh <= tempLow) {
      if (key === "tempHigh") tempHigh = tempLow + TEMP_STEP;
      else tempLow = tempHigh - TEMP_STEP;
    }
  } else {
    humidityHigh = snapStep(humidityHigh, HUM_STEP);
    humidityLow = snapStep(humidityLow, HUM_STEP);
    humidityHigh = Math.min(HUM_MAX, Math.max(HUM_MIN + HUM_STEP, humidityHigh));
    humidityLow = Math.min(HUM_MAX - HUM_STEP, Math.max(HUM_MIN, humidityLow));
    if (humidityHigh <= humidityLow) {
      if (key === "humidityHigh") humidityHigh = humidityLow + HUM_STEP;
      else humidityLow = humidityHigh - HUM_STEP;
    }
  }
  return { tempLow, tempHigh, humidityLow, humidityHigh };
}

/** 30일 브러시 양호도 스파크 — 컨트롤러 실측 평균 */
export function buildTrendBrushOverview(
  controllers: { reading?: BarnReading | null }[],
  controllerTrendByPeriod:
    | Record<TrendPeriodId, TrendControllerPeriodData>
    | null
    | undefined,
  alarmSettings?: AlarmSettings,
): (number | null)[] {
  if (!isContextControllerTrend30d(controllerTrendByPeriod?.["30d"])) {
    return [];
  }
  const paired = controllers
    .map((c) => {
      const r = c.reading;
      if (!r) return null;
      const series = findControllerTrendSeries(
        controllerTrendByPeriod,
        "30d",
        r.stallTyCode,
        r.stallNo,
        r.controllerKey,
      );
      if (!series) return null;
      return {
        series,
        thresholds: resolveReadingAlarmThresholds(r, alarmSettings),
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
  if (!paired.length) return [];
  const len = Math.max(
    ...paired.map((p) =>
      Math.max(p.series.temp?.length ?? 0, p.series.humidity?.length ?? 0),
    ),
  );
  const out: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    const scores: number[] = [];
    for (const p of paired) {
      const s = envComfortScore(
        p.series.temp?.[i],
        p.series.humidity?.[i],
        p.thresholds,
      );
      if (s != null) scores.push(s);
    }
    out.push(
      scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    );
  }
  return out;
}

export type BrushOverviewMode = "comfort" | "dual";

export type SharedBrushOverview = {
  values: (number | null)[];
  /** 두 칸일 때 아래칸 양호도 */
  secondaryValues: (number | null)[] | null;
  mode: BrushOverviewMode;
};

type BrushOverviewController = { reading?: BarnReading | null };

export function pickSharedBrushOverviewKind(
  hasTop: boolean,
  hasBottom: boolean,
): "top" | "bottom" | "dual" | "farm" {
  if (hasTop && hasBottom) return "dual";
  if (hasTop) return "top";
  if (hasBottom) return "bottom";
  return "farm";
}

/** 두 시계열을 같은 길이에 맞춘다. 빈 칸은 null. */
export function alignBrushScoreSeries(
  top: (number | null)[],
  bottom: (number | null)[],
): { top: (number | null)[]; bottom: (number | null)[] } {
  const n = Math.max(top.length, bottom.length);
  return {
    top: Array.from({ length: n }, (_, i) => top[i] ?? null),
    bottom: Array.from({ length: n }, (_, i) => bottom[i] ?? null),
  };
}

/**
 * 공유 브러시 막대.
 * 한 칸 → 그 양호도. 두 칸 → 위·아래 이중 막대. 둘 다 비면 농장 평균.
 */
export function buildSharedWidgetBrushOverview(
  top: BrushOverviewController[],
  bottom: BrushOverviewController[],
  farm: BrushOverviewController[],
  controllerTrendByPeriod:
    | Record<TrendPeriodId, TrendControllerPeriodData>
    | null
    | undefined,
  alarmSettings?: AlarmSettings,
): SharedBrushOverview {
  const topLive = top.filter((c) => c.reading);
  const bottomLive = bottom.filter((c) => c.reading);
  const kind = pickSharedBrushOverviewKind(
    topLive.length > 0,
    bottomLive.length > 0,
  );
  if (kind === "dual") {
    const aligned = alignBrushScoreSeries(
      buildTrendBrushOverview(
        topLive,
        controllerTrendByPeriod,
        alarmSettings,
      ),
      buildTrendBrushOverview(
        bottomLive,
        controllerTrendByPeriod,
        alarmSettings,
      ),
    );
    return {
      mode: "dual",
      values: aligned.top,
      secondaryValues: aligned.bottom,
    };
  }
  const source =
    kind === "top" ? topLive : kind === "bottom" ? bottomLive : farm;
  return {
    mode: "comfort",
    values: buildTrendBrushOverview(
      source,
      controllerTrendByPeriod,
      alarmSettings,
    ),
    secondaryValues: null,
  };
}
