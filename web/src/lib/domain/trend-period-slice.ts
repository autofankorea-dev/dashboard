/**
 * Longer period → shorter tail — 동일 bucket·stride only.
 * Hub·PDF: 30d 1h → 7d 1h. 15분 축은 줌 창·테스트만 TREND_15M_PERIODS.
 */
import {
  TREND_PERIODS,
  emptyTrendPeriodData,
  type TrendControllerPeriodData,
  type TrendControllerSeries,
  type TrendPeriodConfig,
  type TrendPeriodData,
  type TrendPeriodId,
  type TrendStallSeries,
} from "@/lib/domain/farm-trend-types";
import { sliceChannelThermo } from "@/lib/farm/channel-thermo";

type PeriodTable = Record<TrendPeriodId, TrendPeriodConfig>;

function sliceNumericCols<T extends TrendStallSeries>(
  series: T,
  start: number,
  count: number,
): T {
  const sliced = {
    ...series,
    temp: series.temp.slice(start, start + count),
    humidity: series.humidity.slice(start, start + count),
    fanA: series.fanA.slice(start, start + count),
    fanB: series.fanB.slice(start, start + count),
    fanC: series.fanC.slice(start, start + count),
    fanSupply: series.fanSupply.slice(start, start + count),
    fanExhaust: series.fanExhaust.slice(start, start + count),
    fanIntake: series.fanIntake.slice(start, start + count),
    sampleCount: series.sampleCount.slice(start, start + count),
  } as T;
  if (!("controllerKey" in series)) return sliced;
  const ctrl = series as unknown as TrendControllerSeries;
  if (!ctrl.thermoA && !ctrl.thermoB && !ctrl.thermoC) {
    return sliced;
  }
  const end = start + count;
  return {
    ...sliced,
    thermoA: sliceChannelThermo(ctrl.thermoA, start, end),
    thermoB: sliceChannelThermo(ctrl.thermoB, start, end),
    thermoC: sliceChannelThermo(ctrl.thermoC, start, end),
  };
}

function tailSliceStart(
  sourceLength: number,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
  periods: PeriodTable = TREND_PERIODS,
): number | null {
  const dstCfg = periods[targetPeriod];
  if (sourceLength < dstCfg.bucketCount) return null;
  return sourceLength - dstCfg.bucketCount;
}

/** 동일 bucket·stride 인 더 짧은 기간 tail. 30d 1h → 24h 15m 은 null. */
export function sliceControllerTrendFromLonger(
  source: TrendControllerPeriodData,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
  periods: PeriodTable = TREND_PERIODS,
): TrendControllerPeriodData | null {
  if (source.period === targetPeriod) return source;
  const srcCfg = periods[source.period];
  const dstCfg = periods[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;

  const start = tailSliceStart(source.bucketAts.length, targetPeriod, periods);
  if (start == null) return null;

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    ...s,
    stalls: s.stalls.map((st) => ({
      stallNo: st.stallNo,
      controllers: st.controllers.map((c) => {
        const sliced = sliceNumericCols(c, start, dstCfg.bucketCount);
        totalSamples += sliced.sampleCount.reduce((a, n) => a + n, 0);
        return sliced as TrendControllerSeries;
      }),
    })),
  }));

  return {
    period: targetPeriod,
    categories: source.categories.slice(start),
    bucketAts: source.bucketAts.slice(start),
    sp,
    totalSamples,
  };
}

export function sliceStallTrendFromLonger(
  source: TrendPeriodData,
  targetPeriod: Exclude<TrendPeriodId, "30d">,
  periods: PeriodTable = TREND_PERIODS,
): TrendPeriodData | null {
  if (source.period !== "30d") return null;
  const srcCfg = periods[source.period];
  const dstCfg = periods[targetPeriod];
  if (srcCfg.bucket !== dstCfg.bucket) return null;
  if (srcCfg.strideMs !== dstCfg.strideMs) return null;

  const start = tailSliceStart(source.bucketAts.length, targetPeriod, periods);
  if (start == null) return null;

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    ...s,
    stalls: s.stalls.map((st) => {
      const sliced = sliceNumericCols(st, start, dstCfg.bucketCount);
      totalSamples += sliced.sampleCount.reduce((a, n) => a + n, 0);
      return sliced;
    }),
  }));

  return {
    period: targetPeriod,
    categories: source.categories.slice(start),
    bucketAts: source.bucketAts.slice(start),
    sp,
    totalSamples,
  };
}

/** 구간 15분 — bucketAt 이 [fromMs, toMs) 인 칸만. */
export function sliceControllerTrendByTime(
  source: TrendControllerPeriodData,
  fromMs: number,
  toMs: number,
): TrendControllerPeriodData | null {
  if (!(toMs > fromMs) || source.bucketAts.length < 2) return null;
  let start = 0;
  let end = source.bucketAts.length;
  for (let i = 0; i < source.bucketAts.length; i++) {
    const t = Date.parse(source.bucketAts[i] ?? "");
    if (!Number.isFinite(t)) continue;
    if (t < fromMs) start = i + 1;
    if (t < toMs) end = i + 1;
  }
  if (end - start < 2) return null;
  if (start === 0 && end === source.bucketAts.length) return source;

  let totalSamples = 0;
  const count = end - start;
  const sp = source.sp.map((s) => ({
    ...s,
    stalls: s.stalls.map((st) => ({
      stallNo: st.stallNo,
      controllers: st.controllers.map((c) => {
        const sliced = sliceNumericCols(c, start, count);
        totalSamples += sliced.sampleCount.reduce((a, n) => a + n, 0);
        return sliced as TrendControllerSeries;
      }),
    })),
  }));

  return {
    period: source.period,
    categories: source.categories.slice(start, end),
    bucketAts: source.bucketAts.slice(start, end),
    sp,
    totalSamples,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** sampleCount-weighted mean — stall RPC `avg()` over the same rows. */
function weightedSlotAvg(
  values: (number | null)[],
  weights: number[],
): number | null {
  let wsum = 0;
  let nsum = 0;
  let unweighted = 0;
  let unweightedN = 0;
  const len = Math.min(values.length, weights.length);
  for (let i = 0; i < len; i++) {
    const v = values[i];
    if (v == null) continue;
    const w = weights[i] ?? 0;
    unweighted += v;
    unweightedN += 1;
    if (w > 0) {
      wsum += v * w;
      nsum += w;
    }
  }
  if (nsum > 0) return round1(wsum / nsum);
  if (unweightedN > 0) return round1(unweighted / unweightedN);
  return null;
}

function avgStallFromControllers(
  controllers: TrendControllerSeries[],
  bucketCount: number,
  stallNo: string,
): TrendStallSeries {
  const temp: (number | null)[] = new Array(bucketCount).fill(null);
  const humidity: (number | null)[] = new Array(bucketCount).fill(null);
  const fanA: (number | null)[] = new Array(bucketCount).fill(null);
  const fanB: (number | null)[] = new Array(bucketCount).fill(null);
  const fanC: (number | null)[] = new Array(bucketCount).fill(null);
  const fanSupply: (number | null)[] = new Array(bucketCount).fill(null);
  const fanExhaust: (number | null)[] = new Array(bucketCount).fill(null);
  const fanIntake: (number | null)[] = new Array(bucketCount).fill(null);
  const sampleCount = new Array<number>(bucketCount).fill(0);

  for (let i = 0; i < bucketCount; i++) {
    const temps: (number | null)[] = [];
    const hums: (number | null)[] = [];
    const aVals: (number | null)[] = [];
    const bVals: (number | null)[] = [];
    const cVals: (number | null)[] = [];
    const supplies: (number | null)[] = [];
    const exhausts: (number | null)[] = [];
    const intakes: (number | null)[] = [];
    const weights: number[] = [];
    for (const c of controllers) {
      temps.push(c.temp[i] ?? null);
      hums.push(c.humidity[i] ?? null);
      aVals.push(c.fanA[i] ?? null);
      bVals.push(c.fanB[i] ?? null);
      cVals.push(c.fanC[i] ?? null);
      supplies.push(c.fanSupply[i] ?? null);
      exhausts.push(c.fanExhaust[i] ?? null);
      intakes.push(c.fanIntake[i] ?? null);
      weights.push(c.sampleCount[i] ?? 0);
    }
    temp[i] = weightedSlotAvg(temps, weights);
    humidity[i] = weightedSlotAvg(hums, weights);
    fanA[i] = weightedSlotAvg(aVals, weights);
    fanB[i] = weightedSlotAvg(bVals, weights);
    fanC[i] = weightedSlotAvg(cVals, weights);
    fanSupply[i] = weightedSlotAvg(supplies, weights);
    fanExhaust[i] = weightedSlotAvg(exhausts, weights);
    fanIntake[i] = weightedSlotAvg(intakes, weights);
    sampleCount[i] = weights.reduce((a, n) => a + n, 0);
  }

  return {
    stallNo,
    temp,
    humidity,
    fanA,
    fanB,
    fanC,
    fanSupply,
    fanExhaust,
    fanIntake,
    sampleCount,
  };
}

/** 컨트롤러 버킷 → 축사 평균 (히트맵). 별도 stall RPC 없음. */
export function stallTrendFromControllerPeriod(
  source: TrendControllerPeriodData,
): TrendPeriodData {
  const bucketCount = source.categories.length;
  if (bucketCount === 0) return emptyTrendPeriodData(source.period);

  let totalSamples = 0;
  const sp = source.sp.map((s) => ({
    stallTyCode: s.stallTyCode,
    label: s.label,
    stalls: s.stalls.map((st) => {
      const stall = avgStallFromControllers(
        st.controllers,
        bucketCount,
        st.stallNo,
      );
      totalSamples += stall.sampleCount.reduce((a, n) => a + n, 0);
      return stall;
    }),
  }));

  return {
    period: source.period,
    categories: source.categories,
    bucketAts: source.bucketAts,
    sp,
    totalSamples,
  };
}

export function stallTrendBundleFromController(
  bundle: Record<TrendPeriodId, TrendControllerPeriodData>,
): Record<TrendPeriodId, TrendPeriodData> {
  return {
    "24h": stallTrendFromControllerPeriod(bundle["24h"]),
    "7d": stallTrendFromControllerPeriod(bundle["7d"]),
    "30d": stallTrendFromControllerPeriod(bundle["30d"]),
  };
}
