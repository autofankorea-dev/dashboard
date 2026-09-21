import assert from "node:assert/strict";
import {
  buildBulkThermoCommands,
  bulkDirtyChannelSlots,
  emptyBulkChannelDrafts,
  resolveBulkSendChannels,
  type BulkChannelThermo,
} from "@/components/farm/farm-map-bulk-apply-parts";
import { thermoSettingsKey } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/data/iot-channel";

const farmKey = { lsindRegistNo: "FARM01", itemCode: "P00" };
const controllerKey = "SP01:01:EC01";

function ch(slot: ChannelSlot, eqpmnCode: string) {
  return {
    channel: slot,
    eqpmnCode,
    tempC: 20,
    humidityPct: 50,
    fanPct: 40,
    fanSeries: [],
    thermo: null,
  };
}

function reading(): BarnReading {
  return {
    key: "k1",
    farmKey,
    moduleUid: 1,
    controllerKey,
    eqpmnNo: "EC01",
    stallNo: "01",
    stallTyCode: "SP01",
    label: "t",
    tempC: 20,
    humidityPct: 50,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: new Date().toISOString(),
    status: "normal",
    packetMode: "live",
    wireVer: 0x0a,
    runMode: null,
    channels: [ch("A", "EC01"), ch("B", "EC02"), ch("C", "EC03")],
  };
}

function thermo(
  setpoint: number,
  extra: Partial<BulkChannelThermo> = {},
): BulkChannelThermo {
  return {
    setpoint,
    deviation: 2,
    minVent: 10,
    maxVent: 70,
    ...extra,
  };
}

const seeds = emptyBulkChannelDrafts();
const dirtyB = {
  ...seeds,
  B: { ...seeds.B, setpoint: 26.1 },
};
const settings = {
  [thermoSettingsKey(farmKey, 1, controllerKey, "A")]: {
    setpointTemp: 25,
    tempDeviation: 2,
    minVentPct: 10,
    maxVentPct: 70,
    source: "live" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

assert.deepEqual(
  bulkDirtyChannelSlots(dirtyB, seeds, true, true),
  ["B"],
);
assert.deepEqual(
  resolveBulkSendChannels(dirtyB, seeds, true, true),
  ["B"],
);
assert.deepEqual(
  resolveBulkSendChannels(seeds, seeds, true, true),
  ["A", "B", "C"],
);

const cmds = buildBulkThermoCommands([reading()], settings, {
  applyTemp: true,
  applyVent: false,
  channelDrafts: {
    A: thermo(25.1),
    B: thermo(26.1),
    C: thermo(24.0),
  },
  selectedChannels: ["A", "B"],
});

assert.equal(cmds.length, 2);
assert.equal(cmds[0]?.channel, "A");
assert.equal(cmds[0]?.setpointTemp, 25.1);
assert.equal(cmds[0]?.eqpmnCode, "EC01");
assert.equal(cmds[1]?.channel, "B");
assert.equal(cmds[1]?.setpointTemp, 26.1);
assert.equal(cmds[1]?.eqpmnCode, "EC02");

console.log("farm-map-bulk-apply-parts.test.ts: ok");
