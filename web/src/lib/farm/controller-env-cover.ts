import {
  DEFAULT_ALARM_SETTINGS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";
import { formatAlarmBaselinePair } from "@/lib/data/alarm-baseline";
import { resolveThresholdsForReading } from "@/lib/data/alarm-scope";
import type { BarnReading } from "@/lib/data/iot";
import { formatHumidityPct, formatTempC } from "@/lib/data/farm-summaries";
import { sevOfScore, severityScore } from "@/lib/farm/severity-score";

export type ControllerEnvCoverLevel = "ok" | "warn" | "danger" | "offline";
type RoomEnvTint = "ok" | "warn" | "danger";

type RoomEnvChannels = {
  temp: RoomEnvTint | null;
  humidity: RoomEnvTint | null;
};

const COVER_LEVEL_RANK: Record<ControllerEnvCoverLevel, number> = {
  ok: 0,
  warn: 1,
  danger: 2,
  offline: 3,
};

type CoverReasonReading = Pick<
  BarnReading,
  "status" | "tempC" | "humidityPct" | "stallTyCode"
> &
  Partial<Pick<BarnReading, "farmKey" | "stallNo" | "controllerKey" | "eqpmnNo">>;

function alarmChannelTint(
  value: number | null | undefined,
  low: number,
  high: number,
): RoomEnvTint | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sev = sevOfScore(severityScore(value, { lo: low, hi: high }));
  if (sev === "warning") return "danger";
  if (sev === "caution") return "warn";
  return "ok";
}

function envAlarmThresholds(
  reading: CoverReasonReading,
  settings?: AlarmSettings,
): AlarmThresholds {
  return resolveThresholdsForReading(settings ?? DEFAULT_ALARM_SETTINGS, {
    key: "",
    farmKey: reading.farmKey ?? { lsindRegistNo: "", itemCode: "" },
    moduleUid: 0,
    controllerKey: reading.controllerKey ?? "",
    eqpmnNo: reading.eqpmnNo ?? "",
    stallNo: reading.stallNo ?? null,
    stallTyCode: reading.stallTyCode ?? null,
    label: "",
    tempC: reading.tempC,
    humidityPct: reading.humidityPct,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: "",
    status: reading.status,
    packetMode: "live",
    wireVer: null,
  });
}

function roomEnvChannels(
  reading: CoverReasonReading | undefined,
  alarmSettings?: AlarmSettings,
): RoomEnvChannels | null {
  if (!reading || reading.status === "offline") return null;
  if (reading.tempC == null && reading.humidityPct == null) return null;
  const band = envAlarmThresholds(reading, alarmSettings);
  return {
    temp: alarmChannelTint(reading.tempC, band.tempLow, band.tempHigh),
    humidity: alarmChannelTint(
      reading.humidityPct,
      band.humidityLow,
      band.humidityHigh,
    ),
  };
}

function roomEnvTint(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): RoomEnvTint | null {
  const channels = roomEnvChannels(reading, alarmSettings);
  if (!channels) return null;
  if (channels.temp === "danger" || channels.humidity === "danger") {
    return "danger";
  }
  if (channels.temp === "warn" || channels.humidity === "warn") {
    return "warn";
  }
  return "ok";
}

/** 필드 카드 덮개 채점 — 사용자가 정한 알람 상·하한. 권장은 델린이 제시. */
export function controllerEnvCoverLevel(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverLevel {
  if (reading.status === "offline") return "offline";
  const tint = roomEnvTint(reading, alarmSettings) ?? "ok";
  /**
   * 측정 정체(수신은 최신·측정시각 정체 → LIVE `caution`)면
   * 알람 구간 안이어도 덮개를 「주의」로 강등. 이미 위험이면 유지.
   */
  if (reading.status === "caution" && tint === "ok") return "warn";
  return tint;
}

/** 축사 현황 — 속한 컨트롤러 중 가장 나쁜 알람 판정. 끊김만 있으면 연결 끊김. */
export function worstControllerEnvCoverLevel(
  readings: readonly CoverReasonReading[],
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverLevel {
  let worstLive: ControllerEnvCoverLevel | null = null;
  let anyOffline = false;
  for (const reading of readings) {
    const level = controllerEnvCoverLevel(reading, alarmSettings);
    if (level === "offline") {
      anyOffline = true;
      continue;
    }
    if (
      !worstLive ||
      COVER_LEVEL_RANK[level] > COVER_LEVEL_RANK[worstLive]
    ) {
      worstLive = level;
    }
  }
  if (worstLive) return worstLive;
  if (anyOffline) return "offline";
  return "ok";
}

export function controllerEnvCoverLabel(level: ControllerEnvCoverLevel): string {
  if (level === "ok") return "정상";
  if (level === "warn") return "주의";
  if (level === "danger") return "위험";
  return "연결 끊김";
}

export type ControllerEnvCoverReason = {
  valueLabel: string | null;
  bandLabel: string | null;
};

function channelOff(tint: RoomEnvTint | null | undefined): boolean {
  return tint === "warn" || tint === "danger";
}

function tempAlarmBandLabel(reading: CoverReasonReading, alarmSettings?: AlarmSettings): string {
  const band = envAlarmThresholds(reading, alarmSettings);
  return `알람 ${formatAlarmBaselinePair(band.tempLow, band.tempHigh, "℃")}`;
}

function humidityAlarmBandLabel(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): string {
  const band = envAlarmThresholds(reading, alarmSettings);
  return `알람 ${formatAlarmBaselinePair(band.humidityLow, band.humidityHigh, "%")}`;
}

/**
 * 덮개 가운데 — 이탈한 채널만. 온·습 둘 다 이탈이면 온도 우선.
 * 이탈이 없으면 온도(없으면 습도) + 알람 띠. 끊김·값 없음이면 비움.
 */
export function controllerEnvCoverReason(
  reading: CoverReasonReading,
  alarmSettings?: AlarmSettings,
): ControllerEnvCoverReason {
  if (reading.status === "offline") {
    return { valueLabel: null, bandLabel: null };
  }

  const channels = roomEnvChannels(reading, alarmSettings);
  const tempOff = channelOff(channels?.temp);
  const humidityOff = channelOff(channels?.humidity);
  const showHumidity =
    humidityOff && !tempOff && reading.humidityPct != null;
  const showTemp =
    !showHumidity && reading.tempC != null && Number.isFinite(reading.tempC);

  if (showTemp) {
    return {
      valueLabel: formatTempC(reading.tempC),
      bandLabel: tempAlarmBandLabel(reading, alarmSettings),
    };
  }
  if (
    showHumidity ||
    (reading.humidityPct != null && Number.isFinite(reading.humidityPct))
  ) {
    return {
      valueLabel: formatHumidityPct(reading.humidityPct),
      bandLabel: humidityAlarmBandLabel(reading, alarmSettings),
    };
  }
  return { valueLabel: null, bandLabel: null };
}

/** 덮개 글자 — 면과 같은 색상각, 더 진함. 흰/검정 잉크 없음. */
export function controllerEnvCoverInkClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "text-[var(--status-ok-ink)]";
  if (level === "warn") return "text-[var(--status-warn-ink)]";
  if (level === "danger") return "text-[var(--status-danger-ink)]";
  return "text-[var(--status-offline-ink)]";
}

/** 타일·차트 위 판정 글자 — 덮개 ink와 분리. 다크는 상태색 본값. */
export function controllerEnvCanvasTextClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "text-[var(--status-ok-on-canvas)]";
  if (level === "warn") return "text-[var(--status-warn-on-canvas)]";
  if (level === "danger") return "text-[var(--status-danger-on-canvas)]";
  return "text-[var(--status-offline-ink)]";
}

/**
 * 타일 수치 잉크 — 주의·위험·끊김이면 채널색 대신 판정/중성.
 * 채널 구분은 ℃·% 라벨로 유지 (상태 면과 채널 빨강·주황 혼동 방지).
 */
export function controllerEnvMetricTextClass(
  level: ControllerEnvCoverLevel | null | undefined,
  channelClass: string,
): string {
  if (level === "warn" || level === "danger") {
    return controllerEnvCanvasTextClass(level);
  }
  if (level === "offline") return "text-[var(--status-offline-ink)]";
  return channelClass;
}

/** 헤더 점 — 덮개와 같은 판정색. */
export function controllerEnvCoverFillClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") return "bg-[var(--status-ok)]";
  if (level === "warn") return "bg-[var(--status-warn)]";
  if (level === "danger") return "bg-[var(--status-danger)]";
  return "bg-muted-foreground";
}

/** 카드 테두리 — 덮개·점과 같은 판정색. */
export function controllerEnvCoverRingClass(
  level: ControllerEnvCoverLevel,
): string {
  if (level === "ok") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-ok)_70%,transparent)] -outline-offset-1";
  }
  if (level === "warn") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-warn)_80%,transparent)] -outline-offset-1";
  }
  if (level === "danger") {
    return "outline outline-2 outline-[color-mix(in_oklch,var(--status-danger)_80%,transparent)] -outline-offset-1";
  }
  return "outline outline-2 outline-[color-mix(in_oklch,var(--muted-foreground)_55%,transparent)] -outline-offset-1";
}

/** 차트·설정·명칭 등 실제 컨트롤. 여기가 아니면 덮개 다시 닫기. */
export const CONTROLLER_PANEL_INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, summary, label, [role='button'], [role='switch'], [role='tab'], [role='slider'], [role='combobox'], [role='menuitem']";

export function isControllerPanelInteractiveTarget(
  target: EventTarget | null,
): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  return Boolean(el?.closest(CONTROLLER_PANEL_INTERACTIVE_SELECTOR));
}
