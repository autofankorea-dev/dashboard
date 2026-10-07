/**
 * Split-Y 레이아웃 · 레이어/Y-band 순수 로직.
 *
 * `unified-barn-trend-series.ts`에서 분리(동작 보존). 밴드 배치·가시성·
 * 레이어 마스킹 등 순수 기하/설정 로직만 포함하며 집계·빌드에 의존하지 않는다.
 * 기존 import 호환을 위해 `unified-barn-trend-series.ts`가 이 모듈을 배럴 재노출한다.
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

export type UnifiedLayerId =
  | "motors"
  | "motorCh"
  | "temp"
  | "hum"
  | "band"
  | "dev"
  | "ema"
  | "humBand"
  | "humDev"
  | "humEma"
  | "thermo"
  | "thermoMotor";

export type UnifiedLayerFlags = Record<UnifiedLayerId, boolean>;

/** 기본: 온도·습도·모터 본선 + 온·습 산포 (레이어 툴바 「기본보기」와 동일) */
export const DEFAULT_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  motorCh: false,
  temp: true,
  hum: true,
  band: true,
  dev: false,
  ema: false,
  humBand: true,
  humDev: false,
  humEma: false,
  thermo: false,
  thermoMotor: false,
};

/** 분석용 — 본선 + 산포·편차·EMA5 + 모터 */
export const ALL_UNIFIED_LAYERS: UnifiedLayerFlags = {
  motors: true,
  motorCh: false,
  temp: true,
  hum: true,
  band: true,
  dev: true,
  ema: true,
  humBand: true,
  humDev: true,
  humEma: true,
  thermo: false,
  thermoMotor: false,
};

/** 습도 밴드가 필요한지 (본선·편차·산포·EMA) */
export function needsHumidityBand(layers: UnifiedLayerFlags): boolean {
  return layers.hum || layers.humDev || layers.humBand || layers.humEma;
}

/** split-Y에 그릴 밴드 가시성 */
export function splitYVisibilityFromLayers(
  layers: UnifiedLayerFlags,
): SplitYVisibility {
  return {
    showTemp:
      layers.temp ||
      layers.ema ||
      layers.dev ||
      layers.band,
    showHum: needsHumidityBand(layers),
    showMotors: layers.motors || layers.motorCh,
    showCommand: false,
  };
}

export type UnifiedYBandId = "temp" | "hum" | "motor" | "command" | "overlay";

export const UNIFIED_Y_BAND_LABEL: Record<UnifiedYBandId, string> = {
  temp: "온도",
  hum: "습도",
  motor: "모터",
  command: "명령",
  /** 오버레이: 본칸에 겹친 온도·습도. 모터는 하단 보조칸 */
  overlay: "온도·습도",
};

/** E — UI 칩·스코프 배지: 「온도 집중」 */
export function unifiedYBandFocusLabel(band: UnifiedYBandId): string {
  return `${UNIFIED_Y_BAND_LABEL[band]} 집중`;
}

/** 복수 Y밴드 스코프 칩: 「온도·명령 집중」 / 단일은 focusLabel */
export function unifiedYBandsScopeLabel(
  bands: UnifiedYBandId[] | null | undefined,
): string | null {
  if (!bands?.length) return null;
  if (bands.length === 1) return unifiedYBandFocusLabel(bands[0]!);
  return `${bands.map((b) => UNIFIED_Y_BAND_LABEL[b]).join("·")} 집중`;
}

/**
 * Y밴드 스코프에 따른 명령 레인 표시.
 * null/빈 배열 = 전체 → 표시. 명시적 목록이면 `command` 포함 시에만.
 */
export function eventLaneVisibleForYBands(
  yBands: UnifiedYBandId[] | null | undefined,
): boolean {
  if (yBands == null || yBands.length === 0) return true;
  return yBands.includes("command");
}

/** 온·습·모터 없이 명령 밴드만 — 플롯 시리즈 비움 + 레인 중심 레이아웃 */
export function isCommandOnlyYBands(
  yBands: UnifiedYBandId[] | null | undefined,
): boolean {
  if (!yBands?.length) return false;
  return yBands.every((b) => b === "command");
}

/** 표시 중인 통합 밴드 개수(플롯+명령). 높이 동등 분할용. */
export function countVisibleUnifiedBands(visibility: SplitYVisibility): {
  plot: number;
  command: number;
  total: number;
} {
  const plot =
    (visibility.showTemp ? 1 : 0) +
    (visibility.showHum ? 1 : 0) +
    (visibility.showMotors ? 1 : 0);
  const command = visibility.showCommand ? 1 : 0;
  return { plot, command, total: plot + command };
}

/**
 * 총 콘텐츠 높이를 켜진 밴드 수만큼 동등 분할.
 * 명령 레인도 슬롯 1개 — 레이어 off 시 고정 px에 묶이지 않음.
 */
export function allocateUnifiedChartBandHeights(input: {
  totalContentPx: number;
  visibility: SplitYVisibility;
  minCommandPx?: number;
  minPlotPx?: number;
  commandOnlyPlotGutterPx?: number;
}): { plotPx: number; commandPx: number } {
  const totalContentPx = Math.max(0, input.totalContentPx);
  const minCommandPx = input.minCommandPx ?? 56;
  const minPlotPx = input.minPlotPx ?? 48;
  const commandOnlyPlotGutterPx = input.commandOnlyPlotGutterPx ?? 72;
  const { plot, command, total } = countVisibleUnifiedBands(input.visibility);

  if (total <= 0 || totalContentPx <= 0) {
    return { plotPx: totalContentPx, commandPx: 0 };
  }

  if (command > 0 && plot === 0) {
    const gutter = Math.min(
      commandOnlyPlotGutterPx,
      Math.max(0, Math.floor(totalContentPx * 0.2)),
    );
    return {
      plotPx: gutter,
      commandPx: Math.max(0, totalContentPx - gutter),
    };
  }

  if (command === 0) {
    return { plotPx: totalContentPx, commandPx: 0 };
  }

  let commandPx = (command / total) * totalContentPx;
  let plotPx = totalContentPx - commandPx;

  if (commandPx < minCommandPx && totalContentPx >= minCommandPx + minPlotPx) {
    commandPx = minCommandPx;
    plotPx = totalContentPx - commandPx;
  }
  if (plotPx < minPlotPx && totalContentPx >= minCommandPx + minPlotPx) {
    plotPx = minPlotPx;
    commandPx = totalContentPx - plotPx;
  }

  return {
    plotPx: Math.max(0, Math.round(plotPx)),
    commandPx: Math.max(0, Math.round(commandPx)),
  };
}

/** motor → hum → temp → command 고정 순서 */
export function sortUnifiedYBands(ids: UnifiedYBandId[]): UnifiedYBandId[] {
  const order: UnifiedYBandId[] = ["overlay", "motor", "hum", "temp", "command"];
  return order.filter((id) => ids.includes(id));
}

export function isSingleYBandFocus(
  yBands: UnifiedYBandId[] | null | undefined,
): yBands is [UnifiedYBandId] {
  return Array.isArray(yBands) && yBands.length === 1;
}

/** 온·습·모터만 (플롯 multi 판정). command는 별도 레인. */
export function countSplitYBands(visibility: SplitYVisibility): number {
  return (
    (visibility.showTemp ? 1 : 0) +
    (visibility.showHum ? 1 : 0) +
    (visibility.showMotors ? 1 : 0)
  );
}

/**
 * 차트 domain Y(0–100) → 온/습/모터 밴드.
 * 구간 안이면 해당 밴드, 아니면 중심 최근접.
 */
export function hitSplitYBand(
  domainY: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId | null {
  const bands = listSplitYBands(layout, visibility);
  if (!bands.length || !Number.isFinite(domainY)) return null;
  for (const b of bands) {
    if (domainY >= b.lo && domainY <= b.hi) return b.id;
  }
  let best = bands[0]!;
  let bestD = Infinity;
  for (const b of bands) {
    const mid = (b.lo + b.hi) / 2;
    const d = Math.abs(domainY - mid);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best.id;
}

/**
 * 명령 레인 가상 밴드 (플롯 domain 0–100 아래).
 * 시리즈 매핑과 무관 — Y스코프 hit/조합 전용.
 */
export const COMMAND_SPLIT_Y_LO = -16;
export const COMMAND_SPLIT_Y_HI = 0;

/**
 * view Y비율 → domain Y.
 * 0=플롯 상단, 1=플롯 하단, >1=명령 레인(음수 domain).
 */
export function domainYFromViewRatio(
  yRatio: number,
  domain: [number, number] = [0, 100],
): number {
  const span = domain[1] - domain[0] || 1;
  if (!(yRatio > 1 + 1e-6)) {
    const r = Math.min(1, Math.max(0, yRatio));
    return domain[1] - r * span;
  }
  const t = Math.min(1, Math.max(0, yRatio - 1));
  return (
    COMMAND_SPLIT_Y_HI + t * (COMMAND_SPLIT_Y_LO - COMMAND_SPLIT_Y_HI)
  );
}

export function listSplitYBands(
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): { id: UnifiedYBandId; lo: number; hi: number }[] {
  const bands: { id: UnifiedYBandId; lo: number; hi: number }[] = [];
  /**
   * 오버레이: 같은 슬롯의 온·습은 「overlay」, 모터 보조칸은 따로.
   */
  const plotCandidates: { id: UnifiedYBandId; lo: number; hi: number }[] = [];
  if (visibility.showMotors && layout.motorHi - layout.motorLo > 0.5) {
    plotCandidates.push({
      id: "motor",
      lo: layout.motorLo,
      hi: layout.motorHi,
    });
  }
  if (visibility.showHum && layout.humHi - layout.humLo > 0.5) {
    plotCandidates.push({ id: "hum", lo: layout.humLo, hi: layout.humHi });
  }
  if (visibility.showTemp && layout.tempHi - layout.tempLo > 0.5) {
    plotCandidates.push({
      id: "temp",
      lo: layout.tempLo,
      hi: layout.tempHi,
    });
  }
  const merged =
    plotCandidates.length >= 2 &&
    plotCandidates.every(
      (c) =>
        Math.abs(c.lo - plotCandidates[0]!.lo) < 1e-3 &&
        Math.abs(c.hi - plotCandidates[0]!.hi) < 1e-3,
    );
  const envShareSlot = (a: { lo: number; hi: number }, b: { lo: number; hi: number }) =>
    Math.abs(a.lo - b.lo) < 1e-3 && Math.abs(a.hi - b.hi) < 1e-3;
  const tempBand = plotCandidates.find((c) => c.id === "temp");
  const humBand = plotCandidates.find((c) => c.id === "hum");
  const envMerged = Boolean(
    tempBand && humBand && envShareSlot(tempBand, humBand),
  );
  if (merged) {
    bands.push({
      id: "overlay",
      lo: plotCandidates[0]!.lo,
      hi: plotCandidates[0]!.hi,
    });
  } else {
    if (visibility.showMotors && layout.motorHi - layout.motorLo > 0.5) {
      bands.push({ id: "motor", lo: layout.motorLo, hi: layout.motorHi });
    }
    if (envMerged && tempBand) {
      bands.push({ id: "overlay", lo: tempBand.lo, hi: tempBand.hi });
    } else {
      if (visibility.showTemp && layout.tempHi - layout.tempLo > 0.5) {
        bands.push({ id: "temp", lo: layout.tempLo, hi: layout.tempHi });
      }
      if (visibility.showHum && layout.humHi - layout.humLo > 0.5) {
        bands.push({ id: "hum", lo: layout.humLo, hi: layout.humHi });
      }
    }
  }
  if (visibility.showCommand) {
    bands.push({
      id: "command",
      lo: COMMAND_SPLIT_Y_LO,
      hi: COMMAND_SPLIT_Y_HI,
    });
  }
  return bands;
}

/**
 * C안 — 드래그가 걸친 밴드 집합.
 * null = Y필터 없음(경계 모호 등, 레이어 그대로)
 * ["temp","hum"] = 그 밴드만 남김
 */
export function resolveYScopeBands(
  domainY0: number,
  domainY1: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId[] | null {
  const yLo = Math.min(domainY0, domainY1);
  const yHi = Math.max(domainY0, domainY1);
  let bands = listSplitYBands(layout, visibility);
  /** 플롯 구간만이면 명령 가상밴드 제외 — 레인 미터치 시 기존 UX 유지 */
  if (yLo >= -1e-6) {
    bands = bands.filter((b) => b.id !== "command");
  }
  if (bands.length <= 1) return null;

  const span = Math.max(yHi - yLo, 1e-3);
  const center = (yLo + yHi) / 2;

  const overlaps = bands
    .map((b) => {
      const o = Math.max(0, Math.min(yHi, b.hi) - Math.max(yLo, b.lo));
      const bandH = b.hi - b.lo;
      return {
        id: b.id,
        o,
        fracBand: o / bandH,
        fracSpan: o / span,
      };
    })
    .filter((x) => x.o > 0);

  const significant = overlaps.filter(
    (x) => x.fracBand >= 0.22 || x.fracSpan >= 0.35,
  );

  const sortIds = (ids: UnifiedYBandId[]) => sortUnifiedYBands(ids);

  /** 두 밴드 이상 걸침 → 걸린 밴드만 */
  if (significant.length >= 2) {
    return sortIds(significant.map((s) => s.id));
  }

  const primary = overlaps.sort((a, b) => b.o - a.o)[0] ?? null;
  const hitId =
    primary?.id ??
    bands.find((b) => center >= b.lo && center <= b.hi)?.id ??
    null;
  if (!hitId) return null;

  const hit = bands.find((b) => b.id === hitId)!;
  const bandH = hit.hi - hit.lo;
  const edgeMargin = bandH * 0.2;
  const nearLo = center < hit.lo + edgeMargin;
  const nearHi = center > hit.hi - edgeMargin;
  const neighborLo = bands.some(
    (b) => b.id !== hit.id && Math.abs(b.hi - hit.lo) < 0.75,
  );
  const neighborHi = bands.some(
    (b) => b.id !== hit.id && Math.abs(b.lo - hit.hi) < 0.75,
  );
  if ((nearLo && neighborLo) || (nearHi && neighborHi)) return null;

  if (span < bandH * 0.15) {
    if (center >= hit.lo && center <= hit.hi) return [hitId];
    return null;
  }

  const cover = overlaps.find((x) => x.id === hitId);
  if (cover && cover.fracBand >= 0.45) return [hitId];
  if (center >= hit.lo + edgeMargin && center <= hit.hi - edgeMargin) {
    return [hitId];
  }
  return null;
}

/** @deprecated resolveYScopeBands 사용 */
export function resolveYScopeBand(
  domainY0: number,
  domainY1: number,
  layout: SplitYLayout,
  visibility: SplitYVisibility,
): UnifiedYBandId | null {
  const bands = resolveYScopeBands(domainY0, domainY1, layout, visibility);
  if (!bands || bands.length !== 1) return null;
  return bands[0]!;
}

export function visibilityForYBands(
  bands: UnifiedYBandId[] | null,
): SplitYVisibility | null {
  if (!bands?.length) return null;
  const hasOverlay = bands.includes("overlay");
  return {
    showTemp: bands.includes("temp") || hasOverlay,
    showHum: bands.includes("hum") || hasOverlay,
    showMotors: bands.includes("motor"),
    showCommand: bands.includes("command"),
  };
}

export function visibilityForYBand(band: UnifiedYBandId): SplitYVisibility {
  return visibilityForYBands([band])!;
}

/** Y밴드 스코프 시 pick에서 허용 밴드 외 레이어 제외 (`command`는 시리즈에 영향 없음) */
export function maskLayersForYBands(
  layers: UnifiedLayerFlags,
  yBands: UnifiedYBandId[] | null,
): UnifiedLayerFlags {
  if (!yBands?.length) return layers;
  const allow = new Set(yBands);
  /** overlay = 본칸 온·습 겹침. 모터 보조칸은 motor 밴드만 */
  const keepTemp = allow.has("temp") || allow.has("overlay");
  const keepHum = allow.has("hum") || allow.has("overlay");
  const keepMotor = allow.has("motor");
  return {
    ...layers,
    temp: keepTemp && layers.temp,
    ema: keepTemp && layers.ema,
    dev: keepTemp && layers.dev,
    band: keepTemp && layers.band,
    hum: keepHum && layers.hum,
    humEma: keepHum && layers.humEma,
    humDev: keepHum && layers.humDev,
    humBand: keepHum && layers.humBand,
    motors: keepMotor && (layers.motors || layers.motorCh),
    motorCh: keepMotor && layers.motorCh,
    thermo: keepTemp && layers.thermo,
    thermoMotor: keepMotor && layers.thermoMotor,
  };
}

export function maskLayersForYBand(
  layers: UnifiedLayerFlags,
  yBand: UnifiedYBandId | null,
): UnifiedLayerFlags {
  return maskLayersForYBands(layers, yBand ? [yBand] : null);
}
