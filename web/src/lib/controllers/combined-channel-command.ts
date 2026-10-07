import type { ChannelSlot } from "@/lib/data/iot-channel";

export const COMBINED_CHANNEL_ACTION = "SET_CHANNELS_THERMO";
export const COMBINED_WIRE_VERSION = 0x0d;
export const COMBINED_PACKET_SIZE = 29;
export type CommandChannelValues = {
  channel: ChannelSlot;
  eqpmnCode: string;
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

/** Canonical A/B/C order; reject duplicates, malformed codes and out-of-range values. */
export function parseCommandChannels(raw: unknown): CommandChannelValues[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) return null;
  const slots = new Set<string>();
  const channels: CommandChannelValues[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const { channel, eqpmnCode, setpointTemp, tempDeviation, minVentPct, maxVentPct } = row;
    if (!["A", "B", "C"].includes(channel) || slots.has(channel) ||
      typeof eqpmnCode !== "string" || !/^EC(0[1-9]|[1-9][0-9])$/.test(eqpmnCode)) return null;
    const values = [setpointTemp, tempDeviation, minVentPct, maxVentPct];
    if (values.some((v) => typeof v !== "number" || !Number.isFinite(v)) ||
      setpointTemp < 0 || setpointTemp > 30 || tempDeviation < 0.5 || tempDeviation > 10 ||
      minVentPct < 0 || maxVentPct > 100 || minVentPct > maxVentPct ||
      !Number.isInteger(minVentPct) || !Number.isInteger(maxVentPct) ||
      Math.abs(setpointTemp * 10 - Math.round(setpointTemp * 10)) > 1e-8 ||
      Math.abs(tempDeviation * 10 - Math.round(tempDeviation * 10)) > 1e-8) return null;
    slots.add(channel);
    channels.push({ channel, eqpmnCode, setpointTemp, tempDeviation, minVentPct, maxVentPct });
  }
  return channels.sort((a, b) => a.channel.localeCompare(b.channel));
}

/** Views share one DB command ID/status; each view carries its channel's values. */
export function commandChannelViews<T extends { channels?: CommandChannelValues[] }>(command: T): T[] {
  return command.channels?.length
    ? command.channels.map((values) => ({ ...command, ...values, channels: undefined }))
    : [command];
}

export function encodeCombinedCommandBody(input: {
  stallTyCode?: string | null; stallNo?: string | null; eqpmnNo?: string | null;
  channels?: CommandChannelValues[];
}): Uint8Array | null {
  const channels = parseCommandChannels(input.channels);
  const sp = /^SP(0[1-9]|10)$/.exec(input.stallTyCode ?? "");
  const stall = Number(input.stallNo), controller = Number(input.eqpmnNo);
  if (!channels || !sp || !Number.isInteger(stall) || stall < 1 || stall > 32 ||
    !Number.isInteger(controller) || controller < 1 || controller > 10) return null;
  const body = new Uint8Array(27).fill(0xff);
  body.set([COMBINED_WIRE_VERSION, 0, Number(sp[1]), stall, controller, 0]);
  for (const row of channels) {
    const slot = row.channel.charCodeAt(0) - 65;
    body[5]! |= 1 << slot;
    const off = 6 + slot * 7;
    const setpoint = Math.round(row.setpointTemp * 10), deviation = Math.round(row.tempDeviation * 10);
    body.set([Number(row.eqpmnCode.slice(2)), setpoint & 255, setpoint >> 8,
      deviation & 255, deviation >> 8, row.minVentPct, row.maxVentPct], off);
  }
  return body;
}
