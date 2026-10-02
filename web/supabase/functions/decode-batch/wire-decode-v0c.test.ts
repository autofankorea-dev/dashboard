import assert from "node:assert/strict";
import {
  applyReceivedAtClock,
  clockModeForFarm,
  correctMesureEpochSec,
  crc16CcittFalse,
  decodeV0cPayload,
  decodeV0cPayloadOutcome,
  formatTempC,
  toSlimDecodedJson,
} from "./wire-decode-v0c.ts";

function hex(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, "hex"));
}

function u16(n: number): [number, number] {
  return [n & 0xff, (n >> 8) & 0xff];
}

function withCrc(body: Uint8Array): Uint8Array {
  const crc = crc16CcittFalse(body);
  const out = new Uint8Array(body.length + 2);
  out.set(body);
  out[body.length] = crc & 0xff;
  out[body.length + 1] = (crc >> 8) & 0xff;
  return out;
}

function emptyChannel(): number[] {
  return Array.from({ length: 19 }, () => 0xff);
}

function channelA(): number[] {
  const block = Array.from({ length: 19 }, () => 0);
  block[0] = 3;
  block[1] = 1;
  block[2] = 0;
  block[3] = 30;
  const thermo = [...u16(250), ...u16(20), 10, 80];
  block.splice(13, 6, ...thermo);
  return block;
}

assert.equal(formatTempC(250), "25.0");
assert.equal(formatTempC(750), "25.0");
assert.equal(formatTempC(600), "10.0");
assert.equal(formatTempC(936), "43.6");
assert.equal(formatTempC(0xffff), null);

const farm01Body = Uint8Array.from([
  0x0c,
  0x00,
  1,
  2,
  3,
  4,
  2,
  1,
  1,
  1,
  ...u16(200),
  ...u16(198),
  ...u16(195),
  ...u16(197),
  ...u16(506),
  ...channelA(),
  ...emptyChannel(),
  ...emptyChannel(),
]);
assert.equal(farm01Body.length, 77);

const p79 = decodeV0cPayload(withCrc(farm01Body));
assert.ok(p79);
assert.equal(p79.tempsC[0], "20.0");
assert.equal(p79.humidityPct, "50.6");
assert.equal(p79.alarmLowTempC, null);
assert.equal(p79.alarmHighTempC, null);
assert.equal(p79.channels[0]?.thermo?.setpointTemp, "25.0");
assert.equal(p79.channels[0]?.thermo?.tempDeviation, "2.0");
assert.deepEqual(Object.keys(toSlimDecodedJson(p79)).sort(), [
  "channels",
  "schema_version",
  "tempsC",
]);

const farm02Alarm = decodeV0cPayload(
  hex(
    "0c00bcee8f6a070101002003ffffffffffffffff5802a8030f0600004b4b00000000000000ee022602194b0f0000000000000000000000000d022b0219640f000000000000000000000000170229021964c153",
  ),
);
assert.ok(farm02Alarm);
assert.equal(farm02Alarm.tempsC[0], "30.0");
assert.equal(farm02Alarm.humidityPct, null);
assert.equal(farm02Alarm.alarmLowTempC, "10.0");
assert.equal(farm02Alarm.alarmHighTempC, "43.6");
assert.equal(farm02Alarm.channels[0]?.thermo?.setpointTemp, "25.0");
assert.equal(farm02Alarm.channels[0]?.thermo?.tempDeviation, "5.0");
const slim83 = toSlimDecodedJson(farm02Alarm);
assert.equal(slim83.alarmLowTempC, "10.0");
assert.equal(slim83.alarmHighTempC, "43.6");

const stallTy255 = Uint8Array.from(farm01Body);
stallTy255[6] = 0xff;
const outcome255 = decodeV0cPayloadOutcome(withCrc(stallTy255));
assert.equal(outcome255.status, "ok");
if (outcome255.status !== "ok") {
  throw new Error("expected stall type 255 to decode");
}
assert.equal(outcome255.payload.stallTyCode, "SP255");
assert.equal(outcome255.payload.controllerKey, "SP255:01:01");

const zeroStallTy = Uint8Array.from(farm01Body);
zeroStallTy[6] = 0;
const zeroOutcome = decodeV0cPayloadOutcome(withCrc(zeroStallTy));
assert.equal(zeroOutcome.status, "ok");
if (zeroOutcome.status !== "ok") {
  throw new Error("expected stall type 0 to decode");
}
assert.equal(zeroOutcome.payload.stallTyCode, "SP00");

const recvLive = Date.parse("2026-08-26T23:45:15.207Z");
assert.equal(correctMesureEpochSec(1_787_787_915, recvLive), 1_787_787_915);
assert.equal(correctMesureEpochSec(1_787_820_360, recvLive), 1_787_787_960);
assert.equal(
  correctMesureEpochSec(1_787_820_360 - 2 * 3600, recvLive),
  1_787_787_960 - 2 * 3600,
);
assert.equal(correctMesureEpochSec(2_900_000_000, recvLive), 2_900_000_000);

const liveClock = applyReceivedAtClock(
  "2026-08-27 17:46:00",
  "2026-08-26T23:45:15.207Z",
);
assert.equal(liveClock.mesureDt, "2026-08-27 08:46:00");
const backfillClock = applyReceivedAtClock(
  "2026-08-27 15:46:00",
  "2026-08-26T23:45:15.207Z",
);
assert.equal(backfillClock.mesureDt, "2026-08-27 06:46:00");
const utcClock = applyReceivedAtClock(
  "2026-08-27 08:45:15",
  "2026-08-26T23:45:15.207Z",
);
assert.equal(utcClock.mesureDt, "2026-08-27 08:45:15");

// clockMode "kst": 지연 replay(과거 epoch)도 항상 -9h.
assert.equal(correctMesureEpochSec(1_787_000_000, recvLive), 1_787_000_000);
assert.equal(
  correctMesureEpochSec(1_787_000_000, recvLive, "kst"),
  1_787_000_000 - 9 * 3600,
);
// clockMode "kst"에서 미래(live) epoch도 auto와 동일하게 -9h.
assert.equal(
  correctMesureEpochSec(1_787_820_360, recvLive, "kst"),
  1_787_787_960,
);

// applyReceivedAtClock: auto는 과거 replay를 그대로 두지만(+9h 오류), kst는 교정.
const replayRecv = "2026-08-26T23:45:15.207Z";
const replayAuto = applyReceivedAtClock("2026-08-20 19:00:00", replayRecv, "auto");
assert.equal(replayAuto.mesureDt, "2026-08-20 19:00:00");
const replayKst = applyReceivedAtClock("2026-08-20 19:00:00", replayRecv, "kst");
assert.equal(replayKst.mesureDt, "2026-08-20 10:00:00");

// clockModeForFarm 매칭 규칙.
assert.equal(clockModeForFarm(["FARM02", "FARM03"], "FARM02", "P00"), "kst");
assert.equal(clockModeForFarm(["FARM02/P00"], "FARM02", "P00"), "kst");
assert.equal(clockModeForFarm(["FARM02"], "FARM01", "P00"), "auto");
assert.equal(clockModeForFarm([], "FARM02", "P00"), "auto");
assert.equal(clockModeForFarm(null, "FARM02", "P00"), "auto");

assert.equal(decodeV0cPayload(hex("0c00")), null);

console.log("wire-decode-v0c.test.ts: ok");
