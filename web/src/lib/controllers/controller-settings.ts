import { commandChannelViews } from "@/lib/controllers/combined-channel-command";
import type { ThermoCommand } from "@/lib/data/commands";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

export type ControllerThermoSettings = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
  /** live=LIVE uplink, applied=명령 반영 확인, sent=MQTT 전송, pending=대기 */
  source: "live" | "applied" | "sent" | "pending";
  updatedAt: string;
};

export function thermoSettingsKey(
  farmKey: FarmKey,
  moduleUid: number,
  controllerKey: string,
  channel?: import("@/lib/data/iot-channel").ChannelSlot
): string {
  const base = `${farmKeyId(farmKey)}:${moduleUid}:${controllerKey}`;
  return channel ? `${base}:${channel}` : base;
}

export function resolveThermoSettings(
  map: Record<string, ControllerThermoSettings>,
  farmKey: FarmKey | undefined,
  moduleUid: number | undefined,
  controllerKey: string | undefined,
  channel?: import("@/lib/data/iot-channel").ChannelSlot
): ControllerThermoSettings | null {
  if (!farmKey || moduleUid == null || !controllerKey) return null;
  if (channel) {
    const ch = map[thermoSettingsKey(farmKey, moduleUid, controllerKey, channel)];
    if (ch) return ch;
  }
  return map[thermoSettingsKey(farmKey, moduleUid, controllerKey)] ?? null;
}

export function thermoValuesMatch(
  a: Pick<
    ControllerThermoSettings,
    "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
  >,
  b: Pick<
    ControllerThermoSettings,
    "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
  >
): boolean {
  const close = (x: number, y: number, eps = 0.05) => Math.abs(x - y) <= eps;
  return (
    close(a.setpointTemp, b.setpointTemp) &&
    close(a.tempDeviation, b.tempDeviation) &&
    a.minVentPct === b.minVentPct &&
    a.maxVentPct === b.maxVentPct
  );
}

export function settingsFromCommand(cmd: ThermoCommand): ControllerThermoSettings {
  const source: ControllerThermoSettings["source"] =
    cmd.status === "pending"
      ? "pending"
      : cmd.status === "applied"
        ? "applied"
        : "sent";

  return {
    setpointTemp: cmd.setpointTemp,
    tempDeviation: cmd.tempDeviation,
    minVentPct: cmd.minVentPct,
    maxVentPct: cmd.maxVentPct,
    source,
    updatedAt: cmd.appliedAt ?? cmd.sentAt ?? cmd.createdAt,
  };
}

/** ctrl별 최신 설정 (pending > sent/applied) */
export function buildThermoSettingsMap(
  commands: ThermoCommand[]
): Record<string, ControllerThermoSettings> {
  const sent = new Map<string, ThermoCommand>();
  const pending = new Map<string, ThermoCommand>();

  for (const cmd of commands.flatMap(commandChannelViews)) {
    if (cmd.status === "failed" || cmd.status === "cancelled") continue;
    const key = thermoSettingsKey(
      cmd.farmKey,
      cmd.moduleUid,
      cmd.controllerKey,
      cmd.channel
    );
    if (cmd.status === "sent" || cmd.status === "applied") {
      if (!sent.has(key)) sent.set(key, cmd);
    } else if (cmd.status === "pending") {
      if (!pending.has(key)) pending.set(key, cmd);
    }
  }

  const out: Record<string, ControllerThermoSettings> = {};
  for (const [key, cmd] of sent) {
    out[key] = settingsFromCommand(cmd);
  }
  for (const [key, cmd] of pending) {
    out[key] = settingsFromCommand(cmd);
  }
  return out;
}

export type DecodedThermo = {
  setpointTemp: string | number;
  tempDeviation: string | number;
  minVentPct: number;
  maxVentPct: number;
};

export function thermoFromDecoded(
  raw:
    | DecodedThermo
    | {
        setpointTemp?: string | number;
        tempDeviation?: string | number;
        minVentPct?: number;
        maxVentPct?: number;
      }
    | null
    | undefined
): Omit<ControllerThermoSettings, "source" | "updatedAt"> | null {
  if (!raw) return null;
  if (
    raw.setpointTemp == null ||
    raw.tempDeviation == null ||
    raw.minVentPct == null ||
    raw.maxVentPct == null
  ) {
    return null;
  }
  const setpointTemp = Number(raw.setpointTemp);
  const tempDeviation = Number(raw.tempDeviation);
  const minVentPct = Number(raw.minVentPct);
  const maxVentPct = Number(raw.maxVentPct);
  if (
    !Number.isFinite(setpointTemp) ||
    !Number.isFinite(tempDeviation) ||
    !Number.isFinite(minVentPct) ||
    !Number.isFinite(maxVentPct)
  ) {
    return null;
  }
  return { setpointTemp, tempDeviation, minVentPct, maxVentPct };
}

/** LIVE decoded_json — ctrl·채널별 설정 (최신 receivedAt 우선) */
function assignLiveThermo(
  out: Record<string, ControllerThermoSettings>,
  key: string,
  parsed: Omit<ControllerThermoSettings, "source" | "updatedAt">,
  receivedAt: string,
): void {
  const existing = out[key];
  if (existing && existing.updatedAt >= receivedAt) return;
  out[key] = { ...parsed, source: "live", updatedAt: receivedAt };
}

export function buildThermoSettingsFromReadings(
  readings: Array<{
    farmKey: import("@/lib/data/farm-key").FarmKey;
    moduleUid: number;
    controllerKey: string;
    receivedAt: string;
    thermo?: DecodedThermo | null | {
      setpointTemp?: string | number;
      tempDeviation?: string | number;
      minVentPct?: number;
      maxVentPct?: number;
    } | null;
    channels?: import("@/lib/data/iot-channel").ChannelReading[];
  }>
): Record<string, ControllerThermoSettings> {
  const out: Record<string, ControllerThermoSettings> = {};
  for (const r of readings) {
    if (r.channels?.length) {
      for (const ch of r.channels) {
        const parsed = thermoFromDecoded(ch.thermo);
        if (!parsed) continue;
        const key = thermoSettingsKey(
          r.farmKey,
          r.moduleUid,
          r.controllerKey,
          ch.channel
        );
        assignLiveThermo(out, key, parsed, r.receivedAt);
      }
      continue;
    }
    const parsed = thermoFromDecoded(r.thermo);
    if (!parsed) continue;
    // slim list-tier: root thermo = channel A flat fields (channels[] 생략).
    // :A에도 넣어 채널 명령 키와 merge·resolve가 맞물리게 함.
    const baseKey = thermoSettingsKey(r.farmKey, r.moduleUid, r.controllerKey);
    assignLiveThermo(out, baseKey, parsed, r.receivedAt);
    assignLiveThermo(
      out,
      thermoSettingsKey(r.farmKey, r.moduleUid, r.controllerKey, "A"),
      parsed,
      r.receivedAt,
    );
  }
  return out;
}

/** 명령 + LIVE 병합 — 값이 다르면 명령(적용값) 우선. 사용자는 적용값을 바로 본다. */
export function mergeThermoSettingsMaps(
  commandMap: Record<string, ControllerThermoSettings>,
  liveMap: Record<string, ControllerThermoSettings>
): Record<string, ControllerThermoSettings> {
  const keys = new Set([
    ...Object.keys(commandMap),
    ...Object.keys(liveMap),
  ]);
  const out: Record<string, ControllerThermoSettings> = {};

  for (const key of keys) {
    const cmd = commandMap[key];
    const live = liveMap[key];

    if (live && cmd) {
      if (thermoValuesMatch(live, cmd)) {
        out[key] = { ...live, source: "live" };
      } else {
        out[key] = cmd;
      }
      continue;
    }
    if (cmd) out[key] = cmd;
    else if (live) out[key] = live;
  }

  return out;
}

export function commandStatusLabel(status: ThermoCommand["status"]): string {
  switch (status) {
    case "pending":
      return "전송 대기";
    case "sent":
      return "전송 완료";
    case "applied":
      return "적용 완료";
    case "failed":
      return "실패";
    case "cancelled":
      return "취소";
    default:
      return status;
  }
}
