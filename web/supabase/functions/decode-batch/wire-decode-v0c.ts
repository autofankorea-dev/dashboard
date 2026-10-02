/** v0x0C wire decode — Edge decode-batch. */

const VER_V0C = 0x0c;
const HEADER_SIZE = 2;
const ROW_SIZE = 75;
/** After humidity: low-temp alarm u16 + high-temp alarm u16. */
const ALARM_BYTES = 4;
const ROW_SIZE_WITH_ALARM = ROW_SIZE + ALARM_BYTES;
const CRC_SIZE = 2;
const ROW_SENSOR_TEMPS = 4;
const CHANNEL_BLOCK = 19;
/** Field firmware: 500 = 0°C. Pilot 79B still sends tenths from 0. */
const TEMP_ORIGIN_X10 = 500;
const CHANNEL_LABELS = ["A", "B", "C"] as const;
const NA_TEMP = 0xffff;
const NA_FAN = 0xff;
const KIND_ERROR_V0C = 0x02;
const ERROR_BODY_SIZE_LEGACY = 3;
const ERROR_PACKET_SIZE_LEGACY = 5;
const ERROR_BODY_SIZE = 6;
const ERROR_PACKET_SIZE = 8;

/** Formal labels - docs/wire-v00c-error-uplink.md */
export const ERROR_CODE_LABELS_V0C: Record<number, string> = {
  0x11: "A 라인 고온 경보",
  0x12: "A 라인 저온 경보",
  0x21: "B 라인 고온 경보",
  0x22: "B 라인 저온 경보",
  0x31: "C 라인 고온 경보",
  0x32: "C 라인 저온 경보",
  0x41: "정전",
};

export type DecodedThermo = {
  setpointTemp: string | null;
  tempDeviation: string | null;
  minVentPct: number | null;
  maxVentPct: number | null;
};

export type DecodedV0cChannel = {
  channel: string;
  eqpmnCode: string;
  outputs: Record<string, string>;
  thermo: DecodedThermo | null;
};

export type DecodedV0cPayload = {
  schema_version: "v0c-1";
  wireVer: number;
  packetMode: "live" | "history";
  history: boolean;
  controllerKey: string;
  eqpmnNo: string;
  stallTyCode: string;
  stallNo: string;
  mesureDt: string;
  runMode: number;
  tempsC: (string | null)[];
  humidityPct: string | null;
  alarmLowTempC: string | null;
  alarmHighTempC: string | null;
  channels: DecodedV0cChannel[];
};

export type DecodedV0cError = {
  schema_version: "v0c-error-1" | "v0c-error-2";
  wireVer: number;
  kind: number;
  errCode: number;
  errCodeHex: string;
  errLabel: string;
  channel: string | null;
  crcOk: true;
  stallTyCode?: string;
  stallNo?: string;
  eqpmnNo?: string;
  controllerKey?: string;
};

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) - matches Python wire_decode. */
export function crc16CcittFalse(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]! << 8;
    for (let b = 0; b < 8; b++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function readU32LE(buf: Uint8Array, off: number): number {
  return (
    buf[off]! |
    (buf[off + 1]! << 8) |
    (buf[off + 2]! << 16) |
    (buf[off + 3]! << 24)
  ) >>> 0;
}

function formatHumidityPct(raw: number): string | null {
  if (raw === NA_TEMP || raw === 0) return null;
  return (raw / 10).toFixed(1);
}

/** Temperature tenths. Raw ≥ 500 uses origin 500 = 0°C; else tenths from 0. */
export function formatTempC(raw: number): string | null {
  if (raw === NA_TEMP || raw === 0) return null;
  const x10 = raw >= TEMP_ORIGIN_X10 ? raw - TEMP_ORIGIN_X10 : raw;
  return (x10 / 10).toFixed(1);
}

/** Kept for rows that are not a stall-type byte. The 1..10 gate is lifted. */
export const DECODE_ERROR_INVALID_STALL_TY = "INVALID_STALL_TY";

function isValidStallTyRaw(raw: number): boolean {
  return Number.isInteger(raw) && raw >= 0 && raw <= 255;
}

function formatStallTy(raw: number): string | null {
  if (!isValidStallTyRaw(raw)) return null;
  return `SP${String(raw).padStart(2, "0")}`;
}

export function invalidStallTyDetail(args: {
  stallTyRaw: number;
  stallNo: number;
  eqpmnNo: number;
}): string {
  return `stall_ty_raw=${args.stallTyRaw} stall_no=${args.stallNo} eqpmn_no=${args.eqpmnNo}`;
}

export type V0cInvalidStallTySkip = {
  status: "invalid_stall_ty";
  errorCode: typeof DECODE_ERROR_INVALID_STALL_TY;
  wireVer: number;
  stallTyRaw: number;
  stallNo: number;
  eqpmnNo: number;
  errorDetail: string;
};

export type V0cDecodeOutcome =
  | { status: "ok"; payload: DecodedV0cPayload }
  | V0cInvalidStallTySkip
  | { status: "skip" };

function formatStallNo(raw: number): string {
  return String(raw).padStart(2, "0");
}

function formatEqpmnNo(raw: number): string {
  return String(raw).padStart(2, "0");
}

function formatEqpmnCode(raw: number): string {
  return `EC${String(raw).padStart(2, "0")}`;
}

/** Korea has no DST. Firmware that stamps local wall-clock as UTC is +9h. */
const KST_OFFSET_SEC = 9 * 3600;
const MESURE_FUTURE_SKEW_SEC = 2 * 60;
const MESURE_BACKFILL_MAX_SEC = 30 * 24 * 3600;

/**
 * "auto"  — future-only heuristic (pilot/simulator may send true UTC).
 * "kst"   — known KST-stuffed firmware: always subtract 9h, so delayed
 *           reconnect bursts (epoch already in the past) are corrected too.
 */
export type ClockMode = "auto" | "kst";

/**
 * Config-driven clock mode. A device that stamps KST wall-clock as UTC epoch
 * must be listed (by "FARM02" or "FARM02/P00") so its replay bursts are also
 * shifted -9h; unlisted sources keep the safe future-only heuristic.
 */
export function clockModeForFarm(
  clockKstFarmKeys: string[] | null | undefined,
  lsind: string,
  item: string,
): ClockMode {
  if (!clockKstFarmKeys || clockKstFarmKeys.length === 0) return "auto";
  if (
    clockKstFarmKeys.includes(lsind) ||
    clockKstFarmKeys.includes(`${lsind}/${item}`)
  ) {
    return "kst";
  }
  return "auto";
}

function formatMesureDt(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return fmt.format(d).replace("T", " ");
}

/**
 * Packet `t` is UTC unix. If the controller stuffed KST digits into UTC,
 * the instant sits ~9h ahead of `received_at` (live) or 9h ahead of the
 * real sample (reconnect burst).
 *
 * clockMode "kst": known KST-stuffed firmware — always subtract 9h.
 * clockMode "auto": subtract 9h only when the shifted instant lands inside
 * [received − 30d, received + 2min] and the raw epoch is in the future.
 * True UTC (pilot/simulator) is unchanged under "auto".
 */
export function correctMesureEpochSec(
  epochSec: number,
  receivedAtMs: number,
  clockMode: ClockMode = "auto",
): number {
  if (!Number.isFinite(epochSec) || !Number.isFinite(receivedAtMs)) {
    return epochSec;
  }
  const corrected = epochSec - KST_OFFSET_SEC;
  if (clockMode === "kst") {
    return corrected;
  }
  const recvSec = receivedAtMs / 1000;
  if (
    epochSec > recvSec + MESURE_FUTURE_SKEW_SEC &&
    corrected <= recvSec + MESURE_FUTURE_SKEW_SEC &&
    corrected >= recvSec - MESURE_BACKFILL_MAX_SEC
  ) {
    return corrected;
  }
  return epochSec;
}

export function applyReceivedAtClock(
  mesureDtKst: string,
  receivedAtIso: string,
  clockMode: ClockMode = "auto",
): { mesureDt: string; mesureAtIso: string } {
  const epochMs = Date.parse(`${mesureDtKst.replace(" ", "T")}+09:00`);
  const recvMs = Date.parse(receivedAtIso);
  const epochSec = correctMesureEpochSec(epochMs / 1000, recvMs, clockMode);
  const mesureDt = formatMesureDt(epochSec);
  const mesureAtIso = new Date(
    `${mesureDt.replace(" ", "T")}+09:00`,
  ).toISOString();
  return { mesureDt, mesureAtIso };
}

function decodeThermo(block: Uint8Array, off: number): DecodedThermo | null {
  const sp = readU16LE(block, off);
  const dev = readU16LE(block, off + 2);
  const minV = block[off + 4]!;
  const maxV = block[off + 5]!;
  if (sp === NA_TEMP && dev === NA_TEMP && minV === NA_FAN && maxV === NA_FAN) {
    return null;
  }
  return {
    setpointTemp: sp === NA_TEMP ? null : formatTempC(sp),
    tempDeviation: dev === NA_TEMP ? null : formatTempC(dev),
    minVentPct: minV === NA_FAN ? null : minV,
    maxVentPct: maxV === NA_FAN ? null : maxV,
  };
}

function decodeChannelBlock(
  block: Uint8Array,
  channel: string,
): DecodedV0cChannel | null {
  if (block.every((b) => b === 0xff)) return null;
  const eqpmnRaw = block[0]!;
  const measMask = readU16LE(block, 1);
  const outputs: Record<string, string> = {};
  for (let sn = 0; sn < 10; sn++) {
    if (!(measMask & (1 << sn))) continue;
    const v = block[3 + sn]!;
    if (v === NA_FAN) continue;
    outputs[String(sn + 1)] = String(v);
  }
  return {
    channel,
    eqpmnCode: formatEqpmnCode(eqpmnRaw),
    outputs,
    thermo: decodeThermo(block, 13),
  };
}

function decodeRow(
  row: Uint8Array,
): Omit<
  DecodedV0cPayload,
  "schema_version" | "wireVer" | "packetMode" | "history"
> | null {
  const rowT = readU32LE(row, 0);
  const stallTy = formatStallTy(row[4]!);
  if (stallTy == null) return null;
  const stallNo = formatStallNo(row[5]!);
  const eqpmnNo = formatEqpmnNo(row[6]!);
  const runMode = row[7]!;
  const tempsC: (string | null)[] = [];
  let off = 8;
  for (let i = 0; i < ROW_SENSOR_TEMPS; i++) {
    tempsC.push(formatTempC(readU16LE(row, off)));
    off += 2;
  }
  const humidityPct = formatHumidityPct(readU16LE(row, off));
  off += 2;

  let alarmLowTempC: string | null = null;
  let alarmHighTempC: string | null = null;
  if (row.length === ROW_SIZE_WITH_ALARM) {
    alarmLowTempC = formatTempC(readU16LE(row, off));
    alarmHighTempC = formatTempC(readU16LE(row, off + 2));
    off += ALARM_BYTES;
  }

  const channels: DecodedV0cChannel[] = [];
  for (let i = 0; i < 3; i++) {
    const blockOff = off + i * CHANNEL_BLOCK;
    const block = row.subarray(blockOff, blockOff + CHANNEL_BLOCK);
    const ch = decodeChannelBlock(block, CHANNEL_LABELS[i]!);
    if (ch) channels.push(ch);
  }

  return {
    controllerKey: `${stallTy}:${stallNo}:${eqpmnNo}`,
    eqpmnNo,
    stallTyCode: stallTy,
    stallNo,
    mesureDt: formatMesureDt(rowT),
    runMode,
    tempsC,
    humidityPct,
    alarmLowTempC,
    alarmHighTempC,
    channels,
  };
}

export function parsePayloadBytea(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  const text = String(value).trim();
  if (!text) return null;
  const hex = text.startsWith("\\x") ? text.slice(2) : text;
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function decodeV0cPayloadOutcome(wire: Uint8Array): V0cDecodeOutcome {
  if (wire[0] !== VER_V0C) return { status: "skip" };
  const rowLen = wire.length - HEADER_SIZE - CRC_SIZE;
  if (rowLen !== ROW_SIZE && rowLen !== ROW_SIZE_WITH_ALARM) {
    return { status: "skip" };
  }

  const flags = wire[1]!;
  const history = Boolean(flags & 0x01);
  const row = wire.subarray(HEADER_SIZE, HEADER_SIZE + rowLen);
  if (row.length !== rowLen) return { status: "skip" };

  const stallTyRaw = row[4]!;
  if (!isValidStallTyRaw(stallTyRaw)) {
    const stallNo = row[5]!;
    const eqpmnNo = row[6]!;
    return {
      status: "invalid_stall_ty",
      errorCode: DECODE_ERROR_INVALID_STALL_TY,
      wireVer: VER_V0C,
      stallTyRaw,
      stallNo,
      eqpmnNo,
      errorDetail: invalidStallTyDetail({ stallTyRaw, stallNo, eqpmnNo }),
    };
  }

  const decoded = decodeRow(row);
  if (decoded == null) return { status: "skip" };
  return {
    status: "ok",
    payload: {
      schema_version: "v0c-1",
      wireVer: VER_V0C,
      packetMode: history ? "history" : "live",
      history,
      ...decoded,
    },
  };
}

export function decodeV0cPayload(wire: Uint8Array): DecodedV0cPayload | null {
  const outcome = decodeV0cPayloadOutcome(wire);
  return outcome.status === "ok" ? outcome.payload : null;
}

function channelFromErrCode(code: number): string | null {
  if (code === 0x41) return null;
  const hi = (code >> 4) & 0x0f;
  if (hi === 1) return "A";
  if (hi === 2) return "B";
  if (hi === 3) return "C";
  return null;
}

export function isErrorPacketV0c(wire: Uint8Array): boolean {
  return (
    (wire.length === ERROR_PACKET_SIZE_LEGACY ||
      wire.length === ERROR_PACKET_SIZE) &&
    wire[0] === VER_V0C &&
    wire[1] === KIND_ERROR_V0C
  );
}

export function encodeErrorPacketV0c(
  errcode: number,
  loc?: { stallTy: number; stallNo: number; eqpmnNo: number },
): Uint8Array {
  const code = errcode & 0xff;
  const body =
    loc != null
      ? new Uint8Array([
          VER_V0C,
          KIND_ERROR_V0C,
          loc.stallTy & 0xff,
          loc.stallNo & 0xff,
          loc.eqpmnNo & 0xff,
          code,
        ])
      : new Uint8Array([VER_V0C, KIND_ERROR_V0C, code]);
  const crc = crc16CcittFalse(body);
  const out = new Uint8Array(body.length + 2);
  out.set(body, 0);
  out[body.length] = crc & 0xff;
  out[body.length + 1] = (crc >> 8) & 0xff;
  return out;
}

export function decodeErrorPacketV0c(
  wire: Uint8Array,
  opts?: { allowUnknown?: boolean },
): DecodedV0cError | null {
  if (!isErrorPacketV0c(wire)) return null;
  const bodySize =
    wire.length === ERROR_PACKET_SIZE
      ? ERROR_BODY_SIZE
      : ERROR_BODY_SIZE_LEGACY;
  const body = wire.subarray(0, bodySize);
  const crcRecv = readU16LE(wire, bodySize);
  const crcCalc = crc16CcittFalse(body);
  if (crcRecv !== crcCalc) return null;

  let errCode: number;
  let schema_version: "v0c-error-1" | "v0c-error-2" = "v0c-error-1";
  let stallTyCode: string | undefined;
  let stallNo: string | undefined;
  let eqpmnNo: string | undefined;
  let controllerKey: string | undefined;

  if (wire.length === ERROR_PACKET_SIZE) {
    stallTyCode = formatStallTy(wire[2]!);
    stallNo = formatStallNo(wire[3]!);
    eqpmnNo = formatEqpmnNo(wire[4]!);
    errCode = wire[5]!;
    schema_version = "v0c-error-2";
    if (stallTyCode != null) {
      controllerKey = `${stallTyCode}:${stallNo}:${eqpmnNo}`;
    }
  } else {
    errCode = wire[2]!;
  }

  let errLabel = ERROR_CODE_LABELS_V0C[errCode];
  if (errLabel == null) {
    if (!opts?.allowUnknown) return null;
    errLabel = `미정의 경보(0x${errCode.toString(16).toUpperCase().padStart(2, "0")})`;
  }

  const decoded: DecodedV0cError = {
    schema_version,
    wireVer: VER_V0C,
    kind: KIND_ERROR_V0C,
    errCode,
    errCodeHex: `0x${errCode.toString(16).padStart(2, "0")}`,
    errLabel,
    channel: channelFromErrCode(errCode),
    crcOk: true,
  };
  if (stallTyCode != null && stallNo != null && eqpmnNo != null) {
    decoded.stallTyCode = stallTyCode;
    decoded.stallNo = stallNo;
    decoded.eqpmnNo = eqpmnNo;
    decoded.controllerKey = controllerKey;
  }
  return decoded;
}

export function decodeV0cPayloadFromDb(
  payloadBytea: unknown,
): DecodedV0cPayload | null {
  const outcome = decodeV0cPayloadOutcomeFromDb(payloadBytea);
  return outcome.status === "ok" ? outcome.payload : null;
}

export function decodeV0cPayloadOutcomeFromDb(
  payloadBytea: unknown,
): V0cDecodeOutcome {
  const wire = parsePayloadBytea(payloadBytea);
  if (!wire) return { status: "skip" };
  return decodeV0cPayloadOutcome(wire);
}

export function decodeErrorPacketFromDb(
  payloadBytea: unknown,
  opts?: { allowUnknown?: boolean },
): DecodedV0cError | null {
  const wire = parsePayloadBytea(payloadBytea);
  if (!wire) return null;
  return decodeErrorPacketV0c(wire, opts);
}

export function primaryTempC(tempsC: (string | null)[]): number | null {
  for (const t of tempsC) {
    if (t == null) continue;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseOptionalPct(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fanPctFromChannels(
  channels: DecodedV0cChannel[],
  eqpmnCode: string,
): number | null {
  const ch = channels.find((c) => c.eqpmnCode === eqpmnCode);
  return fanPctFromChannelOutputs(ch);
}

/**
 * 채널 슬롯(A/B/C) 기준 모터% — 표시 정본.
 * eqpmnCode 를 참조하지 않고 슬롯 라벨로 채널을 찾는다. 같은 eqpmnCode 를
 * 공유하는 채널이라도 슬롯별로 독립적인 값을 얻는다.
 */
export function fanPctFromChannelSlot(
  channels: DecodedV0cChannel[],
  slot: string,
): number | null {
  const ch = channels.find((c) => c.channel === slot);
  return fanPctFromChannelOutputs(ch);
}

function fanPctFromChannelOutputs(
  ch: DecodedV0cChannel | undefined,
): number | null {
  if (!ch?.outputs) return null;
  let max: number | null = null;
  for (const raw of Object.values(ch.outputs)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    max = max == null ? n : Math.max(max, n);
  }
  return max;
}

/** HOT decoded_json: keep channels (+ motor outputs) and tempsC; drop flat duplicates. */
export type SlimDecodedV0cJson = {
  schema_version: "v0c-slim-1";
  tempsC: (string | null)[];
  channels: DecodedV0cChannel[];
  alarmLowTempC?: string;
  alarmHighTempC?: string;
};

export function toSlimDecodedJson(payload: DecodedV0cPayload): SlimDecodedV0cJson {
  const slim: SlimDecodedV0cJson = {
    schema_version: "v0c-slim-1",
    tempsC: payload.tempsC,
    channels: payload.channels,
  };
  if (payload.alarmLowTempC != null) slim.alarmLowTempC = payload.alarmLowTempC;
  if (payload.alarmHighTempC != null) slim.alarmHighTempC = payload.alarmHighTempC;
  return slim;
}

/** Channel A thermo for flat HOT columns (list tier). */
export function channelAThermo(channels: DecodedV0cChannel[]): DecodedThermo | null {
  const a = channels.find((c) => c.channel === "A");
  if (a?.thermo) return a.thermo;
  for (const ch of channels) {
    if (ch.thermo) return ch.thermo;
  }
  return null;
}
