import type { TrendReferenceLine, TrendSeries } from "@/lib/data/trend-chart-types";
import {
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import type { TrendStallSeries } from "@/lib/data/farm-trend-types";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { CHANNEL_SLOT_LABELS, type ChannelSlot } from "@/lib/data/iot-channel";
import {
  type Band,
  fanBand,
  humidityBand,
  statBand,
  tempBand,
} from "@/lib/farm/severity-score";

/** 온도 추이 Y축 — 알람 구간과 동일 (기간 전환 시 스케일 고정). */
export function tempTrendLeftDomain(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): [number, number] {
  return Number.isFinite(thresholds.tempLow) && Number.isFinite(thresholds.tempHigh) ? [thresholds.tempLow, thresholds.tempHigh] : [0, 50];
}

/** 알람 상·하한 — 채널 시리즈와 분리, status-warn만 */
export const ALARM_REF_COLOR = "var(--status-warn)";

export function tempTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendReferenceLine[] {
  if (!Number.isFinite(thresholds.tempLow) || !Number.isFinite(thresholds.tempHigh)) return [];
  return [
    {
      value: thresholds.tempLow,
      axis: "left",
      color: ALARM_REF_COLOR,
      label: `${thresholds.tempLow}℃`,
    },
    {
      value: thresholds.tempHigh,
      axis: "left",
      color: ALARM_REF_COLOR,
      label: `${thresholds.tempHigh}℃`,
    },
  ];
}

export function humidityTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS,
  axis: "left" | "right" = "left"
): TrendReferenceLine[] {
  if (!Number.isFinite(thresholds.humidityLow) || !Number.isFinite(thresholds.humidityHigh)) return [];
  return [
    {
      value: thresholds.humidityLow,
      axis,
      color: ALARM_REF_COLOR,
      label: `${thresholds.humidityLow}%`,
    },
    {
      value: thresholds.humidityHigh,
      axis,
      color: ALARM_REF_COLOR,
      label: `${thresholds.humidityHigh}%`,
    },
  ];
}

/** 복합 환경 차트(온도 left + 습도 right)용 알람 점선. */
export function envTrendReferenceLines(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendReferenceLine[] {
  return [
    ...tempTrendReferenceLines(thresholds),
    ...humidityTrendReferenceLines(thresholds, "right"),
  ];
}

/** 화면 차트 SVG — CSS 채널 토큰 (status와 분리). */
export const TREND_CHART_COLORS = {
  temp: "var(--channel-temp)",
  humidity: "var(--channel-hum)",
  fanSupply: "var(--channel-fan-supply)",
  fanExhaust: "var(--channel-fan-exhaust)",
  fanIntake: "var(--channel-fan-intake)",
} as const;

/**
 * PDF·캔버스 등 CSS 미해석용 — 라이트 `--channel-*` 근사 hex.
 * status-warn `#f59e0b` / status-danger `#e11d2a` 와 동일 hex 금지.
 */
export const TREND_CHART_COLORS_PRINT = {
  temp: "#953c47",
  humidity: "#007daa",
  fanSupply: "#0a9068",
  fanExhaust: "#7b57c8",
  fanIntake: "#546c95",
} as const;

/** 히트맵/스몰멀티플 지표 id(T/H/A/B/C) → 목록 그래프와 동일한 선 색. */
export const METRIC_ID_COLORS: Record<string, string> = {
  T: TREND_CHART_COLORS.temp,
  H: TREND_CHART_COLORS.humidity,
  A: TREND_CHART_COLORS.fanIntake,
  B: TREND_CHART_COLORS.fanExhaust,
  C: TREND_CHART_COLORS.fanSupply,
};

type StallMetrics = Pick<
  TrendStallSeries,
  "temp" | "humidity" | "fanSupply" | "fanExhaust" | "fanIntake"
>;

export function humidityTrendLeftDomain(
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): [number, number] {
  return Number.isFinite(thresholds.humidityLow) && Number.isFinite(thresholds.humidityHigh) ? [thresholds.humidityLow, thresholds.humidityHigh] : [0, 100];
}

export function fanTrendReferenceLines(
  band: Band,
  axis: "left" | "right" = "left"
): TrendReferenceLine[] {
  return [
    {
      value: band.lo,
      axis,
      color: ALARM_REF_COLOR,
      label: `${band.lo}%`,
    },
    {
      value: band.hi,
      axis,
      color: ALARM_REF_COLOR,
      label: `${band.hi}%`,
    },
  ];
}

/** 온도 시리즈 — 알람 band + severity 마커. */
export function tempTrendSeries(
  m: Pick<TrendStallSeries, "temp">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return {
    name: "온도",
    data: m.temp,
    color: TREND_CHART_COLORS.temp,
    axis: "left",
    band: tempBand(thresholds),
  };
}

/** 습도 시리즈 — 알람 band + severity 마커. */
export function humidityTrendSeries(
  m: Pick<TrendStallSeries, "humidity">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return {
    name: "습도",
    data: m.humidity,
    color: TREND_CHART_COLORS.humidity,
    axis: "left",
    band: humidityBand(thresholds),
  };
}

/** 복합 환경 차트 — 온도(left·알람 band) + 습도(right·알람 band). */
export function envTrendSeries(
  m: Pick<TrendStallSeries, "temp" | "humidity">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries[] {
  return [
    tempTrendSeries(m, thresholds),
    { ...humidityTrendSeries(m, thresholds), axis: "right" },
  ];
}

const CHANNEL_SLOT_META: Record<
  ChannelSlot,
  { field: keyof Pick<TrendStallSeries, "fanIntake" | "fanExhaust" | "fanSupply">; color: string; label: string }
> = {
  A: {
    field: "fanIntake",
    color: TREND_CHART_COLORS.fanIntake,
    label: CHANNEL_SLOT_LABELS.A,
  },
  B: {
    field: "fanExhaust",
    color: TREND_CHART_COLORS.fanExhaust,
    label: CHANNEL_SLOT_LABELS.B,
  },
  C: {
    field: "fanSupply",
    color: TREND_CHART_COLORS.fanSupply,
    label: CHANNEL_SLOT_LABELS.C,
  },
};

export function channelFanTrendSeries(
  m: StallMetrics,
  thermoByChannel:
    | Partial<
        Record<
          ChannelSlot,
          Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null
        >
      >
    | null = null
): TrendSeries[] {
  return (["A", "B", "C"] as const).map((slot) => {
    const meta = CHANNEL_SLOT_META[slot];
    const data = m[meta.field];
    const thermo = thermoByChannel?.[slot] ?? null;
    const band = fanBand(thermo) ?? statBand(data);
    return {
      name: meta.label,
      data,
      color: meta.color,
      band: band ?? undefined,
    };
  });
}

/**
 * 활성 채널만 한 차트에 오버레이 (단위 %).
 * band/참조선은 생략 — 다중 채널 시 겹침 방지.
 */
export function channelOverlayTrendSeries(
  m: StallMetrics,
  slots: ChannelSlot[],
): TrendSeries[] {
  const out: TrendSeries[] = [];
  for (const slot of slots) {
    const meta = CHANNEL_SLOT_META[slot];
    const data = m[meta.field];
    if (!data.some((v) => v != null && Number.isFinite(v))) continue;
    out.push({
      name: meta.label,
      data,
      color: meta.color,
    });
  }
  return out;
}

/** 그래프 pill / 채널 스트립 — 단일 채널 line trend. */
export function channelSlotTrendSeries(
  m: StallMetrics,
  slot: ChannelSlot,
  thermo: Pick<ControllerThermoSettings, "minVentPct" | "maxVentPct"> | null = null
): TrendSeries {
  const meta = CHANNEL_SLOT_META[slot];
  const data = m[meta.field];
  const band = fanBand(thermo) ?? statBand(data);
  return {
    name: meta.label,
    data,
    color: meta.color,
    band: band ?? undefined,
  };
}

export function humidityOnlyTrendSeries(
  m: Pick<TrendStallSeries, "humidity">,
  thresholds: AlarmThresholds = DEFAULT_ALARM_THRESHOLDS
): TrendSeries {
  return humidityTrendSeries(m, thresholds);
}

export function stallTrendHasData(stall: TrendStallSeries | null): boolean {
  if (!stall) return false;
  const cols = [
    ...stall.temp,
    ...stall.humidity,
    ...stall.fanSupply,
    ...stall.fanExhaust,
    ...stall.fanIntake,
  ];
  return cols.some((v) => v != null && Number.isFinite(v));
}
