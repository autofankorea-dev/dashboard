/**
 * 조립된 통합 추세에서 레이어를 고르고, 컨트롤러 오버레이와 구간 트림을 한다.
 *
 * 공개 이름은 배럴이 다시 내보내 기존 import 경로를 유지한다.
 */
import type { AlarmThresholds } from "@/lib/domain/alarms";
import type { TrendControllerSeries } from "@/lib/domain/farm-trend-types";
import type {
  TrendEnvelope,
  TrendEnvelopePolyPoint,
  TrendHistogram,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { formatControllerNoLabel } from "@/lib/farm/controller-summary-display";
import { tempBrokenAxisPlotZones } from "./unified-barn-trend-layout";
import type {
  SplitYLayout,
  UnifiedLayerFlags,
} from "./unified-barn-trend-layout";
import {
  resolveTempOverflowFitDomain,
  tempRawOverflowColumns,
} from "./unified-trend-split-y-overflow";
import type { TempBandAnchor } from "./unified-trend-split-y";
import { aggregateUnifiedBarnTrendRaw } from "./unified-trend-raw";
import type { UnifiedBarnTrendRaw } from "./unified-trend-raw";
import { mapUnifiedBarnTrendRawToSplitY } from "./unified-trend-build";
import type { UnifiedBarnTrendBuild } from "./unified-trend-build";

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
