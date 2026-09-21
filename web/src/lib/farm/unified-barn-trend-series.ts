import type {
  TrendEnvelope,
  TrendEnvelopePolyPoint,
  TrendHistogram,
  TrendSeries,
  TrendSpreadContributor,
  TrendSpreadExtremes,
} from "@/lib/data/trend-chart-types";
import type { AlarmThresholds } from "@/lib/data/alarms";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import { TREND_CHART_COLORS } from "@/lib/farm/trend-chart-series";
import {
  formatControllerNoLabel,
  formatHumidityAlarmRange,
  formatTempAlarmRange,
} from "@/lib/farm/controller-summary-display";
import {
  absFanWindows,
  emptyChannelThermo,
  hasFiniteWindow,
  type FanControlWindow,
} from "@/lib/farm/channel-thermo";

export const UNIFIED_TEMP_BAND_FILL = "var(--channel-temp)";
/** 온도 편차 히스토그램 — 본선(채널 temp)과 톤만 구분 */
export const DEV_HIST_COLOR_UP = "color-mix(in oklch, var(--channel-temp) 72%, var(--mix-lift))";
export const DEV_HIST_COLOR_DOWN = "color-mix(in oklch, var(--channel-temp) 55%, var(--channel-hum))";
/** EMA 추세선 (온도) */
export const EMA_SHORT_COLOR = "color-mix(in oklch, var(--channel-temp) 45%, var(--mix-lift))";
export const EMA_LONG_COLOR = "color-mix(in oklch, var(--channel-temp) 72%, var(--mix-shade))";

export const UNIFIED_HUM_BAND_FILL = "var(--channel-hum)";
/** 습도 편차 히스토그램 — 본선(채널 hum)과 톤만 구분 */
export const HUM_DEV_HIST_COLOR_UP = "color-mix(in oklch, var(--channel-hum) 65%, var(--mix-lift))";
export const HUM_DEV_HIST_COLOR_DOWN = "color-mix(in oklch, var(--channel-hum) 55%, var(--channel-fan-exhaust))";
export const HUM_EMA_SHORT_COLOR = "color-mix(in oklch, var(--channel-hum) 50%, var(--mix-lift))";
export const HUM_EMA_LONG_COLOR = "color-mix(in oklch, var(--channel-hum) 70%, var(--mix-shade))";

/** 통합 차트 UI 정식명 (범례·툴팁) */
export const UNIFIED_CHART_LABELS = {
  tempEmaShort: "온도 추세",
  tempEmaLong: "온도 장기 추세",
  humEmaShort: "습도 추세",
  humEmaLong: "습도 장기 추세",
  tempBand: "온도 산포",
  humBand: "습도 산포",
  tempDev: "온도 편차",
  humDev: "습도 편차",
  motor: "모터",
  motorA: CHANNEL_SLOT_LABELS.A,
  motorB: CHANNEL_SLOT_LABELS.B,
  motorC: CHANNEL_SLOT_LABELS.C,
} as const;

/** 닿음 허용 (부동소수) */
const BREACH_TOUCH_EPS = 1e-6;

function isBreachedRaw(
  raw: number,
  thresholdRaw: number,
  side: "high" | "low",
): boolean {
  return side === "high"
    ? raw >= thresholdRaw - BREACH_TOUCH_EPS
    : raw <= thresholdRaw + BREACH_TOUCH_EPS;
}

function corridorPoint(
  x: number,
  plotY: number,
  thresholdPlot: number,
): TrendEnvelopePolyPoint {
  return {
    x,
    high: Math.max(plotY, thresholdPlot),
    low: Math.min(plotY, thresholdPlot),
  };
}

function appendCorridorPoint(
  run: TrendEnvelopePolyPoint[],
  point: TrendEnvelopePolyPoint,
) {
  const last = run[run.length - 1];
  if (last && Math.abs(last.x - point.x) < 1e-9) {
    last.high = point.high;
    last.low = point.low;
    return;
  }
  run.push(point);
}

/**
 * 본선이 상한/하한에 닿거나 넘는 구간에 본선↔임계 사이 면채움.
 * 샘플 사이 교차는 보간해 초과 구간 전체를 채운다.
 */
export function buildThresholdBreachCorridor(opts: {
  seriesPlot: (number | null)[];
  seriesRaw: (number | null)[] | null;
  thresholdRaw: number;
  thresholdPlot: number;
  side: "high" | "low";
  fill: string;
  fillOpacity?: number;
  legendLabel?: string;
}): TrendEnvelope | null {
  const {
    seriesPlot,
    seriesRaw,
    thresholdRaw,
    thresholdPlot,
    side,
    fill,
    fillOpacity = 0.2,
    legendLabel,
  } = opts;
  if (
    !seriesRaw?.length ||
    !Number.isFinite(thresholdRaw) ||
    !Number.isFinite(thresholdPlot)
  ) {
    return null;
  }
  const n = Math.min(seriesPlot.length, seriesRaw.length);
  if (n < 2) return null;

  const high: (number | null)[] = Array.from({ length: n }, () => null);
  const low: (number | null)[] = Array.from({ length: n }, () => null);
  const polys: TrendEnvelopePolyPoint[][] = [];
  let run: TrendEnvelopePolyPoint[] = [];
  let any = false;

  const flushRun = () => {
    if (run.length >= 2) polys.push(run);
    run = [];
  };

  for (let i = 0; i < n; i++) {
    const raw = seriesRaw[i];
    const plot = seriesPlot[i];
    if (
      raw == null ||
      plot == null ||
      !Number.isFinite(raw) ||
      !Number.isFinite(plot)
    ) {
      continue;
    }
    if (!isBreachedRaw(raw, thresholdRaw, side)) continue;
    high[i] = Math.max(plot, thresholdPlot);
    low[i] = Math.min(plot, thresholdPlot);
    any = true;
  }

  for (let i = 0; i < n - 1; i++) {
    const r0 = seriesRaw[i];
    const r1 = seriesRaw[i + 1];
    const p0 = seriesPlot[i];
    const p1 = seriesPlot[i + 1];
    if (
      r0 == null ||
      r1 == null ||
      p0 == null ||
      p1 == null ||
      !Number.isFinite(r0) ||
      !Number.isFinite(r1) ||
      !Number.isFinite(p0) ||
      !Number.isFinite(p1)
    ) {
      flushRun();
      continue;
    }

    const b0 = isBreachedRaw(r0, thresholdRaw, side);
    const b1 = isBreachedRaw(r1, thresholdRaw, side);
    if (!b0 && !b1) {
      flushRun();
      continue;
    }

    if (b0 && b1) {
      appendCorridorPoint(run, corridorPoint(i, p0, thresholdPlot));
      appendCorridorPoint(run, corridorPoint(i + 1, p1, thresholdPlot));
      continue;
    }

    const denom = r1 - r0;
    const t =
      Math.abs(denom) < 1e-12
        ? 0.5
        : Math.max(0, Math.min(1, (thresholdRaw - r0) / denom));
    const xCross = i + t;
    const pCross = p0 + t * (p1 - p0);
    const cross = corridorPoint(xCross, pCross, thresholdPlot);

    if (b0 && !b1) {
      appendCorridorPoint(run, corridorPoint(i, p0, thresholdPlot));
      appendCorridorPoint(run, cross);
      flushRun();
    } else {
      /* !b0 && b1 — 새 런 시작 */
      flushRun();
      appendCorridorPoint(run, cross);
      appendCorridorPoint(run, corridorPoint(i + 1, p1, thresholdPlot));
    }
  }
  flushRun();

  if (!any && polys.length === 0) return null;
  return {
    high,
    low,
    axis: "left",
    fill,
    fillOpacity,
    legendLabel,
    polys: polys.length ? polys : undefined,
  };
}

export {
  SPLIT_Y_BAND_GAP,
  OVERLAY_MOTOR_GUTTER_WEIGHT,
  resolveSplitYLayout,
  SPLIT_Y_WITH_HUM,
  SPLIT_Y_TEMP_EXPANDED,
  tempBrokenAxisPlotZones,
  lerpSplitYLayout,
  lerpSplitYLayoutStaged,
  isOverlayStagedLayoutTransition,
  overlayMeetSplitYLayout,
  splitYLayoutIsFullyMerged,
  splitYLayoutHasDistinctHumBand,
  splitYLayoutsEqual,
  easeOutCubic,
  ALARM_PAD_RATIO,
  paddedExtentDomain,
  finiteExtent,
  fitTempDisplayDomain,
  DEFAULT_UNIFIED_LAYERS,
  ALL_UNIFIED_LAYERS,
  needsHumidityBand,
  splitYVisibilityFromLayers,
  UNIFIED_Y_BAND_LABEL,
  unifiedYBandFocusLabel,
  unifiedYBandsScopeLabel,
  isSingleYBandFocus,
  eventLaneVisibleForYBands,
  isCommandOnlyYBands,
  countVisibleUnifiedBands,
  allocateUnifiedChartBandHeights,
  sortUnifiedYBands,
  countSplitYBands,
  hitSplitYBand,
  listSplitYBands,
  resolveYScopeBands,
  resolveYScopeBand,
  domainYFromViewRatio,
  COMMAND_SPLIT_Y_LO,
  COMMAND_SPLIT_Y_HI,
  visibilityForYBands,
  visibilityForYBand,
  maskLayersForYBands,
  maskLayersForYBand,
} from "./unified-barn-trend-layout";
export type {
  SplitYLayout,
  SplitYVisibility,
  UnifiedLayerId,
  UnifiedLayerFlags,
  UnifiedYBandId,
  TempBrokenAxisPlotZones,
} from "./unified-barn-trend-layout";

import {
  ALARM_PAD_RATIO,
  countSplitYBands,
  fitTempDisplayDomain,
  resolveSplitYLayout,
  SPLIT_Y_WITH_HUM,
  tempBrokenAxisPlotZones,
} from "./unified-barn-trend-layout";
import type {
  SplitYLayout,
  SplitYVisibility,
  UnifiedLayerFlags,
  UnifiedYBandId,
} from "./unified-barn-trend-layout";

export type UnifiedBuildOptions = {
  /** @deprecated showHum — visibility 사용 */
  showHum?: boolean;
  visibility?: SplitYVisibility;
  /** 지정 시 resolveSplitYLayout 대신 이 레이아웃으로 매핑 (보간 중) */
  layout?: SplitYLayout;
  /** 컨트롤러 1대 범위에서만 설정 변경 마커 */
  includeThermo?: boolean;
};

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

/** 알람 상·하한 ± pad → 값 도메인 */
export function paddedAlarmDomain(lo: number, hi: number): [number, number] {
  const span = Math.max(hi - lo, 1e-6);
  const pad = span * ALARM_PAD_RATIO;
  return [lo - pad, hi + pad];
}

/** 분리 밴드 왼쪽 눈금 — 온도 상·하한 바깥 여유(℃) */
export const SPLIT_Y_TEMP_EDGE_PAD_C = 2;
/** 분리 밴드 왼쪽 눈금 — 습도 상·하한 바깥 여유(%p) */
export const SPLIT_Y_HUM_EDGE_PAD_PCT = 2;
/** 꺾인 축 위칸 — 이탈 실측 폭에 붙이는 여유 비율 (Canvas 이탈 자체) */
export const OVERFLOW_FIT_PAD_RATIO = 0.12;
/** 꺾인 축 위칸 — 최소 패딩(℃). 거의 평탄해도 칸을 비우지 않음 */
export const OVERFLOW_FIT_MIN_PAD_C = 0.25;
/** @deprecated 연속 ℃/px 위칸 최소 폭. 이탈 자체 스케일에서는 쓰지 않음 */
export const SPLIT_Y_TEMP_OVERFLOW_MIN_C = 5;
/** 겹쳐보기 권장 구간(꺾임 아래)에서 온·습 상·하한을 같은 높이에 두는 헤드룸 */
export const OVERLAY_ALIGN_HEAD_FRAC = 0.2;

export function alarmEdgeDomain(
  lo: number,
  hi: number,
  pad: number,
): [number, number] {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return [lo, hi];
  if (!(hi > lo)) return [lo - pad, lo + pad];
  return [lo - pad, hi + pad];
}

/**
 * C2 — 밴드 1개만 ON이면 원단위 Y(℃/%) identity 레이아웃.
 * 매핑 함수가 항등이 되어 축·드래그·엣지 라벨이 실제 단위로 동작한다.
 */
export type UnifiedPlotLayoutSpec = {
  layout: SplitYLayout;
  leftUnit: string;
  nativeBand: UnifiedYBandId | null;
};

export function resolveUnifiedPlotLayout(
  visibility: SplitYVisibility,
  thresholds: Pick<
    AlarmThresholds,
    "tempLow" | "tempHigh" | "humidityLow" | "humidityHigh"
  >,
  overlay = false,
): UnifiedPlotLayoutSpec {
  const n = countSplitYBands(visibility);
  /**
   * 오버레이 — 온·습은 본칸에 겹침. 모터가 있으면 하단 보조칸.
   * 단일-네이티브 밴드(원단위 축) 분기를 건너뛰고 밴드 엣지라벨 경로 사용.
   */
  const mergeOverlay = overlay && n >= 2;
  if (mergeOverlay) {
    return {
      layout: resolveSplitYLayout(visibility, true),
      leftUnit: "",
      nativeBand: null,
    };
  }
  if (n === 1 && visibility.showTemp) {
    const [vlo, vhi] = paddedAlarmDomain(
      thresholds.tempLow,
      thresholds.tempHigh,
    );
    return {
      layout: {
        motorLo: 0,
        motorHi: 0,
        humLo: 0,
        humHi: 0,
        tempLo: vlo,
        tempHi: vhi,
        domain: [vlo, vhi],
      },
      leftUnit: "℃",
      nativeBand: "temp",
    };
  }
  if (n === 1 && visibility.showHum) {
    const [vlo, vhi] = paddedAlarmDomain(
      thresholds.humidityLow,
      thresholds.humidityHigh,
    );
    return {
      layout: {
        motorLo: 0,
        motorHi: 0,
        humLo: vlo,
        humHi: vhi,
        tempLo: 0,
        tempHi: 0,
        domain: [vlo, vhi],
      },
      leftUnit: "%",
      nativeBand: "hum",
    };
  }
  if (n === 1 && visibility.showMotors) {
    return {
      layout: {
        motorLo: 0,
        motorHi: 100,
        humLo: 0,
        humHi: 0,
        tempLo: 0,
        tempHi: 0,
        domain: [0, 100],
      },
      leftUnit: "%",
      nativeBand: "motor",
    };
  }
  return {
    layout: resolveSplitYLayout(visibility),
    leftUnit: "",
    nativeBand: null,
  };
}

function mapToValueBand(
  value: number | null | undefined,
  valueLo: number,
  valueHi: number,
  bandLo: number,
  bandHi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(valueHi > valueLo) || !(bandHi > bandLo)) return (bandLo + bandHi) / 2;
  const t = (value - valueLo) / (valueHi - valueLo);
  const clamped = Math.max(0, Math.min(1, t));
  return bandLo + clamped * (bandHi - bandLo);
}

/** split-Y 밴드 Y → 원단위 (드래그 역매핑). 도메인 고정용. */
function unmapFromValueBand(
  splitY: number,
  valueLo: number,
  valueHi: number,
  bandLo: number,
  bandHi: number,
): number | null {
  if (!Number.isFinite(splitY)) return null;
  if (!(valueHi > valueLo) || !(bandHi > bandLo)) return (valueLo + valueHi) / 2;
  const t = (splitY - bandLo) / (bandHi - bandLo);
  const clamped = Math.max(0, Math.min(1, t));
  return valueLo + clamped * (valueHi - valueLo);
}

/**
 * 오버레이 상·하한 정렬 — 알람 구간을 밴드 코어에 선형 매핑하고,
 * 밖은 지수 소프트-니로 압축한다. 온·습·모터가 같은 headFrac을 쓰면
 * 각 상한(모터 100%)·하한(모터 0%)이 같은 높이에 온다.
 */
export type TempBandAnchor = {
  /** 밴드 상·하단 헤드룸 비율(각각) 0~0.45 */
  headFrac: number;
};

export const OVERLAY_ALIGN_ANCHOR: TempBandAnchor = {
  headFrac: OVERLAY_ALIGN_HEAD_FRAC,
};

function bandAnchorCore(
  bandLo: number,
  bandHi: number,
  headFrac: number,
): {
  bandLo: number;
  bandHi: number;
  coreLo: number;
  coreHi: number;
} | null {
  if (!(bandHi > bandLo)) return null;
  const h = Math.max(0, Math.min(0.45, headFrac));
  const span = bandHi - bandLo;
  return {
    bandLo,
    bandHi,
    coreLo: bandLo + h * span,
    coreHi: bandHi - h * span,
  };
}

function mapMetricAnchoredToBand(
  value: number | null | undefined,
  alarmLo: number,
  alarmHi: number,
  bandLo: number,
  bandHi: number,
  headFrac: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const c = bandAnchorCore(bandLo, bandHi, headFrac);
  if (!c) return (bandLo + bandHi) / 2;
  const alarmSpan = alarmHi - alarmLo;
  if (!(alarmSpan > 0)) return (c.coreLo + c.coreHi) / 2;
  const s = (c.coreHi - c.coreLo) / alarmSpan;
  if (value > alarmHi) {
    const H = c.bandHi - c.coreHi;
    if (H <= 0) return c.bandHi;
    const a = s / H;
    return c.coreHi + H * (1 - Math.exp(-a * (value - alarmHi)));
  }
  if (value < alarmLo) {
    const H = c.coreLo - c.bandLo;
    if (H <= 0) return c.bandLo;
    const a = s / H;
    return c.coreLo - H * (1 - Math.exp(-a * (alarmLo - value)));
  }
  return c.coreLo + ((value - alarmLo) / alarmSpan) * (c.coreHi - c.coreLo);
}

function unmapMetricAnchoredFromBand(
  splitY: number,
  alarmLo: number,
  alarmHi: number,
  bandLo: number,
  bandHi: number,
  headFrac: number,
): number | null {
  if (!Number.isFinite(splitY)) return null;
  const c = bandAnchorCore(bandLo, bandHi, headFrac);
  if (!c) return (alarmLo + alarmHi) / 2;
  const alarmSpan = alarmHi - alarmLo;
  if (!(alarmSpan > 0)) return (alarmLo + alarmHi) / 2;
  const s = (c.coreHi - c.coreLo) / alarmSpan;
  if (splitY > c.coreHi) {
    const H = c.bandHi - c.coreHi;
    if (H <= 0) return alarmHi;
    const a = s / H;
    const frac = Math.min(1 - 1e-6, (splitY - c.coreHi) / H);
    return alarmHi + -Math.log(1 - frac) / a;
  }
  if (splitY < c.coreLo) {
    const H = c.coreLo - c.bandLo;
    if (H <= 0) return alarmLo;
    const a = s / H;
    const frac = Math.min(1 - 1e-6, (c.coreLo - splitY) / H);
    return alarmLo - -Math.log(1 - frac) / a;
  }
  return alarmLo + ((splitY - c.coreLo) / (c.coreHi - c.coreLo)) * alarmSpan;
}

/** 겹쳐보기 — 온·습 권장 가장자리는 꺾임 아래(선형 칸)에 맞춘다. */
function overlayBrokenLinearSlot(
  layout: SplitYLayout,
): { lo: number; hi: number } | null {
  const zones = tempBrokenAxisPlotZones(layout);
  if (zones && zones.linear.hi > zones.linear.lo) {
    return { lo: zones.linear.lo, hi: zones.linear.hi };
  }
  return null;
}

function overlayAlignSlot(
  layout: SplitYLayout,
  bandLo: number,
  bandHi: number,
): { lo: number; hi: number } {
  return overlayBrokenLinearSlot(layout) ?? { lo: bandLo, hi: bandHi };
}

function mapOverlayAlignedToSlot(
  value: number | null | undefined,
  alarmLo: number,
  alarmHi: number,
  layout: SplitYLayout,
  bandLo: number,
  bandHi: number,
  headFrac: number,
): number | null {
  const slot = overlayAlignSlot(layout, bandLo, bandHi);
  if (overlayBrokenLinearSlot(layout)) {
    return mapToValueBand(value, alarmLo, alarmHi, slot.lo, slot.hi);
  }
  return mapMetricAnchoredToBand(
    value,
    alarmLo,
    alarmHi,
    slot.lo,
    slot.hi,
    headFrac,
  );
}

function unmapOverlayAlignedFromSlot(
  splitY: number,
  alarmLo: number,
  alarmHi: number,
  layout: SplitYLayout,
  bandLo: number,
  bandHi: number,
  headFrac: number,
): number | null {
  const slot = overlayAlignSlot(layout, bandLo, bandHi);
  if (splitY > slot.hi) return null;
  if (overlayBrokenLinearSlot(layout)) {
    return unmapFromValueBand(splitY, alarmLo, alarmHi, slot.lo, slot.hi);
  }
  return unmapMetricAnchoredFromBand(
    splitY,
    alarmLo,
    alarmHi,
    slot.lo,
    slot.hi,
    headFrac,
  );
}

/** 습도 밴드 Y → % (드래그 시작 시 고정 도메인 기준) */
export function unmapHumPctFromSplitY(
  splitY: number,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  align?: TempBandAnchor,
): number | null {
  if (align) {
    return unmapOverlayAlignedFromSlot(
      splitY,
      humidityLow,
      humidityHigh,
      layout,
      layout.humLo,
      layout.humHi,
      align.headFrac,
    );
  }
  const [vlo, vhi] = domain ?? paddedAlarmDomain(humidityLow, humidityHigh);
  return unmapFromValueBand(splitY, vlo, vhi, layout.humLo, layout.humHi);
}

function tempBrokenLinearEdge(
  tempLow: number,
  tempHigh: number,
): [number, number] {
  return alarmEdgeDomain(tempLow, tempHigh, SPLIT_Y_TEMP_EDGE_PAD_C);
}

function tempBrokenMappingActive(
  layout: SplitYLayout,
  tempLow: number,
  tempHigh: number,
  domain: [number, number],
): boolean {
  const zones = tempBrokenAxisPlotZones(layout);
  if (!zones) return false;
  const [, linearHi] = tempBrokenLinearEdge(tempLow, tempHigh);
  return domain[1] > linearHi + 1e-6;
}

function resolveTempBrokenMappingDomain(
  tempLow: number,
  tempHigh: number,
  dataHi: number,
): [number, number] {
  const linear = tempBrokenLinearEdge(tempLow, tempHigh);
  const overflowHi = Math.max(
    linear[1] + SPLIT_Y_TEMP_OVERFLOW_MIN_C,
    dataHi,
  );
  return [linear[0], overflowHi];
}

/** 권장(선형) 밖 실측 min–max + 여유. 위칸만 이 폭으로 채움. */
export function fitOverflowValueDomain(
  min: number,
  max: number,
): [number, number] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = Math.max(hi - lo, OVERFLOW_FIT_MIN_PAD_C * 2);
  const pad = Math.max(OVERFLOW_FIT_MIN_PAD_C, span * OVERFLOW_FIT_PAD_RATIO);
  return [lo - pad, hi + pad];
}

export function overflowExtentAbove(
  columns: readonly (readonly (number | null | undefined)[])[],
  linearHi: number,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const col of columns) {
    for (const v of col) {
      if (v == null || !Number.isFinite(v) || !(v > linearHi)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function resolveTempOverflowFitDomain(
  tempLow: number,
  tempHigh: number,
  columns: readonly (readonly (number | null | undefined)[])[],
): [number, number] | null {
  const [, linearHi] = tempBrokenLinearEdge(tempLow, tempHigh);
  const ext = overflowExtentAbove(columns, linearHi);
  if (!ext) return null;
  return fitOverflowValueDomain(ext.min, ext.max);
}

function tempRawOverflowColumns(
  raw: Pick<
    UnifiedBarnTrendRaw,
    "tempAvg" | "tempMin" | "tempMax" | "emaShortRaw" | "emaLongRaw"
  >,
): (readonly (number | null | undefined)[])[] {
  return [
    raw.tempAvg,
    raw.tempMin,
    raw.tempMax,
    raw.emaShortRaw,
    raw.emaLongRaw,
  ];
}

/** 온도 밴드 Y → ℃ (드래그 시작 시 고정 도메인 기준) */
export function unmapTempCFromSplitY(
  splitY: number,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  anchor?: TempBandAnchor,
  overflowDomain?: [number, number] | null,
): number | null {
  const zones = tempBrokenAxisPlotZones(layout);
  const [linearLo, linearHi] = tempBrokenLinearEdge(tempLow, tempHigh);
  const [vlo, vhi] = domain ?? paddedAlarmDomain(tempLow, tempHigh);
  const fit =
    overflowDomain && overflowDomain[1] > overflowDomain[0]
      ? overflowDomain
      : null;
  if (anchor) {
    if (zones && splitY >= zones.overflow.lo) {
      const ov = fit ?? [linearHi, Math.max(linearHi + OVERFLOW_FIT_MIN_PAD_C, vhi)];
      return unmapFromValueBand(
        splitY,
        ov[0],
        ov[1],
        zones.overflow.lo,
        zones.overflow.hi,
      );
    }
    if (zones && splitY > zones.linear.hi) return linearHi;
    const slot = overlayAlignSlot(layout, layout.tempLo, layout.tempHi);
    if (overlayBrokenLinearSlot(layout)) {
      return unmapFromValueBand(
        splitY,
        tempLow,
        tempHigh,
        slot.lo,
        slot.hi,
      );
    }
    return unmapMetricAnchoredFromBand(
      splitY,
      tempLow,
      tempHigh,
      slot.lo,
      slot.hi,
      anchor.headFrac,
    );
  }
  const broken =
    Boolean(zones) &&
    (Boolean(fit) ||
      tempBrokenMappingActive(layout, tempLow, tempHigh, [vlo, vhi]));
  if (broken && zones) {
    if (splitY >= zones.overflow.lo) {
      const ov = fit ?? [linearHi, vhi];
      return unmapFromValueBand(
        splitY,
        ov[0],
        ov[1],
        zones.overflow.lo,
        zones.overflow.hi,
      );
    }
    if (splitY > zones.linear.hi) return linearHi;
    return unmapFromValueBand(
      splitY,
      linearLo,
      linearHi,
      zones.linear.lo,
      zones.linear.hi,
    );
  }
  return unmapFromValueBand(splitY, vlo, vhi, layout.tempLo, layout.tempHi);
}

/** 모터% → 모터 밴드 (겹쳐보기 보조칸·분할 칸 모두 0–100 선형) */
export function mapMotorPctToSplitY(
  pct: number | null | undefined,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  _align?: TempBandAnchor,
): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const t = Math.max(0, Math.min(100, pct)) / 100;
  return layout.motorLo + t * (layout.motorHi - layout.motorLo);
}

/** 모터 밴드 Y → % (드래그 역매핑) */
export function unmapMotorPctFromSplitY(
  splitY: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  _align?: TempBandAnchor,
): number | null {
  return unmapFromValueBand(splitY, 0, 100, layout.motorLo, layout.motorHi);
}

function alarmMidValue(lo: number, hi: number): number | null {
  if (!(Number.isFinite(lo) && Number.isFinite(hi))) return null;
  return (lo + hi) / 2;
}

export type SplitYBandScaleTick = {
  id: string;
  chartY: number;
  value: number;
  unit: "℃" | "%";
};

/**
 * 분리 밴드 왼쪽 눈금 — 기본은 온·습·모터 상·하한의 중간값.
 * 권장 띠가 있는 패널은 온·습 권장 중간값을 건너뛰고 현장 알람 평균을 둔다.
 * 오버레이에서는 왼쪽 눈금을 그리지 않는다.
 */
export function buildSplitYBandScaleTicks(opts: {
  layout: SplitYLayout;
  showTemp: boolean;
  showHum: boolean;
  showMotors: boolean;
  overlay?: boolean;
  tempLow: number;
  tempHigh: number;
  humidityLow: number;
  humidityHigh: number;
}): SplitYBandScaleTick[] {
  if (opts.overlay) return [];
  const out: SplitYBandScaleTick[] = [];
  const { layout } = opts;
  if (opts.showTemp && layout.tempHi > layout.tempLo) {
    const mid = alarmMidValue(opts.tempLow, opts.tempHigh);
    const domain = tempBrokenAxisPlotZones(layout)
      ? resolveTempBrokenMappingDomain(
          opts.tempLow,
          opts.tempHigh,
          opts.tempHigh + SPLIT_Y_TEMP_EDGE_PAD_C,
        )
      : alarmEdgeDomain(
          opts.tempLow,
          opts.tempHigh,
          SPLIT_Y_TEMP_EDGE_PAD_C,
        );
    if (mid != null && domain[1] > domain[0]) {
      const y = mapTempCToSplitY(
        mid,
        opts.tempLow,
        opts.tempHigh,
        layout,
        domain,
      );
      if (y != null && Number.isFinite(y)) {
        out.push({
          id: "band-tick-temp-mid",
          chartY: y,
          value: mid,
          unit: "℃",
        });
      }
    }
  }
  if (opts.showHum && layout.humHi > layout.humLo) {
    const mid = alarmMidValue(opts.humidityLow, opts.humidityHigh);
    const domain = alarmEdgeDomain(
      opts.humidityLow,
      opts.humidityHigh,
      SPLIT_Y_HUM_EDGE_PAD_PCT,
    );
    if (mid != null && domain[1] > domain[0]) {
      const y = mapHumPctToSplitY(
        mid,
        opts.humidityLow,
        opts.humidityHigh,
        layout,
        domain,
      );
      if (y != null && Number.isFinite(y)) {
        out.push({
          id: "band-tick-hum-mid",
          chartY: y,
          value: mid,
          unit: "%",
        });
      }
    }
  }
  if (opts.showMotors && layout.motorHi > layout.motorLo) {
    const y = mapMotorPctToSplitY(50, layout);
    if (y != null && Number.isFinite(y)) {
      out.push({
        id: "band-tick-motor-mid",
        chartY: y,
        value: 50,
        unit: "%",
      });
    }
  }
  return out;
}

/** 습도% → 습도 밴드 (알람±여유 또는 오버레이 정렬 앵커) */
export function mapHumPctToSplitY(
  value: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  align?: TempBandAnchor,
): number | null {
  if (align) {
    return mapOverlayAlignedToSlot(
      value,
      humidityLow,
      humidityHigh,
      layout,
      layout.humLo,
      layout.humHi,
      align.headFrac,
    );
  }
  const [vlo, vhi] = domain ?? paddedAlarmDomain(humidityLow, humidityHigh);
  return mapToValueBand(value, vlo, vhi, layout.humLo, layout.humHi);
}

/**
 * 온도℃ → 주패널 밴드.
 * `anchor` 지정 시 권장 구간은 꺾임 아래에 맞추고, 초과는 위칸 이탈 스케일.
 * 아니면 `domain`(auto-fit) 또는 알람±여유 선형.
 */
export function mapTempCToSplitY(
  value: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  anchor?: TempBandAnchor,
  overflowDomain?: [number, number] | null,
): number | null {
  const zones = tempBrokenAxisPlotZones(layout);
  const [linearLo, linearHi] = tempBrokenLinearEdge(tempLow, tempHigh);
  const [vlo, vhi] = domain ?? paddedAlarmDomain(tempLow, tempHigh);
  const fit =
    overflowDomain && overflowDomain[1] > overflowDomain[0]
      ? overflowDomain
      : null;
  if (anchor) {
    if (zones && value != null && Number.isFinite(value) && value > linearHi) {
      const ov = fit ?? [linearHi, Math.max(linearHi + OVERFLOW_FIT_MIN_PAD_C, vhi)];
      return mapToValueBand(
        value,
        ov[0],
        ov[1],
        zones.overflow.lo,
        zones.overflow.hi,
      );
    }
    const slot = overlayAlignSlot(layout, layout.tempLo, layout.tempHi);
    if (overlayBrokenLinearSlot(layout)) {
      return mapToValueBand(
        value,
        tempLow,
        tempHigh,
        slot.lo,
        slot.hi,
      );
    }
    return mapMetricAnchoredToBand(
      value,
      tempLow,
      tempHigh,
      slot.lo,
      slot.hi,
      anchor.headFrac,
    );
  }
  const broken =
    Boolean(zones) &&
    (Boolean(fit) ||
      tempBrokenMappingActive(layout, tempLow, tempHigh, [vlo, vhi]));
  if (broken && zones) {
    if (value == null || !Number.isFinite(value)) return null;
    if (value <= linearHi) {
      return mapToValueBand(
        value,
        linearLo,
        linearHi,
        zones.linear.lo,
        zones.linear.hi,
      );
    }
    const ov = fit ?? [linearHi, vhi];
    return mapToValueBand(
      value,
      ov[0],
      ov[1],
      zones.overflow.lo,
      zones.overflow.hi,
    );
  }
  return mapToValueBand(value, vlo, vhi, layout.tempLo, layout.tempHi);
}

/**
 * 온도 편차(℃) → 온도 주패널에 오버레이.
 * 중점+편차를 온도 스케일로 매핑 (자연스러운 위치).
 */
export function mapTempDeviationToSplitY(
  deviationC: number | null | undefined,
  tempLow: number,
  tempHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  anchor?: TempBandAnchor,
  overflowDomain?: [number, number] | null,
): number | null {
  if (deviationC == null || !Number.isFinite(deviationC)) return null;
  const mid = tempAlarmMidpoint(tempLow, tempHigh);
  return mapTempCToSplitY(
    mid + deviationC,
    tempLow,
    tempHigh,
    layout,
    domain,
    anchor,
    overflowDomain,
  );
}

/**
 * 습도 편차(%p) → 습도 밴드에 오버레이.
 */
export function mapHumDeviationToSplitY(
  deviationPct: number | null | undefined,
  humidityLow: number,
  humidityHigh: number,
  layout: SplitYLayout = SPLIT_Y_WITH_HUM,
  domain?: [number, number],
  align?: TempBandAnchor,
): number | null {
  if (deviationPct == null || !Number.isFinite(deviationPct)) return null;
  const mid = humidityAlarmMidpoint(humidityLow, humidityHigh);
  return mapHumPctToSplitY(
    mid + deviationPct,
    humidityLow,
    humidityHigh,
    layout,
    domain,
    align,
  );
}

/** 알람 중점 (편차 0) */
export function tempAlarmMidpoint(tempLow: number, tempHigh: number): number {
  return (tempLow + tempHigh) / 2;
}

export function humidityAlarmMidpoint(
  humidityLow: number,
  humidityHigh: number,
): number {
  return (humidityLow + humidityHigh) / 2;
}

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

/** @deprecated */
export function mapEnvAbsToSplitY(
  value: number | null | undefined,
  tempLow = 10,
  tempHigh = 35,
): number | null {
  return mapTempCToSplitY(value, tempLow, tempHigh);
}

function mapColumn(
  values: (number | null)[],
  map: (v: number | null | undefined) => number | null,
): (number | null)[] {
  return values.map((v) => map(v));
}

/** @deprecated */
export function normalizeToAlarmRange(
  value: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (!(hi > lo)) return 50;
  const n = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, n));
}

/** @deprecated */
export function denormalizeFromAlarmRange(
  n: number | null | undefined,
  lo: number,
  hi: number,
): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (!(hi > lo)) return null;
  return lo + (n / 100) * (hi - lo);
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

function hasFinite(data: (number | null)[]): boolean {
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

export type UnifiedSeriesKey =
  | "temp"
  | "hum"
  | "emaShort"
  | "emaLong"
  | "humEmaShort"
  | "humEmaLong";

export type UnifiedBarnTrendBuild = {
  categories: string[];
  seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>>;
  envelopesBand: TrendEnvelope | null;
  envelopesHumBand: TrendEnvelope | null;
  histogramDev: TrendHistogram | null;
  histogramHumDev: TrendHistogram | null;
  /** 모터 max(A,B,C) 단일 바 */
  histogramMotorsMax: TrendHistogram[];
  /** 모터 A·B·C 채널 바 */
  histogramMotorsChannels: TrendHistogram[];
  layout: SplitYLayout;
  leftDomain: [number, number];
  rightDomain: [number, number];
  /** 온도 매핑에 쓴 ℃ 도메인 (표시 최솟·최댓값 + 여유) */
  tempDomain: [number, number];
  /** 꺾인 축 위칸 — 권장 밖 실측 min–max. 없으면 위칸 매핑 없음 */
  tempOverflowDomain: [number, number] | null;
  controllerCount: number;
  tempRangeLabel: string;
  humidityRangeLabel: string;
  thresholds: AlarmThresholds;
  /**
   * 온도 상·하한 임계선의 split-Y 위치 — 본선과 동일 매핑(오버레이 앵커 포함).
   * 임계 접촉 코리도가 재계산 대신 이 값을 재사용해 정합을 보장한다.
   */
  tempHiPlot: number | null;
  tempLoPlot: number | null;
  /** hum/motors: 시계열이 없어도 밴드·가이드를 연다. 본선 유무는 series/histogram 길이. */
  available: {
    motors: boolean;
    motorCh: boolean;
    temp: boolean;
    hum: boolean;
    band: boolean;
    dev: boolean;
    ema: boolean;
    humBand: boolean;
    humDev: boolean;
    humEma: boolean;
    thermo: boolean;
    thermoMotor: boolean;
  };
};

/** 미소 편차는 숨겨 면 채움처럼 보이지 않게 */
const DEV_HIDE_ABS_C = 0.3;
const HUM_DEV_HIDE_ABS = 0.5;
const EMA_SHORT_PERIOD = 5;
const EMA_LONG_PERIOD = 14;

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

/** 측정 온도(본선·산포·EMA)의 최솟·최댓값 + 여유. 설정·명령 구간은 넣지 않는다. */
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

function isNativeTempIdentityLayout(layout: SplitYLayout): boolean {
  return (
    layout.tempHi > layout.tempLo &&
    layout.tempLo === layout.domain[0] &&
    layout.tempHi === layout.domain[1] &&
    layout.motorHi <= layout.motorLo &&
    layout.humHi <= layout.humLo &&
    !(layout.domain[0] === 0 && layout.domain[1] === 100)
  );
}

function isNativeHumIdentityLayout(layout: SplitYLayout): boolean {
  return (
    layout.humHi > layout.humLo &&
    layout.humLo === layout.domain[0] &&
    layout.humHi === layout.domain[1] &&
    layout.motorHi <= layout.motorLo &&
    layout.tempHi <= layout.tempLo &&
    !(layout.domain[0] === 0 && layout.domain[1] === 100)
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

/** raw → split-Y 플롯. layout 보간 프레임마다 호출해도 집계 비용 없음. */
export function mapUnifiedBarnTrendRawToSplitY(
  raw: UnifiedBarnTrendRaw,
  layout: SplitYLayout,
  /** 오버레이 auto-fit: 온도 매핑 도메인 오버라이드(생략 시 알람±여유) */
  tempDomain?: [number, number],
  /** 오버레이 앵커: 지정 시 데이터 도메인보다 우선(알람 코어 + 헤드룸) */
  tempAnchor?: TempBandAnchor,
  /** 꺾인 축 위칸 공유 도메인. 컨트롤러 오버레이는 합친 이탈 폭을 넘긴다 */
  overflowDomainOverride?: [number, number] | null,
): UnifiedBarnTrendBuild | null {
  const {
    tempLow,
    tempHigh,
    humidityLow,
    humidityHigh,
    tempMid,
    humMid,
  } = raw;

  const fitted = tempDomain ?? tempDisplayDomainFromRaw(raw);
  const plotLayout = isNativeTempIdentityLayout(layout)
    ? {
        ...layout,
        tempLo: fitted[0],
        tempHi: fitted[1],
        domain: fitted,
      }
    : layout;
  const overflowFit =
    tempBrokenAxisPlotZones(layout)
      ? overflowDomainOverride !== undefined
        ? overflowDomainOverride
        : resolveTempOverflowFitDomain(
            tempLow,
            tempHigh,
            tempRawOverflowColumns(raw),
          )
      : null;
  const mappingTempDomain = tempAnchor
    ? undefined
    : isNativeTempIdentityLayout(layout)
      ? fitted
      : tempBrokenAxisPlotZones(layout)
        ? overflowFit
          ? ([
              tempBrokenLinearEdge(tempLow, tempHigh)[0],
              overflowFit[1],
            ] as [number, number])
          : alarmEdgeDomain(tempLow, tempHigh, SPLIT_Y_TEMP_EDGE_PAD_C)
        : alarmEdgeDomain(tempLow, tempHigh, SPLIT_Y_TEMP_EDGE_PAD_C);
  const mappingHumDomain = tempAnchor
    ? undefined
    : isNativeHumIdentityLayout(layout)
      ? undefined
      : alarmEdgeDomain(
          humidityLow,
          humidityHigh,
          SPLIT_Y_HUM_EDGE_PAD_PCT,
        );

  const mapTemp = (v: number | null | undefined) =>
    mapTempCToSplitY(
      v,
      tempLow,
      tempHigh,
      plotLayout,
      mappingTempDomain,
      tempAnchor,
      overflowFit,
    );
  const mapHum = (v: number | null | undefined) =>
    mapHumPctToSplitY(
      v,
      humidityLow,
      humidityHigh,
      layout,
      mappingHumDomain,
      tempAnchor,
    );
  const mapMotor = (v: number | null | undefined) =>
    mapMotorPctToSplitY(v, layout, tempAnchor);

  const tempPlot = mapColumn(raw.tempAvg, mapTemp);
  const humPlot = mapColumn(raw.humAvg, mapHum);
  const tempMinPlot = mapColumn(raw.tempMin, mapTemp);
  const tempMaxPlot = mapColumn(raw.tempMax, mapTemp);
  const humMinPlot = mapColumn(raw.humMin, mapHum);
  const humMaxPlot = mapColumn(raw.humMax, mapHum);
  const emaShortPlot = mapColumn(raw.emaShortRaw, mapTemp);
  const emaLongPlot = mapColumn(raw.emaLongRaw, mapTemp);
  const humEmaShortPlot = mapColumn(raw.humEmaShortRaw, mapHum);
  const humEmaLongPlot = mapColumn(raw.humEmaLongRaw, mapHum);

  const tempDevPlot = mapColumn(raw.tempDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < DEV_HIDE_ABS_C) {
      return null;
    }
    return mapTempDeviationToSplitY(
      d,
      tempLow,
      tempHigh,
      plotLayout,
      mappingTempDomain,
      tempAnchor,
      overflowFit,
    );
  });
  const tempMidPlot = mapTempCToSplitY(
    tempMid,
    tempLow,
    tempHigh,
    plotLayout,
    mappingTempDomain,
    tempAnchor,
    overflowFit,
  );
  /** 임계선 split-Y — 본선과 동일 매핑(앵커 포함). 코리도 정합용 */
  const tempHiPlot = mapTemp(tempHigh);
  const tempLoPlot = mapTemp(tempLow);

  const humDevPlot = mapColumn(raw.humDevRaw, (d) => {
    if (d == null || !Number.isFinite(d) || Math.abs(d) < HUM_DEV_HIDE_ABS) {
      return null;
    }
    return mapHumDeviationToSplitY(
      d,
      humidityLow,
      humidityHigh,
      layout,
      mappingHumDomain,
      tempAnchor,
    );
  });
  const humMidPlot = mapHumPctToSplitY(
    humMid,
    humidityLow,
    humidityHigh,
    layout,
    mappingHumDomain,
    tempAnchor,
  );

  const seriesByKey: Partial<Record<UnifiedSeriesKey, TrendSeries>> = {};
  if (hasFinite(tempPlot)) {
    seriesByKey.temp = {
      name: "온도",
      data: tempPlot,
      color: TREND_CHART_COLORS.temp,
      axis: "left",
      hoverSecondary: raw.tempAvg,
      hoverSecondaryUnit: "℃",
      hoverAlarmBand: {
        lo: tempLow,
        hi: tempHigh,
        unit: "℃",
      },
      hoverSpreadExtremes: raw.tempSpreadExtremes,
    };
  }
  if (hasFinite(humPlot)) {
    seriesByKey.hum = {
      name: "습도",
      data: humPlot,
      color: TREND_CHART_COLORS.humidity,
      axis: "left",
      hoverSecondary: raw.humAvg,
      hoverSecondaryUnit: "%",
      hoverAlarmBand: {
        lo: humidityLow,
        hi: humidityHigh,
        unit: "%",
      },
      hoverSpreadExtremes: raw.humSpreadExtremes,
    };
  }
  if (hasFinite(emaShortPlot)) {
    seriesByKey.emaShort = {
      name: UNIFIED_CHART_LABELS.tempEmaShort,
      data: emaShortPlot,
      color: EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.emaShortRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(emaLongPlot)) {
    seriesByKey.emaLong = {
      name: UNIFIED_CHART_LABELS.tempEmaLong,
      data: emaLongPlot,
      color: EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.emaLongRaw,
      hoverSecondaryUnit: "℃",
    };
  }
  if (hasFinite(humEmaShortPlot)) {
    seriesByKey.humEmaShort = {
      name: UNIFIED_CHART_LABELS.humEmaShort,
      data: humEmaShortPlot,
      color: HUM_EMA_SHORT_COLOR,
      axis: "left",
      strokeDasharray: "4 3",
      hoverSecondary: raw.humEmaShortRaw,
      hoverSecondaryUnit: "%",
    };
  }
  if (hasFinite(humEmaLongPlot)) {
    seriesByKey.humEmaLong = {
      name: UNIFIED_CHART_LABELS.humEmaLong,
      data: humEmaLongPlot,
      color: HUM_EMA_LONG_COLOR,
      axis: "left",
      strokeDasharray: "6 4",
      hoverSecondary: raw.humEmaLongRaw,
      hoverSecondaryUnit: "%",
    };
  }

  const fanAPlot = mapColumn(raw.fanA, mapMotor);
  const fanBPlot = mapColumn(raw.fanB, mapMotor);
  const fanCPlot = mapColumn(raw.fanC, mapMotor);
  const fanMaxPlot = mapColumn(raw.fanMaxRaw, mapMotor);

  const motorDefs = [
    {
      plot: fanAPlot,
      raw: raw.fanA,
      color: TREND_CHART_COLORS.fanIntake,
      label: UNIFIED_CHART_LABELS.motorA,
    },
    {
      plot: fanBPlot,
      raw: raw.fanB,
      color: TREND_CHART_COLORS.fanExhaust,
      label: UNIFIED_CHART_LABELS.motorB,
    },
    {
      plot: fanCPlot,
      raw: raw.fanC,
      color: TREND_CHART_COLORS.fanSupply,
      label: UNIFIED_CHART_LABELS.motorC,
    },
  ].filter((m) => hasFinite(m.raw));

  const motorHoverChannels = motorDefs.map((m) => ({
    label: m.label,
    color: m.color,
    values: m.raw,
  }));

  const histogramMotorsMax: TrendHistogram[] = hasFinite(raw.fanMaxRaw)
    ? [
        {
          values: fanMaxPlot,
          baseline: layout.motorLo,
          colorUp: TREND_CHART_COLORS.fanIntake,
          colorDown: TREND_CHART_COLORS.fanIntake,
          style: "volume" as const,
          legendLabel: UNIFIED_CHART_LABELS.motor,
          hoverSecondary: raw.fanMaxRaw,
          hoverSecondaryUnit: "%",
          hoverChannels: motorHoverChannels,
        },
      ]
    : [];

  const histogramMotorsChannels: TrendHistogram[] = motorDefs.map((m, i) => ({
    values: m.plot,
    baseline: layout.motorLo,
    colorUp: m.color,
    colorDown: m.color,
    style: "volume" as const,
    groupIndex: i,
    groupSize: motorDefs.length,
    legendLabel: m.label,
    hoverSecondary: m.raw,
    hoverSecondaryUnit: "%",
    hoverChannels: motorHoverChannels,
  }));

  const hasMotorSeries =
    histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0;

  if (
    !Object.keys(seriesByKey).length &&
    !hasFinite(tempDevPlot) &&
    !hasFinite(humDevPlot) &&
    !hasMotorSeries
  ) {
    return null;
  }

  const envelopesBand =
    hasFinite(tempMinPlot) && hasFinite(tempMaxPlot)
      ? {
          high: tempMaxPlot,
          low: tempMinPlot,
          axis: "left" as const,
          fill: UNIFIED_TEMP_BAND_FILL,
          fillOpacity: 0.12,
          legendLabel: UNIFIED_CHART_LABELS.tempBand,
          hoverExtremes: raw.tempSpreadExtremes,
        }
      : null;

  const envelopesHumBand =
    hasFinite(humMinPlot) && hasFinite(humMaxPlot)
      ? {
          high: humMaxPlot,
          low: humMinPlot,
          axis: "left" as const,
          fill: UNIFIED_HUM_BAND_FILL,
          fillOpacity: 0.14,
          legendLabel: UNIFIED_CHART_LABELS.humBand,
          hoverExtremes: raw.humSpreadExtremes,
        }
      : null;

  const histogramDev =
    hasFinite(tempDevPlot) && tempMidPlot != null
      ? {
          values: tempDevPlot,
          baseline: tempMidPlot,
          colorUp: DEV_HIST_COLOR_UP,
          colorDown: DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.tempDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.tempDev,
          hoverSecondary: raw.tempDevRaw,
          hoverSecondaryUnit: "℃",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  const histogramHumDev =
    hasFinite(humDevPlot) && humMidPlot != null
      ? {
          values: humDevPlot,
          baseline: humMidPlot,
          colorUp: HUM_DEV_HIST_COLOR_UP,
          colorDown: HUM_DEV_HIST_COLOR_DOWN,
          style: "overlay" as const,
          fillOpacity: 0.14,
          fillOpacityValues: raw.humDevOpacity,
          legendLabel: UNIFIED_CHART_LABELS.humDev,
          hoverSecondary: raw.humDevRaw,
          hoverSecondaryUnit: "%",
          hoverFormat: "midpointDelta" as const,
        }
      : null;

  return {
    categories: raw.categories,
    seriesByKey,
    envelopesBand,
    envelopesHumBand,
    histogramDev,
    histogramHumDev,
    histogramMotorsMax,
    histogramMotorsChannels,
    layout: plotLayout,
    leftDomain: [...plotLayout.domain],
    rightDomain: [...plotLayout.domain],
    tempDomain: mappingTempDomain ?? fitted,
    tempOverflowDomain: overflowFit,
    controllerCount: raw.controllerCount,
    tempRangeLabel: raw.tempRangeLabel,
    humidityRangeLabel: raw.humidityRangeLabel,
    thresholds: raw.thresholds,
    tempHiPlot,
    tempLoPlot,
    available: {
      motors: histogramMotorsMax.length > 0 || histogramMotorsChannels.length > 0,
      motorCh: histogramMotorsChannels.length > 0,
      temp: Boolean(seriesByKey.temp),
      hum: Boolean(seriesByKey.hum),
      band: Boolean(envelopesBand),
      dev: Boolean(histogramDev),
      ema: Boolean(seriesByKey.emaShort),
      humBand: Boolean(envelopesHumBand),
      humDev: Boolean(histogramHumDev),
      humEma: Boolean(seriesByKey.humEmaShort),
      thermo: false,
      thermoMotor: false,
    },
  };
}

/**
 * 패널 내 컨트롤러 equally 평균 → split Y.
 * M1: 내부적으로 집계+매핑. 보간 경로에서는 aggregate/map 분리 사용.
 */
export function buildUnifiedBarnTrendSeries(
  controllerSeriesList: TrendControllerSeries[],
  categories: string[],
  thresholds: AlarmThresholds,
  options: UnifiedBuildOptions = {},
): UnifiedBarnTrendBuild | null {
  const raw = aggregateUnifiedBarnTrendRaw(
    controllerSeriesList,
    categories,
    thresholds,
    { includeThermo: options.includeThermo },
  );
  if (!raw) return null;

  const visibility: SplitYVisibility = options.visibility ?? {
    showTemp: true,
    showHum: options.showHum ?? false,
    showMotors: true,
    showCommand: true,
  };
  const layout = options.layout ?? resolveSplitYLayout(visibility);
  void visibility;
  return mapUnifiedBarnTrendRawToSplitY(raw, layout);
}

export function pickUnifiedTrendLayers(
  built: UnifiedBarnTrendBuild,
  layers: UnifiedLayerFlags,
): {
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
} {
  const series: TrendSeries[] = [];
  if (layers.temp && built.seriesByKey.temp) series.push(built.seriesByKey.temp);
  if (layers.temp && layers.ema) {
    if (built.seriesByKey.emaShort) series.push(built.seriesByKey.emaShort);
  }
  if (layers.hum && built.seriesByKey.hum) series.push(built.seriesByKey.hum);
  if (layers.hum && layers.humEma) {
    if (built.seriesByKey.humEmaShort) series.push(built.seriesByKey.humEmaShort);
  }

  const envelopes: TrendEnvelope[] = [];
  if (layers.temp && layers.band && built.envelopesBand) {
    envelopes.push(built.envelopesBand);
  }
  if (layers.hum && layers.humBand && built.envelopesHumBand) {
    envelopes.push(built.envelopesHumBand);
  }

  const histograms: TrendHistogram[] = [];
  if (layers.temp && layers.dev && built.histogramDev) {
    histograms.push(built.histogramDev);
  }
  if (layers.hum && layers.humDev && built.histogramHumDev) {
    histograms.push(built.histogramHumDev);
  }
  if (layers.motors) {
    if (layers.motorCh && built.histogramMotorsChannels.length) {
      histograms.push(...built.histogramMotorsChannels);
    } else {
      histograms.push(...built.histogramMotorsMax);
    }
  }

  return { series, envelopes, histograms };
}

const CONTROLLER_OVERLAY_DASH = [
  undefined,
  "5 4",
  "2 3",
  "8 3 2 3",
  "1 4",
] as const;

/**
 * 같은 축사 컨트롤러를 평균 대신 본선 오버레이.
 * 2대 이상일 때만 시리즈를 만들고, 평균 온도·습도 본선은 호출측에서 걷는다.
 */
export function overlayControllerMetricSeries(args: {
  seriesList: TrendControllerSeries[];
  categories: string[];
  thresholds: AlarmThresholds;
  layout: SplitYLayout;
  overlayAlign?: TempBandAnchor;
  layers: UnifiedLayerFlags;
}): { series: TrendSeries[]; tempOverflowDomain: [number, number] | null } {
  if (args.seriesList.length < 2) {
    return { series: [], tempOverflowDomain: null };
  }
  const series: TrendSeries[] = [];
  const raws: (UnifiedBarnTrendRaw | null)[] = args.seriesList.map((item) =>
    aggregateUnifiedBarnTrendRaw(
      [item],
      args.categories,
      args.thresholds,
      { includeThermo: false },
    ),
  );
  const overflowShared = !tempBrokenAxisPlotZones(args.layout)
    ? null
    : resolveTempOverflowFitDomain(
        args.thresholds.tempLow,
        args.thresholds.tempHigh,
        raws.flatMap((raw) => (raw ? tempRawOverflowColumns(raw) : [])),
      );
  args.seriesList.forEach((item, index) => {
    const raw = raws[index];
    if (!raw) return;
    const built = mapUnifiedBarnTrendRawToSplitY(
      raw,
      args.layout,
      undefined,
      args.overlayAlign,
      overflowShared,
    );
    if (!built) return;
    const dash = CONTROLLER_OVERLAY_DASH[index % CONTROLLER_OVERLAY_DASH.length];
    const no = formatControllerNoLabel(item.eqpmnNo);
    if (args.layers.temp && built.seriesByKey.temp) {
      series.push({
        ...built.seriesByKey.temp,
        name: `${no} 온도`,
        strokeDasharray: dash,
      });
    }
    if (args.layers.hum && built.seriesByKey.hum) {
      series.push({
        ...built.seriesByKey.hum,
        name: `${no} 습도`,
        strokeDasharray: dash,
      });
    }
  });
  return { series, tempOverflowDomain: overflowShared };
}

export function replaceAverageMetricSeries(
  series: TrendSeries[],
  overlay: TrendSeries[],
): TrendSeries[] {
  if (!overlay.length) return series;
  const dropTemp = overlay.some(
    (item) => item.name === "온도" || item.name.endsWith(" 온도"),
  );
  const dropHum = overlay.some(
    (item) => item.name === "습도" || item.name.endsWith(" 습도"),
  );
  return [
    ...series.filter((item) => {
      if (dropTemp && item.name === "온도") return false;
      if (dropHum && item.name === "습도") return false;
      return true;
    }),
    ...overlay,
  ];
}

/** X스코프/트림 시 코리도 폴리 x를 [lo,hi]로 자르고 0 기준으로 재배치 */
function sliceEnvelopePolys(
  polys: TrendEnvelope["polys"] | undefined,
  lo: number,
  hi: number,
): TrendEnvelope["polys"] | undefined {
  if (!polys?.length) return polys;
  const out: TrendEnvelopePolyPoint[][] = [];

  const lerp = (
    a: TrendEnvelopePolyPoint,
    b: TrendEnvelopePolyPoint,
    x: number,
  ): TrendEnvelopePolyPoint => {
    const t = Math.abs(b.x - a.x) < 1e-12 ? 0 : (x - a.x) / (b.x - a.x);
    return {
      x,
      high: a.high + t * (b.high - a.high),
      low: a.low + t * (b.low - a.low),
    };
  };

  for (const run of polys) {
    if (run.length < 2) continue;
    const clipped: TrendEnvelopePolyPoint[] = [];
    for (let i = 0; i < run.length; i++) {
      const p = run[i]!;
      const prev = i > 0 ? run[i - 1]! : null;
      if (p.x >= lo && p.x <= hi) {
        if (clipped.length === 0 && prev && prev.x < lo) {
          clipped.push(lerp(prev, p, lo));
        }
        clipped.push(p);
      } else if (prev && prev.x <= hi && p.x > hi) {
        if (clipped.length === 0 && prev.x < lo) {
          clipped.push(lerp(prev, p, lo));
        } else if (clipped.length === 0 && prev.x >= lo && prev.x <= hi) {
          clipped.push(prev);
        }
        clipped.push(lerp(prev, p, hi));
      }
    }
    if (clipped.length < 2) continue;
    out.push(
      clipped.map((p) => ({
        x: p.x - lo,
        high: p.high,
        low: p.low,
      })),
    );
  }
  return out.length ? out : undefined;
}

/** 유한값이 있는 첫·끝 인덱스 */
export function findFiniteIndexSpan(
  columns: ((number | null)[] | undefined | null)[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;
  for (const col of columns) {
    if (!col?.length) continue;
    for (let i = 0; i < col.length; i++) {
      const v = col[i];
      if (v != null && Number.isFinite(v)) {
        if (start < 0 || i < start) start = i;
        if (i > end) end = i;
      }
    }
  }
  if (start < 0 || end < start) return null;
  return { start, end };
}

/**
 * 선두·후미 결측을 잘라 실데이터 구간에 맞춤 (좌우 소량 패딩).
 */
export function trimPickedUnifiedTrend(
  categories: string[],
  picked: {
    series: TrendSeries[];
    envelopes: TrendEnvelope[];
    histograms: TrendHistogram[];
  },
): {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
  trimmed: boolean;
} {
  const n = categories.length;
  if (n < 4) {
    return { categories, ...picked, trimmed: false };
  }

  const span = findFiniteIndexSpan([
    ...picked.series.map((s) => s.data),
    ...picked.series.map((s) => s.hoverSecondary),
    ...picked.envelopes.flatMap((e) => [e.high, e.low]),
    ...picked.histograms.map((h) => h.values),
    ...picked.histograms.map((h) => h.hoverSecondary),
  ]);
  if (!span) {
    return { categories, ...picked, trimmed: false };
  }

  const pad = Math.max(1, Math.min(4, Math.round(n * 0.03)));
  const start = Math.max(0, span.start - pad);
  const end = Math.min(n - 1, span.end + pad);
  if (start <= 0 && end >= n - 1) {
    return { categories, ...picked, trimmed: false };
  }

  const sliceCol = <T,>(arr: (T | null)[] | undefined): (T | null)[] | undefined =>
    arr ? arr.slice(start, end + 1) : arr;
  const sliceExtremes = (
    ex: TrendSeries["hoverSpreadExtremes"] | TrendEnvelope["hoverExtremes"],
  ) =>
    ex
      ? {
          high: ex.high.slice(start, end + 1),
          low: ex.low.slice(start, end + 1),
        }
      : ex;

  return {
    categories: categories.slice(start, end + 1),
    series: picked.series.map((s) => ({
      ...s,
      data: s.data.slice(start, end + 1),
      hoverSecondary: sliceCol(s.hoverSecondary),
      markerLabels: sliceCol(s.markerLabels),
      hoverNote: sliceCol(s.hoverNote),
      hoverSpreadExtremes: sliceExtremes(s.hoverSpreadExtremes),
    })),
    envelopes: picked.envelopes.map((e) => ({
      ...e,
      high: e.high.slice(start, end + 1),
      low: e.low.slice(start, end + 1),
      hoverExtremes: sliceExtremes(e.hoverExtremes),
      polys: sliceEnvelopePolys(e.polys, start, end),
    })),
    histograms: picked.histograms.map((h) => ({
      ...h,
      values: h.values.slice(start, end + 1),
      hoverSecondary: sliceCol(h.hoverSecondary),
      fillOpacityValues: sliceCol(h.fillOpacityValues),
      hoverChannels: h.hoverChannels?.map((ch) => ({
        ...ch,
        values: ch.values.slice(start, end + 1),
      })),
    })),
    trimmed: true,
  };
}

/**
 * 사용자 X스코프 — [start, end] inclusive로 카테고리·시리즈 슬라이스.
 */
export function sliceUnifiedTrendByIndex(
  categories: string[],
  picked: {
    series: TrendSeries[];
    envelopes: TrendEnvelope[];
    histograms: TrendHistogram[];
  },
  start: number,
  end: number,
): {
  categories: string[];
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  histograms: TrendHistogram[];
} {
  const n = categories.length;
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(n - 1, Math.max(start, end));
  if (n === 0 || lo > hi) {
    return { categories, ...picked };
  }
  if (lo === 0 && hi === n - 1) {
    return { categories, ...picked };
  }

  const sliceCol = <T,>(arr: (T | null)[] | undefined): (T | null)[] | undefined =>
    arr ? arr.slice(lo, hi + 1) : arr;
  const sliceExtremes = (
    ex: TrendSeries["hoverSpreadExtremes"] | TrendEnvelope["hoverExtremes"],
  ) =>
    ex
      ? {
          high: ex.high.slice(lo, hi + 1),
          low: ex.low.slice(lo, hi + 1),
        }
      : ex;

  return {
    categories: categories.slice(lo, hi + 1),
    series: picked.series.map((s) => ({
      ...s,
      data: s.data.slice(lo, hi + 1),
      hoverSecondary: sliceCol(s.hoverSecondary),
      markerLabels: sliceCol(s.markerLabels),
      hoverNote: sliceCol(s.hoverNote),
      hoverSpreadExtremes: sliceExtremes(s.hoverSpreadExtremes),
    })),
    envelopes: picked.envelopes.map((e) => ({
      ...e,
      high: e.high.slice(lo, hi + 1),
      low: e.low.slice(lo, hi + 1),
      hoverExtremes: sliceExtremes(e.hoverExtremes),
      polys: sliceEnvelopePolys(e.polys, lo, hi),
    })),
    histograms: picked.histograms.map((h) => ({
      ...h,
      values: h.values.slice(lo, hi + 1),
      hoverSecondary: sliceCol(h.hoverSecondary),
      fillOpacityValues: sliceCol(h.fillOpacityValues),
      hoverChannels: h.hoverChannels?.map((ch) => ({
        ...ch,
        values: ch.values.slice(lo, hi + 1),
      })),
    })),
  };
}
