import type {
  TrendEnvelope,
  TrendEnvelopePolyPoint,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import type { AlarmThresholds } from "@/lib/domain/alarms";
import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";

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

import { tempBrokenAxisPlotZones } from "./unified-barn-trend-layout";
import type {
  SplitYLayout,
  UnifiedLayerFlags,
} from "./unified-barn-trend-layout";
import {
  resolveTempOverflowFitDomain,
  tempRawOverflowColumns,
} from "./unified-trend-split-y";
import type { TempBandAnchor } from "./unified-trend-split-y";
import { aggregateUnifiedBarnTrendRaw } from "./unified-trend-raw";
import type { UnifiedBarnTrendRaw } from "./unified-trend-raw";
import { mapUnifiedBarnTrendRawToSplitY } from "./unified-trend-build";
import type { UnifiedBarnTrendBuild } from "./unified-trend-build";

export {
  OVERFLOW_FIT_MIN_PAD_C,
  OVERFLOW_FIT_PAD_RATIO,
  OVERLAY_ALIGN_ANCHOR,
  OVERLAY_ALIGN_HEAD_FRAC,
  SPLIT_Y_HUM_EDGE_PAD_PCT,
  SPLIT_Y_TEMP_EDGE_PAD_C,
  SPLIT_Y_TEMP_OVERFLOW_MIN_C,
  alarmEdgeDomain,
  buildSplitYBandScaleTicks,
  denormalizeFromAlarmRange,
  fitOverflowValueDomain,
  humidityAlarmMidpoint,
  mapEnvAbsToSplitY,
  mapHumDeviationToSplitY,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  mapTempDeviationToSplitY,
  normalizeToAlarmRange,
  overflowExtentAbove,
  paddedAlarmDomain,
  resolveTempOverflowFitDomain,
  resolveUnifiedPlotLayout,
  tempAlarmMidpoint,
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
} from "./unified-trend-split-y";
export type {
  SplitYBandScaleTick,
  TempBandAnchor,
  UnifiedPlotLayoutSpec,
} from "./unified-trend-split-y";

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
