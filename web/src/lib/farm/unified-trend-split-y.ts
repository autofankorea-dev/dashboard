/**
 * Split-Y 값↔밴드 매핑.
 *
 * `unified-barn-trend-series.ts`에서 분리(동작 보존).
 * 레이아웃 기하와 집계·시리즈 조립을 모른다.
 * 공개 이름은 배럴이 다시 내보내 기존 import 경로를 유지한다.
 */
import type { AlarmThresholds } from "@/lib/domain/alarms";
import {
  ALARM_PAD_RATIO,
  countSplitYBands,
  resolveSplitYLayout,
  SPLIT_Y_WITH_HUM,
  tempBrokenAxisPlotZones,
} from "./unified-barn-trend-layout";
import type {
  SplitYLayout,
  SplitYVisibility,
  UnifiedYBandId,
} from "./unified-barn-trend-layout";

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
/** 겹쳐보기 기준 구간(꺾임 아래)에서 온·습 상·하한을 같은 높이에 두는 헤드룸 */
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

/** 겹쳐보기 — 온·습 기준 가장자리는 꺾임 아래(선형 칸)에 맞춘다. */
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

export function tempBrokenLinearEdge(
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

/** 기준(선형) 밖 실측 min–max + 여유. 위칸만 이 폭으로 채움. */
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

/** 온도 실측 열. 집계 타입에 묶지 않아 모듈 순환을 피한다. */
export function tempRawOverflowColumns(raw: {
  tempAvg: readonly (number | null | undefined)[];
  tempMin: readonly (number | null | undefined)[];
  tempMax: readonly (number | null | undefined)[];
  emaShortRaw: readonly (number | null | undefined)[];
  emaLongRaw: readonly (number | null | undefined)[];
}): (readonly (number | null | undefined)[])[] {
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
 * 기준 띠가 있는 패널은 온·습 기준 중간값을 건너뛰고 현장 알람 평균을 둔다.
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
 * `anchor` 지정 시 기준 구간은 꺾임 아래에 맞추고, 초과는 위칸 이탈 스케일.
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

/** @deprecated */
export function mapEnvAbsToSplitY(
  value: number | null | undefined,
  tempLow = 10,
  tempHigh = 35,
): number | null {
  return mapTempCToSplitY(value, tempLow, tempHigh);
}

export function mapColumn(
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
