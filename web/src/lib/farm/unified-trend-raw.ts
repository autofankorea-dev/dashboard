/**
 * 레이아웃과 무관한 통합 추세 집계.
 *
 * 평균·EMA·편차·산포는 여기서 한 번 계산한다.
 * split-Y 매핑은 부르지만, 시리즈 조립 결과는 모른다.
 * 공개 이름은 배럴이 다시 내보내 기존 import 경로를 유지한다.
 */
import type { AlarmThresholds } from "@/lib/domain/alarms";
import { normalizeEqpmnNo } from "@/lib/domain/controller-key";
import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";
import type {
  TrendSpreadContributor,
  TrendSpreadExtremes,
} from "@/lib/domain/trend-chart-types";
import {
  absFanWindows,
  emptyChannelThermo,
  hasFiniteWindow,
  type FanControlWindow,
} from "@/lib/farm/channel-thermo";
import {
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";
import { fitTempDisplayDomain } from "./unified-barn-trend-layout";
import type { SplitYVisibility } from "./unified-barn-trend-layout";
import {
  humidityAlarmMidpoint,
  paddedAlarmDomain,
  tempAlarmMidpoint,
} from "./unified-trend-split-y";

/** 닿음 허용 (부동소수). 코리도 판정과 같은 값이며 배럴과 순환하지 않게 둔다. */
const BREACH_TOUCH_EPS = 1e-6;

function avgFinite(nums: (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of nums) {
    if (v != null && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n ? sum / n : null;
}

/** 미소 편차는 숨겨 면 채움처럼 보이지 않게 */
export const DEV_HIDE_ABS_C = 0.3;
export const HUM_DEV_HIDE_ABS = 0.5;
const EMA_SHORT_PERIOD = 5;
const EMA_LONG_PERIOD = 14;

/** 단순 EMA — null은 건너뛰고 직전 상태 유지하지 않음(갭 반영). */
export function computeEmaSeries(
  values: (number | null)[],
  period: number,
): (number | null)[] {
  const out = new Array<number | null>(values.length).fill(null);
  if (period < 1) return out;
  const k = 2 / (period + 1);
  let ema: number | null = null;
  let seedSum = 0;
  let seedN = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    if (ema == null) {
      seedSum += v;
      seedN += 1;
      if (seedN >= period) {
        ema = seedSum / seedN;
        out[i] = ema;
      } else {
        out[i] = null;
      }
      continue;
    }
    ema = v * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function avgColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): (number | null)[] {
  const out = new Array<number | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    out[i] = avgFinite(slot);
  }
  return out;
}

function contributorLabel(c: TrendControllerSeries): {
  zoneLabel: string;
  equipmentLabel: string;
} {
  const eq = normalizeEqpmnNo(c.eqpmnNo ?? "01");
  const stall = (c.stallNo ?? "").trim() || "—";
  return {
    zoneLabel: c.zoneLabel?.trim() || "구역",
    equipmentLabel: c.equipmentLabel?.trim() || `${stall}번 축사 ${eq}`,
  };
}

function toContributor(
  c: TrendControllerSeries,
  value: number,
  breached?: boolean,
): TrendSpreadContributor {
  const labels = contributorLabel(c);
  const stallNo = (c.stallNo ?? "").trim();
  const stallTyCode = (c.stallTyCode ?? "").trim();
  return {
    zoneLabel: labels.zoneLabel,
    equipmentLabel: labels.equipmentLabel,
    value,
    breached,
    stallTyCode: stallTyCode || undefined,
    stallNo: stallNo || undefined,
    controllerKey: c.controllerKey || undefined,
  };
}

function minMaxColumns(
  seriesList: TrendControllerSeries[],
  pick: (c: TrendControllerSeries) => (number | null)[],
  len: number,
): {
  min: (number | null)[];
  max: (number | null)[];
  minAt: (TrendSpreadContributor | null)[];
  maxAt: (TrendSpreadContributor | null)[];
} {
  const min = new Array<number | null>(len).fill(null);
  const max = new Array<number | null>(len).fill(null);
  const minAt = new Array<TrendSpreadContributor | null>(len).fill(null);
  const maxAt = new Array<TrendSpreadContributor | null>(len).fill(null);
  for (let i = 0; i < len; i++) {
    let minV: number | null = null;
    let maxV: number | null = null;
    let minC: TrendControllerSeries | null = null;
    let maxC: TrendControllerSeries | null = null;
    for (const c of seriesList) {
      const v = pick(c)[i];
      if (v == null || !Number.isFinite(v)) continue;
      if (minV == null || v < minV) {
        minV = v;
        minC = c;
      }
      if (maxV == null || v > maxV) {
        maxV = v;
        maxC = c;
      }
    }
    if (minV != null && minC) {
      min[i] = minV;
      minAt[i] = toContributor(minC, minV);
    }
    if (maxV != null && maxC) {
      max[i] = maxV;
      maxAt[i] = toContributor(maxC, maxV);
    }
  }
  return { min, max, minAt, maxAt };
}

/** 임계 접촉·초과 플래그 부여 */
function markSpreadBreaches(
  high: (TrendSpreadContributor | null)[],
  low: (TrendSpreadContributor | null)[],
  thresholdHigh: number,
  thresholdLow: number,
): TrendSpreadExtremes {
  return {
    high: high.map((c) =>
      c == null
        ? null
        : {
            ...c,
            breached: c.value >= thresholdHigh - BREACH_TOUCH_EPS,
          },
    ),
    low: low.map((c) =>
      c == null
        ? null
        : {
            ...c,
            breached: c.value <= thresholdLow + BREACH_TOUCH_EPS,
          },
    ),
  };
}

export function hasFinite(data: (number | null)[]): boolean {
  return data.some((v) => v != null && Number.isFinite(v));
}

export type UnifiedMetricAvailability = {
  temp: boolean;
  hum: boolean;
  motors: boolean;
};

const EMPTY_METRIC_AVAILABILITY: UnifiedMetricAvailability = {
  temp: false,
  hum: false,
  motors: false,
};

/** 시계열이 있는 지표만 칸·아이콘을 연다. 툴바 아이콘은 없어도 회색으로 남긴다. */
export function metricAvailabilityFromSeriesList(
  list: Pick<
    TrendControllerSeries,
    "temp" | "humidity" | "fanA" | "fanB" | "fanC"
  >[],
): UnifiedMetricAvailability {
  if (!list.length) return EMPTY_METRIC_AVAILABILITY;
  return {
    temp: list.some((s) => hasFinite(s.temp)),
    hum: list.some((s) => hasFinite(s.humidity)),
    motors: list.some(
      (s) => hasFinite(s.fanA) || hasFinite(s.fanB) || hasFinite(s.fanC),
    ),
  };
}

export function andSplitYVisibility(
  visibility: SplitYVisibility,
  metrics: UnifiedMetricAvailability,
): SplitYVisibility {
  return {
    showTemp: visibility.showTemp && metrics.temp,
    showHum: visibility.showHum && metrics.hum,
    showMotors: visibility.showMotors && metrics.motors,
    showCommand: visibility.showCommand,
  };
}

function thermoWindowsFromSeries(
  list: TrendControllerSeries[],
  includeThermo: boolean,
): UnifiedBarnTrendRaw["thermoWindows"] {
  if (!includeThermo || list.length !== 1) return null;
  const series = list[0]!;
  const len = series.temp.length;
  const w = absFanWindows(
    series.thermoA ?? emptyChannelThermo(len),
    series.thermoB ?? emptyChannelThermo(len),
    series.thermoC ?? emptyChannelThermo(len),
  );
  if (!hasFiniteWindow(w.a) && !hasFiniteWindow(w.b) && !hasFiniteWindow(w.c)) {
    return null;
  }
  return w;
}

/**
 * layout 무관 집계(평균·EMA·편차). M1 — 보간 rAF마다 재실행하지 않음.
 */
export type UnifiedBarnTrendRaw = {
  categories: string[];
  controllerCount: number;
  thresholds: AlarmThresholds;
  tempLow: number;
  tempHigh: number;
  humidityLow: number;
  humidityHigh: number;
  tempMid: number;
  humMid: number;
  fanA: (number | null)[];
  fanB: (number | null)[];
  fanC: (number | null)[];
  fanMaxRaw: (number | null)[];
  tempAvg: (number | null)[];
  humAvg: (number | null)[];
  tempMin: (number | null)[];
  tempMax: (number | null)[];
  humMin: (number | null)[];
  humMax: (number | null)[];
  /** 시점별 온도 산포 상·하단 기여자 */
  tempSpreadExtremes: TrendSpreadExtremes;
  /** 시점별 습도 산포 상·하단 기여자 */
  humSpreadExtremes: TrendSpreadExtremes;
  emaShortRaw: (number | null)[];
  emaLongRaw: (number | null)[];
  humEmaShortRaw: (number | null)[];
  humEmaLongRaw: (number | null)[];
  tempDevRaw: (number | null)[];
  humDevRaw: (number | null)[];
  tempDevOpacity: (number | null)[];
  humDevOpacity: (number | null)[];
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thermoWindows: {
    a: FanControlWindow;
    b: FanControlWindow;
    c: FanControlWindow;
  } | null;
};

export function tempDisplayDomainFromRaw(
  raw: Pick<
    UnifiedBarnTrendRaw,
    | "tempAvg"
    | "tempMin"
    | "tempMax"
    | "emaShortRaw"
    | "emaLongRaw"
    | "tempLow"
    | "tempHigh"
  >,
): [number, number] {
  return fitTempDisplayDomain(
    [raw.tempAvg, raw.tempMin, raw.tempMax, raw.emaShortRaw, raw.emaLongRaw],
    paddedAlarmDomain(raw.tempLow, raw.tempHigh),
  );
}

export function aggregateUnifiedBarnTrendRaw(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
  options?: { includeThermo?: boolean },
): UnifiedBarnTrendRaw | null {
  const len = categories.length;
  if (!len || !controllerSeriesList.length) return null;

  const { tempLow, tempHigh, humidityLow, humidityHigh } = thresholds;
  const tempMid = tempAlarmMidpoint(tempLow, tempHigh);
  const humMid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  const tempAlarmHalfSpan = Math.max((tempHigh - tempLow) / 2, 1e-6);
  const humAlarmHalfSpan = Math.max((humidityHigh - humidityLow) / 2, 1e-6);

  // 채널 슬롯(A/B/C) 기준 모터% 직접 소비 — eqpmnCode(role) 컬럼 비참조.
  const fanA = avgColumns(controllerSeriesList, (c) => c.fanA, len);
  const fanB = avgColumns(controllerSeriesList, (c) => c.fanB, len);
  const fanC = avgColumns(controllerSeriesList, (c) => c.fanC, len);
  const tempAvg = avgColumns(controllerSeriesList, (c) => c.temp, len);
  const humAvg = avgColumns(controllerSeriesList, (c) => c.humidity, len);
  const tempSpread = minMaxColumns(controllerSeriesList, (c) => c.temp, len);
  const humSpread = minMaxColumns(
    controllerSeriesList,
    (c) => c.humidity,
    len,
  );
  const tempSpreadExtremes = markSpreadBreaches(
    tempSpread.maxAt,
    tempSpread.minAt,
    tempHigh,
    tempLow,
  );
  const humSpreadExtremes = markSpreadBreaches(
    humSpread.maxAt,
    humSpread.minAt,
    humidityHigh,
    humidityLow,
  );

  const emaShortRaw = computeEmaSeries(tempAvg, EMA_SHORT_PERIOD);
  const emaLongRaw = computeEmaSeries(tempAvg, EMA_LONG_PERIOD);
  const humEmaShortRaw = computeEmaSeries(humAvg, EMA_SHORT_PERIOD);
  const humEmaLongRaw = computeEmaSeries(humAvg, EMA_LONG_PERIOD);

  const tempDevRaw = tempAvg.map((t) =>
    t == null || !Number.isFinite(t) ? null : t - tempMid,
  );
  const tempDevOpacity = tempDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return Math.abs(d) > tempAlarmHalfSpan ? 0.32 : 0.1;
  });

  const humDevRaw = humAvg.map((h) =>
    h == null || !Number.isFinite(h) ? null : h - humMid,
  );
  const humDevOpacity = humDevRaw.map((d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return Math.abs(d) > humAlarmHalfSpan ? 0.32 : 0.1;
  });

  const fanMaxRaw: (number | null)[] = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const slot: number[] = [];
    for (const v of [fanA[i], fanB[i], fanC[i]]) {
      if (v != null && Number.isFinite(v)) slot.push(v);
    }
    fanMaxRaw[i] = slot.length ? Math.max(...slot) : null;
  }

  return {
    categories,
    controllerCount: controllerSeriesList.length,
    thresholds,
    tempLow,
    tempHigh,
    humidityLow,
    humidityHigh,
    tempMid,
    humMid,
    fanA,
    fanB,
    fanC,
    fanMaxRaw,
    tempAvg,
    humAvg,
    tempMin: tempSpread.min,
    tempMax: tempSpread.max,
    humMin: humSpread.min,
    humMax: humSpread.max,
    tempSpreadExtremes,
    humSpreadExtremes,
    emaShortRaw,
    emaLongRaw,
    humEmaShortRaw,
    humEmaLongRaw,
    tempDevRaw,
    humDevRaw,
    tempDevOpacity,
    humDevOpacity,
    tempRangeLabel: formatTempAlarmRange(thresholds),
    humidityRangeLabel: formatHumidityAlarmRange(thresholds),
    thermoWindows: thermoWindowsFromSeries(
      controllerSeriesList,
      Boolean(options?.includeThermo),
    ),
  };
}

