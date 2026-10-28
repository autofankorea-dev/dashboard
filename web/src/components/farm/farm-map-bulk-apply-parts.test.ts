import { test } from "vitest";
import assert from "node:assert/strict";
import {
  buildBulkThermoCommands,
  bulkDirtyChannelSlots,
  bulkDraftsFromPreset,
  bulkSendSlots,
  bulkThermoDraftSeedByChannel,
  emptyBulkChannelDrafts,
  resolveBulkSendChannels,
  type BulkChannelThermo,
} from "@/components/farm/farm-map-bulk-apply-parts";
import { thermoSettingsKey } from "@/lib/controllers/controller-settings";
import type { BarnReading } from "@/lib/data/iot";
import type { ChannelSlot } from "@/lib/domain/iot-channel";

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

const cmds = buildBulkThermoCommands([reading()], {
  channelDrafts: {
    A: thermo(25.1),
    B: thermo(26.1),
    C: thermo(24.0),
  },
});

assert.equal(cmds.length, 3);
assert.equal(cmds[0]?.channel, "A");
assert.equal(cmds[0]?.setpointTemp, 25.1);
assert.equal(cmds[0]?.eqpmnCode, "EC01");
assert.equal(cmds[1]?.channel, "B");
assert.equal(cmds[1]?.setpointTemp, 26.1);
assert.equal(cmds[1]?.eqpmnCode, "EC02");
assert.equal(cmds[2]?.channel, "C");
assert.equal(cmds[2]?.setpointTemp, 24);
assert.equal(cmds[0]?.minVentPct, 10);

{
  const applied = bulkDraftsFromPreset(seeds, {
    A: {
      setpointTemp: 21,
      tempDeviation: 1.5,
      minVentPct: 20,
      maxVentPct: 80,
    },
  });
  assert.deepEqual(applied.slots, ["A"]);
  assert.equal(applied.drafts.A.setpoint, 21);
  assert.equal(applied.drafts.A.minVent, 20);
  assert.equal(applied.drafts.B.setpoint, seeds.B.setpoint);
  const sameAsSeed = bulkDraftsFromPreset(seeds, {
    B: {
      setpointTemp: seeds.B.setpoint,
      tempDeviation: seeds.B.deviation,
      minVentPct: seeds.B.minVent,
      maxVentPct: seeds.B.maxVent,
    },
  });
  assert.deepEqual(
    bulkSendSlots(sameAsSeed.drafts, seeds, true, true, sameAsSeed.slots),
    ["B"],
  );
  assert.deepEqual(
    bulkSendSlots(applied.drafts, seeds, true, true, ["A"]),
    ["A"],
  );
}

console.log("farm-map-bulk-apply-parts.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});

test("bulk snapshot sends all fields on all channels to 14 mixed controllers, even unchanged seeds", () => {
  const targets = Array.from({ length: 14 }, (_, i) => ({
    ...reading(), key: `k${i}`, eqpmnNo: String(i + 1).padStart(2, "0"),
    controllerKey: `SP01:01:${String(i + 1).padStart(2, "0")}`,
    channels: reading().channels!.map((c, j) => ({ ...c, thermo: {
      setpointTemp: 20 + i + j, tempDeviation: 1 + i,
      minVentPct: i + j, maxVentPct: 80 + i,
    } })),
  }));
  const snapshot = bulkThermoDraftSeedByChannel(targets, settings);
  const unchanged = buildBulkThermoCommands(targets, { channelDrafts: snapshot });
  assert.equal(unchanged.length, 42);
  for (const target of targets) {
    const sent = unchanged.filter(c => c.key === target.key);
    assert.deepEqual(sent.map(c => c.channel), ["A", "B", "C"]);
    for (const c of sent) {
      const d = snapshot[c.channel!];
      assert.deepEqual([c.setpointTemp, c.tempDeviation, c.minVentPct, c.maxVentPct],
        [d.setpoint, d.deviation, d.minVent, d.maxVent]);
    }
  }
  const onlyVentEdited = structuredClone(snapshot);
  onlyVentEdited.C.minVent = 30;
  const sent = buildBulkThermoCommands(targets, { channelDrafts: onlyVentEdited });
  assert.equal(sent.length, 42);
  assert(sent.filter(c => c.channel === "B").every(c => c.minVentPct === snapshot.B.minVent));
  assert(sent.filter(c => c.channel === "C").every(c => c.setpointTemp === snapshot.C.setpoint && c.tempDeviation === snapshot.C.deviation && c.minVentPct === 30));
});
