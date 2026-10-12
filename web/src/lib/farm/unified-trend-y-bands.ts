/**
 * 통합 추세 레이어 플래그 · Y밴드 마스킹 · 밴드 히트.
 *
 * `unified-barn-trend-layout.ts`에서 분리(동작 보존). 밴드 기하(좌표·보간)는
 * 레이아웃 모듈에 남기고, 여기에는 레이어 가시성과 Y밴드 스코프만 둔다.
 */
import type {
  SplitYLayout,
  SplitYVisibility,
} from "./unified-barn-trend-layout";

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
