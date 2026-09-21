/**
 * 추이 차트 순수 기하/스케일 헬퍼.
 *
 * React·DOM 의존이 없는 값 계산만 모아 `trend-chart.tsx`에서 분리한다.
 * (상호작용 훅·SVG 렌더러는 별도 모듈)
 */

import type {
  TrendAxis,
  TrendEnvelope,
  TrendScaleEdgeLabel,
  TrendSeries,
} from "@/lib/data/trend-chart-types";
import { inferHoverMetricGroup } from "./trend-chart-format";

/** view 좌표 매퍼 — 렌더 시점 도메인·크기에 닫힌 클로저를 주입받는다. */
type XForFn = (i: number) => number;
type YForFn = (value: number, axis: TrendAxis) => number;

/**
 * 시리즈를 polyline 세그먼트 문자열로. null/비유한 값에서 끊어 gap을 만든다.
 * (SVG `points` 좌표 계산 — 순수)
 */
export function buildLineSegments(
  s: TrendSeries,
  xFor: XForFn,
  yFor: YForFn,
): string[] {
  const axis = s.axis ?? "left";
  const segs: string[] = [];
  let cur: string[] = [];
  s.data.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length > 1) segs.push(cur.join(" "));
      cur = [];
      return;
    }
    cur.push(`${xFor(i).toFixed(2)},${yFor(v, axis).toFixed(2)}`);
  });
  if (cur.length > 1) segs.push(cur.join(" "));
  return segs;
}

/**
 * 엔벨로프(밴드)를 채움 path(`d`) 배열로. polys가 있으면 run별로, 없으면 high/low에서
 * 유효 구간을 이어 상단→하단 역순으로 닫는다. (순수)
 */
export function buildEnvelopePaths(
  env: TrendEnvelope,
  n: number,
  xFor: XForFn,
  yFor: YForFn,
): string[] {
  const axis = env.axis ?? "left";
  if (env.polys?.length) {
    const paths: string[] = [];
    for (const run of env.polys) {
      if (run.length < 2) continue;
      const top = run.map(
        (p) => `${xFor(p.x).toFixed(2)},${yFor(p.high, axis).toFixed(2)}`,
      );
      const bot = run.map(
        (p) => `${xFor(p.x).toFixed(2)},${yFor(p.low, axis).toFixed(2)}`,
      );
      paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
    }
    return paths;
  }
  const len = Math.min(env.high.length, env.low.length, n);
  if (len < 2) return [];
  const paths: string[] = [];
  let top: string[] = [];
  let bot: string[] = [];
  const flush = () => {
    if (top.length >= 2) {
      paths.push(`M${top.join(" L")} L${[...bot].reverse().join(" L")} Z`);
    }
    top = [];
    bot = [];
  };
  for (let i = 0; i < len; i++) {
    const hi = env.high[i];
    const lo = env.low[i];
    if (
      hi == null ||
      lo == null ||
      !Number.isFinite(hi) ||
      !Number.isFinite(lo)
    ) {
      flush();
      continue;
    }
    top.push(`${xFor(i).toFixed(2)},${yFor(hi, axis).toFixed(2)}`);
    bot.push(`${xFor(i).toFixed(2)},${yFor(lo, axis).toFixed(2)}`);
  }
  flush();
  return paths;
}

/** 플롯 안 좌우 여백 — 라벨은 바깥 칸. 선이 테두리에 붙지 않을 정도만 (너비의 1%). */
export const PAD_X = 1;
export const PAD_TOP = 6;
/** 모터 하단과 날짜축 사이 간격 (viewBox 단위) */
export const PAD_BOTTOM = 6;
/** 측정 전 fallback · 패딩 비율 기준 */
export const VIEW_W_NORM = 100;

/**
 * 화면 px 반지름을 SVG viewBox 단위로 변환한다.
 * 첫 렌더의 1×1 측정값은 실제 크기가 아니므로 fallback view 크기를 기준으로 삼아
 * ResizeObserver 반영 전 marker가 과대 확대되지 않게 한다.
 */
export function markerRadiusInViewUnits(
  radiusPx: number,
  viewSize: number,
  measuredPx: number,
  measuredReadyMin: number,
): number {
  const renderedPx =
    Number.isFinite(measuredPx) && measuredPx > measuredReadyMin
      ? measuredPx
      : viewSize;
  return (radiusPx * viewSize) / Math.max(1, renderedPx);
}

export type TrendPlotPadOpts = {
  /** 왼쪽 단위축(℃ 등) — padL = PAD_X */
  leftUnit?: boolean;
  /** 모바일 우측 거터(레거시 플롯 안 라벨) — padR 확대, leftUnit 없으면 padL 축소 */
  labelGutter?: boolean;
};

/** 플롯 박스(0–1) 기준 좌·우 패딩 · 안쪽 폭. TrendChart `xFor`와 동일. */
export function trendPlotPadRatios(opts: TrendPlotPadOpts = {}): {
  padL: number;
  padR: number;
  innerW: number;
} {
  const leftUnit = Boolean(opts.leftUnit);
  const labelGutter = Boolean(opts.labelGutter);
  const padL0 = leftUnit ? PAD_X : labelGutter ? 4 : PAD_X;
  const padR0 = labelGutter ? 20 : PAD_X;
  const padL = padL0 / VIEW_W_NORM;
  const padR = padR0 / VIEW_W_NORM;
  return { padL, padR, innerW: 1 - padL - padR };
}

export function trendPlotPadPx(
  viewW: number,
  opts: TrendPlotPadOpts = {},
): { padL: number; padR: number; innerW: number } {
  const r = trendPlotPadRatios(opts);
  const padL = r.padL * viewW;
  const padR = r.padR * viewW;
  return { padL, padR, innerW: viewW - padL - padR };
}

/** 데이터 시각 비율(0–1) → 플롯 박스 가로 비율(패딩 포함). */
export function trendTimeToPlotRatio(
  t01: number,
  opts: TrendPlotPadOpts = {},
): number {
  const { padL, innerW } = trendPlotPadRatios(opts);
  if (!Number.isFinite(t01)) return padL;
  const t = Math.min(1, Math.max(0, t01));
  return padL + t * innerW;
}

/** 시각 ms → TrendChart `xFor`와 같은 플롯 X (패딩 포함 view 좌표). */
export function trendMsToPlotX(
  ms: number,
  t0: number,
  t1: number,
  padL: number,
  innerW: number,
): number | null {
  if (
    !Number.isFinite(ms) ||
    !Number.isFinite(t0) ||
    !Number.isFinite(t1) ||
    !(t1 > t0)
  ) {
    return null;
  }
  if (ms < t0) return null;
  if (ms > t1) return padL + innerW;
  return padL + ((ms - t0) / (t1 - t0)) * innerW;
}

export const X_SCOPE_DRAG_PX = 8;
export const X_SCOPE_MIN_SPAN = 3;

/** 스코프 Y비율이 플롯 본문(0~1)을 넘어 명령 레인을 포함하는지 */
export function xScopeTouchesCommandLane(
  yStartRatio: number,
  yEndRatio: number,
): boolean {
  return yStartRatio > 1 + 1e-6 || yEndRatio > 1 + 1e-6;
}

/** 알람 가이드선 hit (화면 px) */
export const SCALE_EDGE_HIT_PX = 10;
/** 라벨에서 드래그 시작까지 이동량 — 클릭과 구분 */
export const SCALE_EDGE_LABEL_DRAG_PX = 4;

export function parseScaleEdgeEditSeed(
  guide: Pick<TrendScaleEdgeLabel, "editValue" | "text">,
): string {
  if (guide.editValue != null && Number.isFinite(guide.editValue)) {
    return String(guide.editValue);
  }
  const m = guide.text.match(/-?\d+(?:\.\d+)?/);
  return m?.[0] ?? "";
}

/** `28.5℃` / `+5℃` / `100%` → 단위 접미 (`℃`, `%`) */
export function parseScaleEdgeValueUnit(text: string): string {
  const m = text.match(/-?\d+(?:\.\d+)?(.*)$/);
  return (m?.[1] ?? "").trim();
}

export function tipPinId(idx: number, seriesKey: string): string {
  const g = inferHoverMetricGroup(seriesKey);
  return `${idx}::${g}`;
}

/** 앵커 기준 카드 left/top (px) — 플롯 안·포인터 가리지 않게 */
export function computeTipPlacement(
  anchorX: number,
  anchorY: number,
  plotW: number,
  plotH: number,
  tipW = 168,
  tipH = 88,
): { left: number; top: number } {
  const gap = 14;
  const pad = 4;
  const spaceRight = plotW - anchorX - pad;
  const spaceLeft = anchorX - pad;
  const preferRight = spaceRight >= tipW + gap || spaceRight >= spaceLeft;
  let left = preferRight ? anchorX + gap : anchorX - tipW - gap;
  left = Math.min(Math.max(pad, left), Math.max(pad, plotW - tipW - pad));
  const preferAbove = anchorY - pad >= tipH + gap;
  let top = preferAbove ? anchorY - tipH - gap : anchorY + gap;
  top = Math.min(Math.max(pad, top), Math.max(pad, plotH - tipH - pad));
  return { left: Math.round(left), top: Math.round(top) };
}

export type EdgeBandLabel = {
  id: string;
  side: "left" | "right" | "center" | "plotStart";
  /** 0~100, 차트 영역 기준 top % */
  topPct: number;
  text: string;
  leadingText?: string;
  color: string;
  title: string;
  /** 상한=숫자 위 선, 하한=숫자 아래 선 */
  mark?: "overline" | "underline";
  /** 알람 기준 — 숫자 대신 아이콘 */
  labelIcon?: "temp-alarm" | "hum-alarm";
  draggable?: boolean;
  editValue?: number;
  labelLane?: "outer" | "inner";
  showApplyActions?: boolean;
};

/** 같은 끝단에서 가까운 라벨을 위·아래로 살짝 밀어 겹침을 줄인다. */
export function nudgeEdgeLabelTops(
  labels: EdgeBandLabel[],
  minGapPct: number,
): EdgeBandLabel[] {
  const bySide: Record<
    "left" | "right" | "center" | "plotStart",
    EdgeBandLabel[]
  > = {
    left: [],
    right: [],
    center: [],
    plotStart: [],
  };
  for (const l of labels) bySide[l.side].push({ ...l });
  for (const side of ["left", "right", "center", "plotStart"] as const) {
    const list = bySide[side].sort((a, b) => a.topPct - b.topPct);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (cur.topPct - prev.topPct < minGapPct) {
        cur.topPct = Math.min(96, prev.topPct + minGapPct);
      }
    }
    bySide[side] = list;
  }
  return [
    ...bySide.left,
    ...bySide.right,
    ...bySide.center,
    ...bySide.plotStart,
  ];
}

function edgeLabelTempHumKind(
  id: string,
): "temp" | "hum" | null {
  if (id.startsWith("temp-") || id.startsWith("band-tick-temp-")) return "temp";
  if (id.startsWith("hum-") || id.startsWith("band-tick-hum-")) return "hum";
  return null;
}

/** 왼쪽 알람 기준 — 오버레이에서 한 줄로 합치지 않고 세로로 쌓는다. */
export function isStackedAlarmBaselineLabel(id: string): boolean {
  return (
    id.endsWith("-farm-mid") ||
    id === "band-tick-temp-mid" ||
    id === "band-tick-hum-mid"
  );
}

const LEFT_BASELINE_STACK_ORDER = [
  "temp-farm-mid",
  "band-tick-temp-mid",
  "hum-farm-mid",
  "band-tick-hum-mid",
] as const;

/**
 * 오버레이에서만: 같은 높이의 왼쪽 온·습 기준을 온도→습도 순으로 세로 배치한다.
 * 끄면 각 그래프 칸의 매핑 높이를 그대로 둔다.
 */
export function stackLeftAlarmBaselineLabels(
  labels: EdgeBandLabel[],
  minGapPct: number,
  overlayStacked = false,
): EdgeBandLabel[] {
  if (!overlayStacked || !(minGapPct > 0) || labels.length < 2) return labels;
  const picked = labels
    .map((label, index) => ({ label, index }))
    .filter(
      ({ label }) =>
        label.side === "left" && isStackedAlarmBaselineLabel(label.id),
    );
  if (picked.length < 2) return labels;
  const orderIndex = (id: string) => {
    const i = LEFT_BASELINE_STACK_ORDER.indexOf(
      id as (typeof LEFT_BASELINE_STACK_ORDER)[number],
    );
    return i < 0 ? LEFT_BASELINE_STACK_ORDER.length : i;
  };
  const sorted = [...picked].sort(
    (a, b) => orderIndex(a.label.id) - orderIndex(b.label.id),
  );
  const mean =
    sorted.reduce((sum, item) => sum + item.label.topPct, 0) / sorted.length;
  const start = mean - ((sorted.length - 1) * minGapPct) / 2;
  return labels.map((label, index) => {
    const slot = sorted.findIndex((item) => item.index === index);
    if (slot < 0) return label;
    return {
      ...label,
      topPct: Math.min(96, Math.max(4, start + slot * minGapPct)),
    };
  });
}

/**
 * 같은 끝단에서 온도·습도 눈금/기준선이 겹치면 「28.0℃, 67%」로 합친다.
 * 왼쪽 알람 기준·모터 % 눈금은 합치지 않는다. nudge보다 먼저 호출한다.
 */
export function mergeOverlappingTempHumEdgeLabels(
  labels: EdgeBandLabel[],
  maxGapPct: number,
): EdgeBandLabel[] {
  const sides = ["left", "right", "center", "plotStart"] as const;
  const out: EdgeBandLabel[] = [];
  for (const side of sides) {
    const list = labels.filter((l) => l.side === side);
    const used = new Set<string>();
    const temps = list.filter(
      (l) =>
        edgeLabelTempHumKind(l.id) === "temp" &&
        !isStackedAlarmBaselineLabel(l.id),
    );
    const hums = list.filter(
      (l) =>
        edgeLabelTempHumKind(l.id) === "hum" &&
        !isStackedAlarmBaselineLabel(l.id),
    );
    for (const temp of temps) {
      let best: EdgeBandLabel | null = null;
      let bestD = Infinity;
      for (const hum of hums) {
        if (used.has(hum.id)) continue;
        const d = Math.abs(hum.topPct - temp.topPct);
        if (d <= maxGapPct && d < bestD) {
          best = hum;
          bestD = d;
        }
      }
      if (!best) continue;
      used.add(temp.id);
      used.add(best.id);
      out.push({
        ...temp,
        text: `${temp.text}, ${best.text}`,
        title:
          temp.title === "눈금" && best.title === "눈금"
            ? "눈금"
            : "온도, 습도",
      });
    }
    for (const l of list) {
      if (!used.has(l.id)) out.push(l);
    }
  }
  return out;
}

export function finiteValues(
  series: TrendSeries[],
  axis: TrendAxis | undefined,
): number[] {
  const out: number[] = [];
  for (const s of series) {
    if ((s.axis ?? "left") !== (axis ?? "left")) continue;
    for (const v of s.data) {
      if (v != null && Number.isFinite(v)) out.push(v);
    }
  }
  return out;
}

/**
 * 차트 본문 렌더 여부.
 * 시리즈/히스토그램이 없어도 타임라인+이벤트 레인이 있으면 유효
 * (명령 Y밴드만 스코프한 경우 등).
 */
export function trendChartHasRenderableContent(input: {
  series: Pick<TrendSeries, "data">[];
  histograms: { values: Array<number | null | undefined> }[];
  categoriesLength: number;
  eventLaneActive: boolean;
}): boolean {
  const hasSeriesOrHist =
    input.series.some((s) => s.data?.some((v) => v != null)) ||
    input.histograms.some((h) => h.values.some((v) => v != null));
  if (hasSeriesOrHist) return true;
  return input.eventLaneActive && input.categoriesLength > 0;
}

export function domainFor(
  values: number[],
  forced: [number, number] | undefined,
): [number, number] {
  if (forced) return forced;
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

/** view X → 시간축 ms (점 스냅 없이 선형). */
export function interpolateTimelineMsFromXView(
  xView: number,
  padL: number,
  innerW: number,
  timeAxisMs: number[] | null | undefined,
  n: number,
): number | null {
  if (!(n > 0) || !(innerW > 0) || !Number.isFinite(xView)) return null;
  if (!timeAxisMs || timeAxisMs.length !== n) return null;
  if (n === 1) {
    const t0 = timeAxisMs[0];
    return t0 != null && Number.isFinite(t0) ? t0 : null;
  }
  const t0 = timeAxisMs[0];
  const t1 = timeAxisMs[n - 1];
  if (
    t0 == null ||
    t1 == null ||
    !Number.isFinite(t0) ||
    !Number.isFinite(t1)
  ) {
    return null;
  }
  const u = Math.min(1, Math.max(0, (xView - padL) / innerW));
  return t0 + u * (t1 - t0);
}

/** 십자선 칩 시각. 7일·30일은 날짜를 붙인다. */
export function formatCrosshairClock(
  ms: number,
  opts?: { withDate?: boolean },
): string {
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (opts?.withDate) {
    return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
  }
  return `${hh}:${mm}`;
}

/**
 * view Y → 왼쪽 차트 domain Y. 명령 레인(플롯 아래)은 null.
 * `yFor`의 역: t = 1 - (yView - padTop) / innerH.
 */
export function chartDomainYFromViewY(
  yView: number,
  padTop: number,
  innerH: number,
  domain: [number, number],
): number | null {
  if (!(innerH > 0) || !Number.isFinite(yView)) return null;
  if (yView > padTop + innerH + 1e-6) return null;
  const t = 1 - (yView - padTop) / innerH;
  const u = Math.min(1, Math.max(0, t));
  const [mn, mx] = domain;
  if (!Number.isFinite(mn) || !Number.isFinite(mx)) return null;
  return mn + u * (mx - mn);
}

/** 칩이 왼쪽 축을 넘으면 교차점 오른쪽으로 뒤집는다. */
export function crosshairChipFlipsRight(
  xView: number,
  padL: number,
  chipViewW: number,
  gapView: number,
): boolean {
  return xView - padL < chipViewW + gapView;
}
