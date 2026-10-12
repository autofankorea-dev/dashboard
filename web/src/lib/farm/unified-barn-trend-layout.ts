/**
 * Split-Y 밴드 기하 — 좌표, 보간, 온도 표시 도메인.
 *
 * 레이어 플래그·Y밴드 마스킹은 `unified-trend-y-bands.ts`.
 * 기존 import 경로를 유지하려고 그 공개 이름을 여기서 다시 내보낸다.
 * `unified-barn-trend-series.ts`가 두 모듈을 배럴로 재노출한다.
 */

export type SplitYLayout = {
  motorLo: number;
  motorHi: number;
  humLo: number;
  humHi: number;
  tempLo: number;
  tempHi: number;
  domain: [number, number];
};

export type SplitYVisibility = {
  showTemp: boolean;
  showHum: boolean;
  showMotors: boolean;
  /** 명령 이력 레인 — Y밴드 스코프 조합(가상 domain 밴드) */
  showCommand: boolean;
};

/**
 * 밴드 사이 여백 (domain 0–100).
 * 모바일 ~320px 기준 ≈26px — 상·하한 라벨 칩 충돌 완화.
 */
export const SPLIT_Y_BAND_GAP = 8;

/** 온도+모터가 같이 켜진 분할 보기 — 모터 절반을 온도 위 꺾인 축으로. */
export const SPLIT_Y_MOTOR_WEIGHT_WITH_TEMP = 0.5;
export const SPLIT_Y_TEMP_WEIGHT_WITH_MOTOR = 1.5;
/** 온도 칸에서 위쪽(더위 초과)이 차지하는 비율 — 모터에서 가져온 ½ / 온도 1½ */
export const SPLIT_Y_TEMP_OVERFLOW_FRAC =
  SPLIT_Y_MOTOR_WEIGHT_WITH_TEMP / SPLIT_Y_TEMP_WEIGHT_WITH_MOTOR;
/** 꺾인 축 사이 빈 구간 (domain 0–100) */
export const SPLIT_Y_TEMP_BREAK_GAP = 2;
/** 겹쳐보기 — 모터 하단 보조칸 비율 (Canvas MOTOR_GUTTER) */
export const OVERLAY_MOTOR_GUTTER_WEIGHT = 0.16;

/**
 * 활성 플롯 밴드 0–100 분배 (단독이면 전폭).
 * 온도+모터 분할: 모터 ½ · 습도 1 · 온도 1½. 그 외는 동등.
 * 밴드 사이에는 {@link SPLIT_Y_BAND_GAP} 만큼 빈 구간.
 * 명령 레인은 픽셀 높이 풀({@link allocateUnifiedChartBandHeights})에서 동등 슬롯.
 */
export function resolveSplitYLayout(
  visibility: boolean | SplitYVisibility,
  overlay = false,
): SplitYLayout {
  const flags: SplitYVisibility =
    typeof visibility === "boolean"
      ? {
          showTemp: true,
          showHum: visibility,
          showMotors: true,
          showCommand: true,
        }
      : visibility;

  /**
   * 오버레이: 온·습은 본칸에 겹친다. 모터가 있으면 하단 보조칸.
   */
  const plotCount =
    (flags.showMotors ? 1 : 0) +
    (flags.showHum ? 1 : 0) +
    (flags.showTemp ? 1 : 0);
  const mergeOverlay = overlay && plotCount >= 2;

  const parts: { key: "motor" | "hum" | "temp" | "overlay"; w: number }[] = [];
  if (mergeOverlay) {
    if (flags.showMotors) {
      parts.push({ key: "motor", w: OVERLAY_MOTOR_GUTTER_WEIGHT });
    }
    parts.push({
      key: "overlay",
      w: flags.showMotors ? 1 - OVERLAY_MOTOR_GUTTER_WEIGHT : 1,
    });
  } else {
    if (flags.showMotors) {
      parts.push({
        key: "motor",
        w: flags.showTemp ? SPLIT_Y_MOTOR_WEIGHT_WITH_TEMP : 1,
      });
    }
    if (flags.showHum) parts.push({ key: "hum", w: 1 });
    if (flags.showTemp) {
      parts.push({
        key: "temp",
        w: flags.showMotors ? SPLIT_Y_TEMP_WEIGHT_WITH_MOTOR : 1,
      });
    }
  }

  if (parts.length === 0) {
    return {
      motorLo: 0,
      motorHi: 0,
      humLo: 0,
      humHi: 0,
      tempLo: 0,
      tempHi: 0,
      domain: [0, 100],
    };
  }

  const sum = parts.reduce((a, p) => a + p.w, 0);
  const gapTotal = Math.max(0, parts.length - 1) * SPLIT_Y_BAND_GAP;
  const usable = Math.max(0, 100 - gapTotal);
  let cursor = 0;
  const bands: Record<
    "motor" | "hum" | "temp" | "overlay",
    { lo: number; hi: number }
  > = {
    motor: { lo: 0, hi: 0 },
    hum: { lo: 0, hi: 0 },
    temp: { lo: 0, hi: 0 },
    overlay: { lo: 0, hi: 0 },
  };
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    if (i > 0) cursor += SPLIT_Y_BAND_GAP;
    const lo = cursor;
    cursor += (p.w / sum) * usable;
    bands[p.key] = { lo, hi: cursor };
  }

  if (mergeOverlay) {
    const slot = bands.overlay;
    return {
      motorLo: flags.showMotors ? bands.motor.lo : 0,
      motorHi: flags.showMotors ? bands.motor.hi : 0,
      humLo: flags.showHum ? slot.lo : 0,
      humHi: flags.showHum ? slot.hi : 0,
      tempLo: flags.showTemp ? slot.lo : 0,
      tempHi: flags.showTemp ? slot.hi : 0,
      domain: [0, 100],
    };
  }

  return {
    motorLo: bands.motor.lo,
    motorHi: bands.motor.hi,
    humLo: bands.hum.lo,
    humHi: bands.hum.hi,
    tempLo: bands.temp.lo,
    tempHi: bands.temp.hi,
    domain: [0, 100],
  };
}

export type TempBrokenAxisPlotZones = {
  linear: { lo: number; hi: number };
  overflow: { lo: number; hi: number };
  breakY: number;
};

/**
 * 온도 칸 — 위쪽이 더위 초과, 아래가 기준±여유.
 * 모터 칸 유무와 무관. 겹쳐보기(한 슬롯)에도 쓴다. 온도 단독(원단위 ℃)에서는 null.
 */
export function tempBrokenAxisPlotZones(
  layout: SplitYLayout,
): TempBrokenAxisPlotZones | null {
  if (!(layout.tempHi > layout.tempLo)) return null;
  const nativeTemp =
    layout.tempLo === layout.domain[0] &&
    layout.tempHi === layout.domain[1] &&
    !(layout.domain[0] === 0 && layout.domain[1] === 100);
  if (nativeTemp) return null;
  const span = layout.tempHi - layout.tempLo;
  const overflowSpan = span * SPLIT_Y_TEMP_OVERFLOW_FRAC;
  const gap = Math.min(SPLIT_Y_TEMP_BREAK_GAP, overflowSpan * 0.25);
  const overflowLo = layout.tempHi - overflowSpan;
  const linearHi = overflowLo - gap;
  if (!(linearHi > layout.tempLo) || !(layout.tempHi > overflowLo)) {
    return null;
  }
  return {
    linear: { lo: layout.tempLo, hi: linearHi },
    overflow: { lo: overflowLo, hi: layout.tempHi },
    breakY: (linearHi + overflowLo) / 2,
  };
}

/** 습도 ON — 모터 · 습도 · 온도 (밴드 사이 갭 포함) */
export const SPLIT_Y_WITH_HUM: SplitYLayout = resolveSplitYLayout({
  showTemp: true,
  showHum: true,
  showMotors: true,
  showCommand: true,
});

/** 습도 OFF — 모터 · 온도 (밴드 사이 갭 포함) */
export const SPLIT_Y_TEMP_EXPANDED: SplitYLayout = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: true,
  showCommand: true,
});

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** split-Y 레이아웃 선형 보간 (밴드 리플로우 모션) */
export function lerpSplitYLayout(
  from: SplitYLayout,
  to: SplitYLayout,
  t: number,
): SplitYLayout {
  const u = Math.max(0, Math.min(1, t));
  return {
    motorLo: lerpNum(from.motorLo, to.motorLo, u),
    motorHi: lerpNum(from.motorHi, to.motorHi, u),
    humLo: lerpNum(from.humLo, to.humLo, u),
    humHi: lerpNum(from.humHi, to.humHi, u),
    tempLo: lerpNum(from.tempLo, to.tempLo, u),
    tempHi: lerpNum(from.tempHi, to.tempHi, u),
    domain: [0, 100],
  };
}

export function splitYLayoutsEqual(
  a: SplitYLayout,
  b: SplitYLayout,
  eps = 1e-3,
): boolean {
  return (
    Math.abs(a.motorLo - b.motorLo) < eps &&
    Math.abs(a.motorHi - b.motorHi) < eps &&
    Math.abs(a.humLo - b.humLo) < eps &&
    Math.abs(a.humHi - b.humHi) < eps &&
    Math.abs(a.tempLo - b.tempLo) < eps &&
    Math.abs(a.tempHi - b.tempHi) < eps
  );
}

/** easeOutCubic — 밴드 채움 종료감 */
export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u * u;
}

function splitYBandActive(lo: number, hi: number, eps = 0.5): boolean {
  return hi - lo > eps;
}

/** 활성 플롯 밴드의 [lo, hi] 목록 (온도·습도·모터). */
export function splitYLayoutPlotSlots(
  layout: SplitYLayout,
): [number, number][] {
  const slots: [number, number][] = [];
  if (splitYBandActive(layout.tempLo, layout.tempHi)) {
    slots.push([layout.tempLo, layout.tempHi]);
  }
  if (splitYBandActive(layout.humLo, layout.humHi)) {
    slots.push([layout.humLo, layout.humHi]);
  }
  if (splitYBandActive(layout.motorLo, layout.motorHi)) {
    slots.push([layout.motorLo, layout.motorHi]);
  }
  return slots;
}

/** 켜진 플롯 밴드가 같은 슬롯을 공유하면 오버레이 최종 상태. */
export function splitYLayoutIsFullyMerged(
  layout: SplitYLayout,
  eps = 0.75,
): boolean {
  const slots = splitYLayoutPlotSlots(layout);
  if (slots.length < 2) return false;
  const [lo0, hi0] = slots[0]!;
  return slots.every(
    ([lo, hi]) => Math.abs(lo - lo0) < eps && Math.abs(hi - hi0) < eps,
  );
}

/** 습도 밴드가 온도·모터와 다른 구간에 있으면 3분할(또는 습도 단독 슬롯). */
export function splitYLayoutHasDistinctHumBand(layout: SplitYLayout): boolean {
  if (!splitYBandActive(layout.humLo, layout.humHi)) return false;
  const others: [number, number][] = [];
  if (splitYBandActive(layout.tempLo, layout.tempHi)) {
    others.push([layout.tempLo, layout.tempHi]);
  }
  if (splitYBandActive(layout.motorLo, layout.motorHi)) {
    others.push([layout.motorLo, layout.motorHi]);
  }
  return others.some(
    ([lo, hi]) =>
      Math.abs(lo - layout.humLo) > 1 || Math.abs(hi - layout.humHi) > 1,
  );
}

/**
 * 오버레이 1단계 목표 — 활성 밴드를 습도 슬롯에 맞춘다.
 * `splitLayout`은 3분할(습도 밴드가 있는) 쪽이어야 한다.
 */
export function overlayMeetSplitYLayout(
  splitLayout: SplitYLayout,
): SplitYLayout {
  const humLo = splitLayout.humLo;
  const humHi = splitLayout.humHi;
  const slot = (lo: number, hi: number): [number, number] =>
    splitYBandActive(lo, hi) ? [humLo, humHi] : [0, 0];
  const [motorLo, motorHi] = slot(splitLayout.motorLo, splitLayout.motorHi);
  const [tempLo, tempHi] = slot(splitLayout.tempLo, splitLayout.tempHi);
  return {
    motorLo,
    motorHi,
    humLo,
    humHi,
    tempLo,
    tempHi,
    domain: [0, 100],
  };
}

export function isOverlayStagedLayoutTransition(
  from: SplitYLayout,
  to: SplitYLayout,
): boolean {
  return (
    (splitYLayoutHasDistinctHumBand(from) &&
      splitYLayoutIsFullyMerged(to)) ||
    (splitYLayoutIsFullyMerged(from) &&
      splitYLayoutHasDistinctHumBand(to))
  );
}

/**
 * 오버레이 2단 보간: 습도 슬롯에서 만난 뒤 0–100으로 팽창(또는 그 역).
 * 각 단계는 easeOutCubic.
 */
export function lerpSplitYLayoutStaged(
  from: SplitYLayout,
  to: SplitYLayout,
  t: number,
): SplitYLayout {
  const meetSource = splitYLayoutHasDistinctHumBand(from) ? from : to;
  const meet = overlayMeetSplitYLayout(meetSource);
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.5) {
    return lerpSplitYLayout(from, meet, easeOutCubic(u * 2));
  }
  return lerpSplitYLayout(meet, to, easeOutCubic((u - 0.5) * 2));
}

/** 알람 lo–hi 대비 상·하 여유 비율. 표시 온도 최솟·최댓값 패딩에도 동일 비율. */
export const ALARM_PAD_RATIO = 0.2;

/** 최솟·최댓값 구간에 padRatio만큼 위·아래 여유. 거의 평탄하면 minSpan ℃. */
export function paddedExtentDomain(
  min: number,
  max: number,
  padRatio: number = ALARM_PAD_RATIO,
  minSpan = 1,
): [number, number] {
  let lo = min;
  let hi = max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) {
    const mid = Number.isFinite(lo)
      ? lo
      : Number.isFinite(hi)
        ? hi
        : 0;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const span = Math.max(hi - lo, minSpan);
  const pad = span * padRatio;
  return [lo - pad, hi + pad];
}

export function finiteExtent(
  columns: readonly (readonly (number | null | undefined)[])[],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const col of columns) {
    for (const v of col) {
      if (v == null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/** 그래프에 올라가는 값의 최솟·최댓값 + 여유. 값 없으면 fallback. */
export function fitTempDisplayDomain(
  columns: readonly (readonly (number | null | undefined)[])[],
  fallback: [number, number],
): [number, number] {
  const ext = finiteExtent(columns);
  if (!ext) return fallback;
  return paddedExtentDomain(ext.min, ext.max);
}

export type {
  UnifiedLayerId,
  UnifiedLayerFlags,
  UnifiedYBandId,
} from "./unified-trend-y-bands";
export {
  DEFAULT_UNIFIED_LAYERS,
  ALL_UNIFIED_LAYERS,
  needsHumidityBand,
  splitYVisibilityFromLayers,
  UNIFIED_Y_BAND_LABEL,
  unifiedYBandFocusLabel,
  unifiedYBandsScopeLabel,
  eventLaneVisibleForYBands,
  isCommandOnlyYBands,
  countVisibleUnifiedBands,
  allocateUnifiedChartBandHeights,
  sortUnifiedYBands,
  isSingleYBandFocus,
  countSplitYBands,
  hitSplitYBand,
  COMMAND_SPLIT_Y_LO,
  COMMAND_SPLIT_Y_HI,
  domainYFromViewRatio,
  listSplitYBands,
  resolveYScopeBands,
  resolveYScopeBand,
  visibilityForYBands,
  visibilityForYBand,
  maskLayersForYBands,
  maskLayersForYBand,
} from "./unified-trend-y-bands";
