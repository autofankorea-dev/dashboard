import {
  resolveThermoSettings,
  thermoFromDecoded,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import {
  channelBySlot,
  type ChannelSlot,
} from "@/lib/data/iot-channel";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import { stallKeyFromReading } from "@/lib/data/reading-hierarchy";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
} from "@/lib/data/stall-type";
import type { TrendPeriodData, TrendPeriodId, TrendStallSeries, TrendControllerPeriodData, TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";
import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";

export type ListDisplayMode = "gauge";

export type ChannelPercents = Record<ChannelSlot, number | null>;

const CHANNELS: ChannelSlot[] = ["A", "B", "C"];

export { parseTrendPeriodParam as parseTrendPeriod } from "@/lib/farm/farm-view-url";

/** UI — EC 코드 대신 컨트롤러 번호만 (상위 트리에 축사 표시) */
export function formatControllerNoLabel(eqpmnNo: string | undefined): string {
  const eq = normalizeEqpmnNo(eqpmnNo ?? "01");
  return `${eq}번`;
}

/** 카드 헤더 — 축사유형 (최상위) */
export function formatControllerHeaderStallType(
  reading: Pick<BarnReading, "stallTyCode">,
): string {
  return formatStallTypeLabel(reading.stallTyCode);
}

/** 카드 헤더 — N번 축사 (중간 계층) */
export function formatControllerHeaderStallUnit(
  reading: Pick<BarnReading, "stallNo"> &
    Partial<Pick<BarnReading, "controllerKey" | "idx">>,
): string {
  const stallKey = stallKeyFromReading(reading);
  const stallNo = stallKey.startsWith("__") ? "—" : stallKey;
  return `${stallNo}번 축사`;
}

/** 카드 헤더 상위 — 축사유형 + N번 축사 (한 줄 표기·요약용) */
export function formatControllerHeaderPrimary(
  reading: Pick<BarnReading, "stallTyCode" | "stallNo" | "controllerKey" | "idx">,
): string {
  return `${formatControllerHeaderStallType(reading)} ${formatControllerHeaderStallUnit(reading)}`;
}

/** 카드 헤더 하위 — 컨트롤러 번호 */
export function formatControllerHeaderSecondary(
  reading: Pick<BarnReading, "eqpmnNo">,
): string {
  const eq = normalizeEqpmnNo(reading.eqpmnNo ?? "01");
  return `컨트롤러 ${eq}`;
}

export function channelPercentsFromReading(r: BarnReading): ChannelPercents {
  if (r.status === "offline") {
    return { A: null, B: null, C: null };
  }
  if (r.channels?.length) {
    return {
      A: channelBySlot(r.channels, "A")?.fanPct ?? null,
      B: channelBySlot(r.channels, "B")?.fanPct ?? null,
      C: channelBySlot(r.channels, "C")?.fanPct ?? null,
    };
  }
  return {
    A: r.fanIntake,
    B: r.fanExhaust,
    C: r.fanSupply,
  };
}

/** LIVE decode 활성 채널. channels[] 없으면 현재 팬값이 있는 슬롯. */
export function activeChannelSlotsFromReading(r: BarnReading): ChannelSlot[] {
  if (r.channels?.length) {
    const slots = r.channels
      .map((c) => c.channel)
      .filter((s, i, arr) => arr.indexOf(s) === i);
    return CHANNELS.filter((s) => slots.includes(s));
  }
  const pct = channelPercentsFromReading(r);
  return CHANNELS.filter((s) => pct[s] != null);
}

export function resolveReadingThermo(
  r: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>
): ControllerThermoSettings | null {
  const fromMap =
    resolveThermoSettings(
      thermoSettings,
      r.farmKey,
      r.moduleUid,
      r.controllerKey,
      "A"
    ) ??
    resolveThermoSettings(
      thermoSettings,
      r.farmKey,
      r.moduleUid,
      r.controllerKey
    );
  if (fromMap) return fromMap;

  const chA = r.channels?.length
    ? channelBySlot(r.channels, "A")?.thermo
    : null;
  const parsed = thermoFromDecoded(chA ?? r.thermo);
  if (!parsed) return null;
  return {
    ...parsed,
    source: "live",
    updatedAt: r.receivedAt,
  };
}

/**
 * 채널별 thermo — fanBand/히트맵용.
 * B·C는 A thermo로 폴백하지 않음 (없으면 null → 호출측 statBand).
 * channels 없는 레거시 reading만 컨트롤러 단위 thermo를 공유.
 */
export function resolveReadingChannelThermo(
  r: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>,
  channel: ChannelSlot
): ControllerThermoSettings | null {
  const fromChannel = resolveThermoSettings(
    thermoSettings,
    r.farmKey,
    r.moduleUid,
    r.controllerKey,
    channel
  );
  if (fromChannel) return fromChannel;

  if (r.channels?.length) {
    const live = channelBySlot(r.channels, channel)?.thermo;
    const parsed = thermoFromDecoded(live ?? null);
    if (!parsed) return null;
    return {
      ...parsed,
      source: "live",
      updatedAt: r.receivedAt,
    };
  }

  const fromCtrl = resolveThermoSettings(
    thermoSettings,
    r.farmKey,
    r.moduleUid,
    r.controllerKey
  );
  if (fromCtrl) return fromCtrl;

  const parsedRow = thermoFromDecoded(r.thermo);
  if (!parsedRow) return null;
  return {
    ...parsedRow,
    source: "live",
    updatedAt: r.receivedAt,
  };
}

export function formatSetpointDisplay(
  thermo: ControllerThermoSettings | null
): { main: string; sub: string } {
  if (!thermo) return { main: "—", sub: "" };
  const dev =
    thermo.tempDeviation % 1 === 0
      ? String(thermo.tempDeviation)
      : thermo.tempDeviation.toFixed(1);
  return {
    main: `${thermo.setpointTemp} ±${dev}`,
    sub: `${thermo.minVentPct}–${thermo.maxVentPct}%`,
  };
}

export function findStallTrendSeries(
  trendByPeriod: Record<TrendPeriodId, TrendPeriodData> | null | undefined,
  period: TrendPeriodId,
  stallTyCode: string | null,
  stallNo: string | null
): TrendStallSeries | null {
  if (!trendByPeriod || !stallTyCode || !stallNo) return null;
  const data = trendByPeriod[period];
  if (!data) return null;
  const sp = data.sp.find(
    (g) =>
      normalizeStallTyCode(g.stallTyCode) ===
      normalizeStallTyCode(stallTyCode)
  );
  return sp?.stalls.find((s) => s.stallNo === stallNo) ?? null;
}

/** 목록 그래프 — controller_key 단위 시계열 (stall 집계와 분리). */
function stallNoKeysMatch(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

export function findControllerTrendSeries(
  trendByPeriod: Record<TrendPeriodId, TrendControllerPeriodData> | null | undefined,
  period: TrendPeriodId,
  stallTyCode: string | null,
  stallNo: string | null,
  controllerKey: string | null
): TrendControllerSeries | null {
  if (!trendByPeriod || !stallTyCode || !stallNo || !controllerKey) return null;
  const data = trendByPeriod[period];
  if (!data) return null;
  const sp = data.sp.find(
    (g) =>
      normalizeStallTyCode(g.stallTyCode) ===
      normalizeStallTyCode(stallTyCode)
  );
  const stall = sp?.stalls.find((s) => stallNoKeysMatch(s.stallNo, stallNo));
  return (
    stall?.controllers.find((c) => c.controllerKey === controllerKey) ?? null
  );
}

export function formatChannelPercent(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

export function resolveReadingAlarmThresholds(
  r: BarnReading,
  alarmSettings?: AlarmSettings
): AlarmThresholds {
  return resolveThresholdsForReading(alarmSettings ?? DEFAULT_ALARM_SETTINGS, r);
}

export function formatTempAlarmRange(thresholds: AlarmThresholds): string {
  return Number.isFinite(thresholds.tempLow) ? `${thresholds.tempLow}–${thresholds.tempHigh}℃` : "경보값 미수신";
}

export function formatHumidityAlarmRange(thresholds: AlarmThresholds): string {
  return Number.isFinite(thresholds.humidityLow) ? `${thresholds.humidityLow}–${thresholds.humidityHigh}%` : "습도 경보 기준 없음";
}

export type AlarmBreached = "high" | "low";

export function tempAlarmBreached(
  r: BarnReading,
  thresholds: AlarmThresholds
): AlarmBreached | null {
  if (r.status === "offline" || r.tempC == null) return null;
  if (r.tempC >= thresholds.tempHigh) return "high";
  if (r.tempC <= thresholds.tempLow) return "low";
  return null;
}

export function humidityAlarmBreached(
  r: BarnReading,
  thresholds: AlarmThresholds
): AlarmBreached | null {
  if (r.status === "offline" || r.humidityPct == null) return null;
  if (r.humidityPct >= thresholds.humidityHigh) return "high";
  if (r.humidityPct <= thresholds.humidityLow) return "low";
  return null;
}

/** 게이지 bar — 알람 구간 [low, high] 내 위치 0–100% */
export function gaugePctInAlarmRange(
  value: number,
  low: number,
  high: number
): number {
  if (!Number.isFinite(value) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) return 0;
  const pct = ((value - low) / (high - low)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export type GaugeFillSegments = {
  span: number;
  cur: number;
  rest: number;
  pct: number | null;
};

export function buildGaugeFillSegments(
  value: number | null,
  low: number,
  high: number,
  offline: boolean
): GaugeFillSegments {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) return { span: 1, cur: 0, rest: 1, pct: null };
  const span = Math.max(high - low, 1);
  if (offline || value == null || !Number.isFinite(value)) {
    return { span, cur: 0, rest: span, pct: null };
  }
  const cur = Math.max(0, Math.min(span, value - low));
  return {
    span,
    cur,
    rest: span - cur,
    pct: gaugePctInAlarmRange(value, low, high),
  };
}

export function setpointBandPct(
  setpoint: number,
  dev: number,
  low: number,
  high: number
): { left: number; width: number } {
  const lo = gaugePctInAlarmRange(setpoint - dev, low, high);
  const hi = gaugePctInAlarmRange(setpoint + dev, low, high);
  return { left: Math.min(lo, hi), width: Math.abs(hi - lo) };
}

export { CHANNELS };
