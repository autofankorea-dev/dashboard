import { encodeCombinedCommandBody, type CommandChannelValues } from "./combined-channel-command";
export const DEVICE_SETTINGS_ACTION = "SET_CONTROLLER_SETTINGS";
export type DeviceAlarmValues = { lowTempC: number; highTempC: number };
export function parseDeviceAlarms(raw: unknown): DeviceAlarmValues | null {
  if (!raw || typeof raw !== "object") return null;
  const { lowTempC: low, highTempC: high } = raw as DeviceAlarmValues;
  if ([low, high].some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100 || Math.abs(v * 10 - Math.round(v * 10)) > 1e-8) || !(low < high)) return null;
  return { lowTempC: low, highTempC: high };
}
export function encodeDeviceSettingsBody(input: {
  stallTyCode?: string | null; stallNo?: string | null; eqpmnNo?: string | null;
  channels?: CommandChannelValues[]; alarmSettings?: DeviceAlarmValues;
}): Uint8Array | null {
  const alarm = input.alarmSettings === undefined ? null : parseDeviceAlarms(input.alarmSettings);
  if (input.alarmSettings !== undefined && !alarm) return null;
  if (input.channels !== undefined && !Array.isArray(input.channels)) return null;
  if (!alarm && !input.channels?.length) return null;
  let base = encodeCombinedCommandBody(input);
  if (!base && !input.channels?.length && alarm) {
    base = encodeCombinedCommandBody({ ...input, channels: [{ channel: "A", eqpmnCode: "EC01", setpointTemp: 25, tempDeviation: 2, minVentPct: 0, maxVentPct: 100 }] });
    if (base) { base.fill(255, 6); base[5] = 0; }
  }
  if (!base) return null;
  const body = new Uint8Array(31).fill(255);
  body.set(base); body[0] = 0x0e; body[1] = alarm ? 1 : 0;
  if (alarm) {
    const view = new DataView(body.buffer);
    view.setUint16(27, Math.round(alarm.lowTempC * 10), true);
    view.setUint16(29, Math.round(alarm.highTempC * 10), true);
  }
  return body;
}
