/**
 * 통합 축사 추세의 공개 진입점.
 *
 * 임계 코리도만 이 파일에 둔다. 매핑·집계·조립·레이어는 옆 모듈에 있고,
 * 기존 import 경로를 유지하려고 공개 이름을 여기서 다시 내보낸다.
 */
import type {
  TrendEnvelope,
  TrendEnvelopePolyPoint,
} from "@/lib/domain/trend-chart-types";

export {
  DEV_HIST_COLOR_DOWN,
  DEV_HIST_COLOR_UP,
  EMA_LONG_COLOR,
  EMA_SHORT_COLOR,
  HUM_DEV_HIST_COLOR_DOWN,
  HUM_DEV_HIST_COLOR_UP,
  HUM_EMA_LONG_COLOR,
  HUM_EMA_SHORT_COLOR,
  UNIFIED_CHART_LABELS,
  UNIFIED_HUM_BAND_FILL,
  UNIFIED_TEMP_BAND_FILL,
} from "./unified-trend-colors";

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

export {
  OVERFLOW_FIT_MIN_PAD_C,
  OVERFLOW_FIT_PAD_RATIO,
  OVERLAY_ALIGN_ANCHOR,
  OVERLAY_ALIGN_HEAD_FRAC,
  SPLIT_Y_HUM_EDGE_PAD_PCT,
  SPLIT_Y_TEMP_EDGE_PAD_C,
  SPLIT_Y_TEMP_OVERFLOW_MIN_C,
  alarmEdgeDomain,
  denormalizeFromAlarmRange,
  humidityAlarmMidpoint,
  mapEnvAbsToSplitY,
  mapHumDeviationToSplitY,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  mapTempDeviationToSplitY,
  normalizeToAlarmRange,
  paddedAlarmDomain,
  resolveUnifiedPlotLayout,
  tempAlarmMidpoint,
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
} from "./unified-trend-split-y";
export type {
  TempBandAnchor,
  UnifiedPlotLayoutSpec,
} from "./unified-trend-split-y";
export {
  fitOverflowValueDomain,
  overflowExtentAbove,
  resolveTempOverflowFitDomain,
} from "./unified-trend-split-y-overflow";
export {
  buildSplitYBandScaleTicks,
} from "./unified-trend-split-y-ticks";
export type { SplitYBandScaleTick } from "./unified-trend-split-y-ticks";

export {
  aggregateUnifiedBarnTrendRaw,
  andSplitYVisibility,
  computeEmaSeries,
  metricAvailabilityFromSeriesList,
  tempDisplayDomainFromRaw,
} from "./unified-trend-raw";
export type {
  UnifiedBarnTrendRaw,
  UnifiedMetricAvailability,
} from "./unified-trend-raw";

export {
  buildUnifiedBarnTrendSeries,
  mapUnifiedBarnTrendRawToSplitY,
} from "./unified-trend-build";
export type {
  UnifiedBarnTrendBuild,
  UnifiedBuildOptions,
  UnifiedSeriesKey,
} from "./unified-trend-build";

export {
  findFiniteIndexSpan,
  overlayControllerMetricSeries,
  pickUnifiedTrendLayers,
  replaceAverageMetricSeries,
  sliceUnifiedTrendByIndex,
  trimPickedUnifiedTrend,
} from "./unified-trend-layers";
