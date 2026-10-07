import assert from "node:assert/strict";
import wireVectors from "../../../ops/rsd/fixed-0e-vectors.json";
import { applyQueueChannelStripForReading } from "@/lib/farm/apply-queue";
import { encodeCommandWireHex } from "@/lib/farm/command-wire";
import { parseDeviceAlarms } from "./device-alarm-command";
import { commandChannelViews } from "./combined-channel-command";
import { deviceAlarmThresholds, commonDeviceAlarmThresholds } from "@/lib/data/device-alarm-thresholds";
import { controllerEnvCoverStatus } from "@/lib/farm/controller-env-cover";
import { liveReadingUnchanged } from "@/lib/farm/merge-live-slice";
import { envTrendReferenceLines, tempTrendLeftDomain } from "@/lib/farm/trend-chart-series";
import type { BarnReading } from "@/lib/data/iot";
const input = { action: "SET_CONTROLLER_SETTINGS", stallTyCode: "SP01", stallNo: "01", eqpmnNo: "03", setpointTemp: 25, tempDeviation: 2, minVentPct: 10, maxVentPct: 100, alarmSettings: { lowTempC: 10, highTempC: 43.6 } };
assert.equal(encodeCommandWireHex(input), "0e0101010300ffffffffffffffffffffffffffffffffffffffffff6400b4016d54");
const channels = [
  {channel: "A" as const,eqpmnCode:"EC01",setpointTemp:25,tempDeviation:2,minVentPct:10,maxVentPct:100},
  {channel: "B" as const,eqpmnCode:"EC02",setpointTemp:24,tempDeviation:1.5,minVentPct:20,maxVentPct:80},
  {channel: "C" as const,eqpmnCode:"EC03",setpointTemp:23.5,tempDeviation:3,minVentPct:30,maxVentPct:90},
];
assert.equal(encodeCommandWireHex({...input,channels}), "0e010101030701fa0014000a6402f0000f00145003eb001e001e5a6400b4012dcc");
assert.equal(encodeCommandWireHex({...input,channels:[channels[1]! ]})?.slice(10,12),"02");
for (const flags of [0, 1]) for (let mask = 0; mask <= 7; mask++) {
  const selected = channels.filter((_, index) => mask & (1 << index));
  const hex = encodeCommandWireHex({ ...input, channels: selected, alarmSettings: flags ? input.alarmSettings : undefined });
  if (!flags && !mask) { assert.equal(hex, null, "no-op must be rejected"); continue; }
  assert.ok(hex);
  assert.equal(hex, wireVectors.find(v => v.flags === flags && v.mask === mask)?.hex, "TypeScript must match AWS Python packet including CRC");
  const bytes = Buffer.from(hex, "hex");
  assert.equal(bytes.length, 33);
  assert.equal(bytes[0], 14); assert.equal(bytes[1], flags); assert.equal(bytes[5], mask);
  for (let slot = 0; slot < 3; slot++) if (!(mask & (1 << slot)))
    assert.deepEqual(bytes.subarray(6 + slot * 7, 13 + slot * 7), Buffer.alloc(7, 255));
  if (!flags) assert.deepEqual(bytes.subarray(27, 31), Buffer.alloc(4, 255));
}
assert.equal(encodeCommandWireHex({ ...input, channels, alarmSettings: null as never }), null);
assert.equal(encodeCommandWireHex({ ...input, channels: {} as never }), null);
for(const alarm of [{lowTempC:10,highTempC:10},{lowTempC:-1,highTempC:20},{lowTempC:10,highTempC:101},{lowTempC:NaN,highTempC:20},{lowTempC:10.05,highTempC:20},{lowTempC:"10",highTempC:20}]) assert.equal(parseDeviceAlarms(alarm),null);
assert.deepEqual(parseDeviceAlarms({lowTempC:0,highTempC:100}),{lowTempC:0,highTempC:100});
assert.deepEqual(commandChannelViews(input),[], "alarm-only commands must never patch thermo defaults");
assert.equal(commandChannelViews({...input,channels}).length,3);
const r = {status:"normal" as const,tempC:25,humidityPct:99,stallTyCode:"SP01",alarmLowTempC:10,alarmHighTempC:35};
assert.equal(controllerEnvCoverStatus(r).environment,"환경 정상","humidity user thresholds retired");
assert.equal(controllerEnvCoverStatus({...r,alarmHighTempC:null}).environment,"환경 확인 필요");
assert.equal(controllerEnvCoverStatus({...r,alarmHighTempC:20}).environment,"환경 경고");
assert.equal(commonDeviceAlarmThresholds([r,{...r}]).tempHigh,35);
assert.ok(Number.isNaN(commonDeviceAlarmThresholds([r,{...r,alarmHighTempC:30}]).tempHigh),"never average controller alarms");
assert.deepEqual(envTrendReferenceLines(deviceAlarmThresholds({})),[]);
assert.deepEqual(tempTrendLeftDomain(deviceAlarmThresholds({})),[0,50]);
const reading = {...r,key:"test",receivedAt:"t",mesureDt:"t"} as BarnReading;
assert.equal(liveReadingUnchanged(reading,{...reading,alarmHighTempC:30}),false);
const strip = applyQueueChannelStripForReading([{key:"test",id:"alarm",liveConfirmed:false,command:{farmKey:{lsindRegistNo:"X",itemCode:"P00"},moduleUid:1,controllerKey:"SP01:01:03",action:"SET_CONTROLLER_SETTINGS",status:"sent",channels:[]}}],{key:"test",farmKey:{lsindRegistNo:"X",itemCode:"P00"},moduleUid:1,controllerKey:"SP01:01:03"});
assert.equal(strip.length,1); assert.equal(strip[0]?.slot,null); assert.equal(strip[0]?.filled,2);
console.log("device-alarm-command: wire parity, invalid values, missing data, humidity retirement, common bands, refresh PASS");
