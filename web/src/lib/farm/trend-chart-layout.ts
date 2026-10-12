/**
 * TrendChart 레이아웃 순수 함수 — 좌표 매핑·눈금·밴드 배치.
 * React/DOM 비의존. `trend-chart.tsx`의 렌더 중 계산을 그대로 옮긴 것.
 */
import type { Band } from "@/lib/farm/severity-score";
import type { TrendPeriodId } from "@/lib/domain/farm-trend-types";
import type {
  TrendAxis,
  TrendCommandSettingSeg,
  TrendEventLane,
  TrendEventMark,
  TrendRangeBand,
  TrendReferenceLine,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";
import { formatTrendBandEdge } from "@/lib/farm/trend-chart-format";
import {
  type TrendBrushAxisTick,
  formatTrendAxisTickParts,
} from "@/lib/farm/trend-display-buckets";
import { PAD_TOP, trendMsToPlotX } from "@/lib/farm/trend-chart-geometry";

/** X 매핑에 필요한 플롯 수평 스케일 */
export type TrendPlotXScale = {
  n: number;
  /** categories 파싱 결과(ms). bar 모드/파싱 실패 시 null */
  timeAxisMs: number[] | null;
  padL: number;
  innerW: number;
};

/** 도메인 값 → 플롯 Y(view 단위). 비유한 입력은 바닥(PAD_TOP+innerH). */
export function plotYForValue(
  value: number,
  domain: readonly [number, number],
  innerH: number,
): number {
  const [mn, mx] = domain;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(mn) ||
    !Number.isFinite(mx)
  ) {
    return PAD_TOP + innerH;
  }
  const t = (value - mn) / (mx - mn || 1);
  return PAD_TOP + innerH - t * innerH;
}

/** 카테고리 인덱스 → 플롯 X. 시간축이 있으면 시간 비례, 없으면 등간격. */
export function plotXForIndex(i: number, scale: TrendPlotXScale): number {
  const { n, timeAxisMs, padL, innerW } = scale;
  if (n <= 1) return padL + innerW / 2;
  if (timeAxisMs && timeAxisMs.length === n) {
    const t0 = timeAxisMs[0]!;
    const ti = timeAxisMs[i];
    const span = timeAxisMs[n - 1]! - t0;
    if (span > 0 && ti != null && Number.isFinite(ti) && Number.isFinite(t0)) {
      const t = (ti - t0) / span;
      return padL + Math.min(1, Math.max(0, t)) * innerW;
    }
  }
  return padL + (i / (n - 1)) * innerW;
}

/** epoch ms → 플롯 X. 시간축이 없으면 null(단일 카테고리는 중앙). */
export function plotXForMs(ms: number, scale: TrendPlotXScale): number | null {
  const { n, timeAxisMs, padL, innerW } = scale;
  if (n <= 1) return padL + innerW / 2;
  if (timeAxisMs && timeAxisMs.length === n) {
    return trendMsToPlotX(ms, timeAxisMs[0]!, timeAxisMs[n - 1]!, padL, innerW);
  }
  return null;
}

export type TrendYAxisTicksMode = "full" | "thirds" | "ends";

export type TrendLeftAxisTick = {
  id: string;
  topPct: number;
  text: string;
};

/** 좌측 원단위 Y축 눈금. show=false 또는 도메인이 퇴화하면 빈 배열. */
export function buildLeftAxisTicks(input: {
  show: boolean;
  domain: readonly [number, number];
  mode: TrendYAxisTicksMode;
  chartH: number;
  innerH: number;
  unit: string;
}): TrendLeftAxisTick[] {
  const { show, domain, mode, chartH, innerH, unit } = input;
  const [lMin, lMax] = domain;
  if (!show || !Number.isFinite(lMin) || !Number.isFinite(lMax) || !(lMax > lMin)) {
    return [];
  }
  const steps =
    mode === "ends" ? [0, 1] : mode === "thirds" ? [0, 1, 2] : [0, 1, 2, 3, 4];
  const denom = Math.max(1, steps.length - 1);
  return steps.map((i) => {
    const value = lMin + ((lMax - lMin) * i) / denom;
    const y = plotYForValue(value, domain, innerH);
    return {
      id: `left-axis-${i}`,
      topPct: (y / chartH) * 100,
      text: formatTrendBandEdge(value, unit),
    };
  });
}

export type PositionedEventMark = {
  mark: TrendEventMark;
  xView: number;
  yView: number;
};

/** 이벤트 레인 마크 → 플롯 좌표. 시간축 밖(xForMs null) 마크는 제외. */
export function positionEventMarks(
  eventLane: TrendEventLane | null,
  lane: { eventLaneH: number; eventLaneTop: number },
  xForMs: (ms: number) => number | null,
): PositionedEventMark[] {
  if (!eventLane || lane.eventLaneH <= 0) return [];
  const rows = Math.max(1, eventLane.rowLabels.length);
  const out: PositionedEventMark[] = [];
  for (const mark of eventLane.marks) {
    const xView = xForMs(mark.atMs);
    if (xView == null) continue;
    const row = Math.min(rows - 1, Math.max(0, mark.row));
    const yView = lane.eventLaneTop + ((row + 0.5) / rows) * lane.eventLaneH;
    out.push({ mark, xView, yView });
  }
  return out;
}

export type PositionedCommandSettingHit = {
  seg: TrendCommandSettingSeg;
  x0: number;
  x1: number;
  y: number;
  h: number;
};

/**
 * 명령 설정 구간 → 플롯 사각형. X는 [xMin,xMax]로 클램프, 폭 0.3 이하 또는
 * Y 비유한 구간은 제외. 높이는 최소 2.
 */
export function positionCommandSettingHits(
  segs: readonly TrendCommandSettingSeg[],
  bounds: { xMin: number; xMax: number },
  xForMs: (ms: number) => number | null,
  yForLeft: (value: number) => number,
): PositionedCommandSettingHit[] {
  if (segs.length === 0) return [];
  const { xMin, xMax } = bounds;
  const out: PositionedCommandSettingHit[] = [];
  for (const seg of segs) {
    const raw0 = xForMs(seg.x0Ms);
    const raw1 = xForMs(seg.x1Ms);
    const x0 = raw0 ?? xMin;
    const x1 = raw1 ?? xMax;
    const xa = Math.max(xMin, Math.min(xMax, Math.min(x0, x1)));
    const xb = Math.max(xMin, Math.min(xMax, Math.max(x0, x1)));
    if (!(xb - xa > 0.3)) continue;
    const yA = yForLeft(seg.yLo);
    const yB = yForLeft(seg.yHi);
    if (!Number.isFinite(yA) || !Number.isFinite(yB)) continue;
    const y = Math.min(yA, yB);
    const h = Math.max(2, Math.abs(yB - yA));
    out.push({ seg, x0: xa, x1: xb, y, h });
  }
  return out;
}

export type TrendBarLayout = {
  barGroupW: number;
  barW: number;
  barSlotW: number;
  /** 팬 1~4개 — 차트 중앙 기준 클러스터(1=중앙, 2=중앙 좌·우). 5개 이상은 전폭 분산. */
  barCenterCluster: boolean;
};

export function computeBarLayout(input: {
  mode: "line" | "bar";
  n: number;
  innerW: number;
  seriesCount: number;
  barWidthCapPct?: number | null;
}): TrendBarLayout {
  const { mode, n, innerW, seriesCount, barWidthCapPct } = input;
  const barGroupW = n > 0 ? innerW / n : innerW;
  const rawBarW =
    seriesCount > 0 ? (barGroupW * 0.7) / seriesCount : barGroupW * 0.7;
  const barW =
    barWidthCapPct != null ? Math.min(rawBarW, barWidthCapPct) : rawBarW;
  const barSlotW = barW * Math.max(1, seriesCount);
  const barCenterCluster = mode === "bar" && n > 0 && n <= 4;
  return { barGroupW, barW, barSlotW, barCenterCluster };
}

/** 막대 그룹 중심 X. 클러스터 모드가 아니면 xFor(i)로 위임. */
export function plotXForBar(
  i: number,
  layout: TrendBarLayout,
  scale: TrendPlotXScale,
  xFor: (i: number) => number,
): number {
  const { n, padL, innerW } = scale;
  const center = padL + innerW / 2;
  if (n <= 1) return center;
  if (!layout.barCenterCluster) return xFor(i);
  const spacing = Math.min(
    Math.max(layout.barSlotW * 1.25, innerW / (n + 2)),
    n > 1 ? innerW / (n - 1) : innerW,
  );
  const span = (n - 1) * spacing;
  return center - span / 2 + i * spacing;
}

export type TrendAlarmBand = {
  band: Band;
  axis: TrendAxis;
  color?: string;
  fillWindow?: boolean;
  fillOpacity?: number;
  id?: string;
};

/**
 * 알람/한계 점선 — 시리즈 band는 동일 axis·lo·hi 1회(fillWindow=false),
 * rangeBands는 모두 fillWindow=true로 뒤에 붙인다.
 */
export function collectUniqueAlarmBands(
  series: readonly TrendSeries[],
  rangeBands: readonly TrendRangeBand[],
): TrendAlarmBand[] {
  const seen = new Set<string>();
  const out: TrendAlarmBand[] = [];
  for (const s of series) {
    if (!s.band) continue;
    const axis = s.axis ?? "left";
    const key = `${axis}:${s.band.lo}:${s.band.hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fillWindow = false;
    out.push({ band: s.band, axis, color: s.color, fillWindow });
  }
  for (const range of rangeBands) {
    out.push({
      id: range.id,
      band: { lo: range.lo, hi: range.hi },
      axis: range.axis ?? "left",
      color: range.color,
      fillWindow: true,
      fillOpacity: range.fillOpacity,
    });
  }
  return out;
}

/** referenceLines 중 알람 band 모서리(lo/hi)와 같은 축·값(±1e-6)인 점선 제거. */
export function dedupeReferenceLines(
  referenceLines: TrendReferenceLine[],
  bands: readonly TrendAlarmBand[],
): TrendReferenceLine[] {
  if (bands.length === 0) return referenceLines;
  return referenceLines.filter((ref) => {
    const axis = ref.axis ?? "left";
    return !bands.some(
      ({ band, axis: bandAxis }) =>
        bandAxis === axis &&
        (Math.abs(band.lo - ref.value) < 1e-6 ||
          Math.abs(band.hi - ref.value) < 1e-6),
    );
  });
}

export type TrendAxisTickView = {
  key: string;
  fullLabel: string;
  parts: { date: string | null; time: string | null };
  leftPct: number;
};

/** X축 메이저 눈금 → 라벨 파트 + 좌측 % 위치. period 없으면 fullLabel을 time으로. */
export function buildAxisTickViews(
  axisTicks: readonly TrendBrushAxisTick[],
  input: {
    period: TrendPeriodId | undefined;
    padL: number;
    innerW: number;
    viewW: number;
  },
): TrendAxisTickView[] {
  const { period, padL, innerW, viewW } = input;
  const last = axisTicks.length - 1;
  return axisTicks.map((mark, tickOrd) => {
    const prevLabel =
      tickOrd > 0 ? (axisTicks[tickOrd - 1]?.fullLabel ?? null) : null;
    const parts = period
      ? formatTrendAxisTickParts(period, mark.fullLabel, {
          endpoint: tickOrd === 0 || tickOrd === last,
          prevLabel,
          stacked: true,
        })
      : { date: null, time: mark.fullLabel };
    const xView = padL + mark.t * innerW;
    return {
      key: `${tickOrd}-${mark.fullLabel}`,
      fullLabel: mark.fullLabel,
      parts,
      leftPct: viewW > 0 ? (xView / viewW) * 100 : 0,
    };
  });
}
