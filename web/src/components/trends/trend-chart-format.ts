import type {
  TrendBreachNavTarget,
  TrendEnvelope,
  TrendHistogram,
  TrendSeries,
  TrendSpreadContributor,
} from "@/lib/data/trend-chart-types";

/**
 * 추이 차트 호버/라벨 포맷·분류 순수 헬퍼. 렌더링(`trend-chart.tsx`)과
 * 호버 카드(`trend-hover-card.tsx`)가 공유한다. React 의존 없음.
 */

export type HoverMetricGroup = "temp" | "hum" | "motor";

/** 시리즈/히스토그램 라벨 → 호버 카드 그룹 */
export function inferHoverMetricGroup(label: string): HoverMetricGroup {
  if (/습도/.test(label)) return "hum";
  if (/환기/.test(label)) return "motor";
  if (/설정/.test(label)) return "temp";
  if (/모터|채널|입기|배기|송풍|^[ABC]$/.test(label)) return "motor";
  return "temp";
}

/** 오버레이 겹침 카드 — 온도·습도·모터 어느 쪽이든 한 핀으로 합친다. */
export function isOverlayMergedHoverGroup(
  group: HoverMetricGroup | null | undefined,
): boolean {
  return group === "temp" || group === "hum" || group === "motor";
}

function contributorToNav(
  c: TrendSpreadContributor,
): TrendBreachNavTarget | null {
  const stallTyCode = c.stallTyCode?.trim();
  const stallNo = c.stallNo?.trim();
  const controllerKey = c.controllerKey?.trim();
  if (!stallTyCode || !stallNo || !controllerKey) return null;
  return {
    stallTyCode,
    stallNo,
    controllerKey,
    zoneLabel: c.zoneLabel,
    equipmentLabel: c.equipmentLabel,
  };
}

/**
 * 한계 이탈 데이터 카드가 보이는 조건과 동일할 때만 이동 대상 반환.
 * 상·하단 장비가 다르면 상한(상단) 우선.
 */
export function resolveBreachNavTarget(opts: {
  series: TrendSeries[];
  envelopes: TrendEnvelope[];
  hoverIdx: number;
  hoverSeriesName: string | null;
}): TrendBreachNavTarget | null {
  const { series, envelopes, hoverIdx, hoverSeriesName } = opts;
  if (hoverIdx < 0 || hoverSeriesName == null) return null;
  const group = inferHoverMetricGroup(hoverSeriesName);
  if (group !== "temp" && group !== "hum") return null;

  const tipSeries = series.filter(
    (s) => inferHoverMetricGroup(s.name) === group,
  );
  const extremes =
    tipSeries.find((s) => s.hoverSpreadExtremes)?.hoverSpreadExtremes ??
    envelopes.find(
      (e) =>
        e.hoverExtremes &&
        e.legendLabel === (group === "temp" ? "온도 산포" : "습도 산포"),
    )?.hoverExtremes;
  if (!extremes) return null;

  const hi = extremes.high[hoverIdx] ?? null;
  const lo = extremes.low[hoverIdx] ?? null;
  if (!hi?.breached && !lo?.breached) return null;

  if (hi?.breached) {
    const nav = contributorToNav(hi);
    if (nav) return nav;
  }
  if (lo?.breached) return contributorToNav(lo);
  return null;
}

export const HOVER_GROUP_LABEL: Record<HoverMetricGroup, string> = {
  temp: "온도",
  hum: "습도",
  motor: "모터",
};

/** "분만사 01번 축사" → { prefix: "분만사", stallNo: "01" } */
export function splitSpreadZoneLabel(zoneLabel: string): {
  prefix: string;
  stallNo: string | null;
} {
  const m = zoneLabel.match(/^(.*?)\s*(\S+)\s*번\s*축사\s*$/);
  if (m) return { prefix: (m[1] ?? "").trim(), stallNo: m[2] ?? null };
  return { prefix: zoneLabel, stallNo: null };
}

/** "컨트롤러 06" → "06" */
export function spreadControllerNo(equipmentLabel: string): string | null {
  const m = equipmentLabel.match(/컨트롤러\s*(\S+)\s*$/);
  return m ? (m[1] ?? null) : null;
}

export function formatHistHoverDisplay(
  h: TrendHistogram,
  hoverIdx: number,
): string {
  const sec = h.hoverSecondary?.[hoverIdx];
  if (sec == null || !Number.isFinite(sec) || !h.hoverSecondaryUnit) return "–";
  if (h.hoverFormat === "midpointDelta") {
    return `중점 ${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
  }
  if (
    h.hoverFormat === "percent" ||
    h.style === "volume" ||
    h.hoverSecondaryUnit === "%"
  ) {
    return `${Math.round(sec)}${h.hoverSecondaryUnit}`;
  }
  return `${sec > 0 ? "+" : ""}${sec.toFixed(1)}${h.hoverSecondaryUnit}`;
}

/** 호버 툴팁 — 온도·습도 소수 1자리, 모터(%) 정수. */
export function formatTrendHoverValue(
  value: number,
  unit: string,
  seriesName: string,
): string {
  if (!Number.isFinite(value)) return "—";
  const motorLike =
    unit === "%" &&
    (seriesName.startsWith("채널") ||
      seriesName === "A" ||
      seriesName === "B" ||
      seriesName === "C" ||
      /입기|배기|송풍|모터/.test(seriesName));
  if (motorLike) return `${Math.round(value)}${unit}`;
  if (unit === "n") {
    return `n=${Number.isInteger(value) ? String(value) : value.toFixed(0)}`;
  }
  if (unit === "℃" || unit === "%") return `${value.toFixed(1)}${unit}`;
  return `${Number.isInteger(value) ? String(value) : value.toFixed(1)}${unit}`;
}

/** 한계 끝단 라벨 — 정수면 그대로, 아니면 소수 1자리. */
export function formatTrendBandEdge(value: number, unit: string): string {
  if (!Number.isFinite(value)) return "—";
  const rounded =
    Math.abs(value - Math.round(value)) < 1e-6
      ? String(Math.round(value))
      : value.toFixed(1);
  return `${rounded}${unit}`;
}

/** Y숫자 회색 칩 기준 폭. 100.0℃ · 100.0도와 같은 자리. */
export const TREND_Y_LABEL_CHIP_SAMPLE = "100.0℃";

/** 임계 대비 이탈량 — 상한 +n / 하한 −n */
export function formatLimitBreachDelta(
  absDelta: number,
  unit: string,
  side: "high" | "low",
): string {
  if (!Number.isFinite(absDelta) || absDelta < 0) return "";
  const mag =
    Math.abs(absDelta - Math.round(absDelta)) < 1e-6
      ? String(Math.round(absDelta))
      : absDelta.toFixed(1);
  return side === "high" ? `+${mag}${unit}` : `−${mag}${unit}`;
}
