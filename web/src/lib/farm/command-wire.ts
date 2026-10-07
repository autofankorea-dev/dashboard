/** 다운링크 0x0C 명령 15바이트. C.py `wire_command.build_command_wire_bytes` 와 동일. */

import { encodeCombinedCommandBody, type CommandChannelValues } from "@/lib/controllers/combined-channel-command";

import { encodeDeviceSettingsBody, type DeviceAlarmValues } from "@/lib/controllers/device-alarm-command";

const CMD_WIRE_VER = 0x0c;
const FLAG_CHANNEL_CMD = 0x01;
const CHANNEL_CTRL_SENTINEL = 0xff;
const EQPMN_CODE_CTRL_SENTINEL = 0xff;
const CMD_PACKET_SIZE = 15;
const CHANNEL_TO_WIRE = { A: 0, B: 1, C: 2 } as const;

export type CommandWireInput = {
  action?: string | null;
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: string | null;
  eqpmnCode?: string | null;
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
  wireHex?: string | null;
  channels?: CommandChannelValues[];
  alarmSettings?: DeviceAlarmValues;
};

function crc16CcittFalse(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8;
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function tempToX10(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.round(value * 10);
  if (n < 0 || n > 0xffff) return null;
  return n;
}

function stallTyToWire(raw: string): number | null {
  const match = /^SP(0[1-9]|10)$/i.exec(raw.trim());
  if (!match) return null;
  return Number(match[1]);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function normalizeCommandWireHex(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/^\\x/, "")
    .replace(/[^0-9a-f]/g, "");
  if (clean.length < 2 || clean.length % 2 !== 0) return null;
  return clean;
}

export function formatCommandWireBytes(hex: string): string {
  const clean = normalizeCommandWireHex(hex);
  if (!clean) return "";
  return (clean.match(/.{2}/g) ?? []).join(" ").toUpperCase();
}

export function encodeCommandWireHex(input: CommandWireInput): string | null {
  if (input.action === "SET_CHANNELS_THERMO" || input.action === "SET_CONTROLLER_SETTINGS") {
    const body = input.action === "SET_CONTROLLER_SETTINGS" ? encodeDeviceSettingsBody(input) : encodeCombinedCommandBody(input);
    if (!body) return null;
    const crc = crc16CcittFalse(body);
    return bytesToHex(Uint8Array.from([...body, crc & 255, crc >> 8]));
  }
  const stallTy = stallTyToWire(input.stallTyCode ?? "");
  const stallNo = Number.parseInt(String(input.stallNo ?? "").trim(), 10);
  const eqpmnNo = Number.parseInt(String(input.eqpmnNo ?? "").trim(), 10);
  const setpoint = tempToX10(input.setpointTemp);
  const deviation = tempToX10(input.tempDeviation);
  const minVent = Math.round(input.minVentPct);
  const maxVent = Math.round(input.maxVentPct);
  if (
    stallTy == null ||
    !Number.isInteger(stallNo) ||
    !Number.isInteger(eqpmnNo) ||
    setpoint == null ||
    deviation == null
  ) {
    return null;
  }
  if (
    stallNo < 1 ||
    stallNo > 32 ||
    eqpmnNo < 1 ||
    minVent < 0 ||
    maxVent > 100 ||
    minVent > maxVent
  ) {
    return null;
  }

  const channelAction =
    input.action === "SET_CHANNEL_THERMO" ||
    (input.action !== "SET_CTRL_THERMO" &&
      Boolean(input.channel) &&
      Boolean(input.eqpmnCode));

  let flags = 0;
  let channelByte = CHANNEL_CTRL_SENTINEL;
  let eqpmnCodeByte = EQPMN_CODE_CTRL_SENTINEL;
  if (channelAction) {
    const channel = String(input.channel ?? "")
      .trim()
      .toUpperCase();
    const eqpmnCode = String(input.eqpmnCode ?? "")
      .trim()
      .toUpperCase();
    const channelWire =
      channel === "A" || channel === "B" || channel === "C"
        ? CHANNEL_TO_WIRE[channel]
        : null;
    const codeMatch = /^EC(\d{2})$/.exec(eqpmnCode);
    if (channelWire == null || !codeMatch) return null;
    flags = FLAG_CHANNEL_CMD;
    channelByte = channelWire;
    eqpmnCodeByte = Number(codeMatch[1]);
  }

  const body = new Uint8Array(13);
  body[0] = CMD_WIRE_VER;
  body[1] = flags;
  body[2] = stallTy;
  body[3] = stallNo;
  body[4] = eqpmnNo;
  body[5] = channelByte;
  body[6] = eqpmnCodeByte;
  body[7] = setpoint & 0xff;
  body[8] = (setpoint >> 8) & 0xff;
  body[9] = deviation & 0xff;
  body[10] = (deviation >> 8) & 0xff;
  body[11] = minVent & 0xff;
  body[12] = maxVent & 0xff;
  const crc = crc16CcittFalse(body);
  const packet = new Uint8Array(CMD_PACKET_SIZE);
  packet.set(body);
  packet[13] = crc & 0xff;
  packet[14] = (crc >> 8) & 0xff;
  return bytesToHex(packet);
}

/** 전송된 hex가 있으면 그대로, 없으면 필드에서 15바이트를 재구성. */
export function applyQueueCommandBinary(input: CommandWireInput): string | null {
  const hex =
    normalizeCommandWireHex(input.wireHex) ?? encodeCommandWireHex(input);
  if (!hex) return null;
  return formatCommandWireBytes(hex);
}
