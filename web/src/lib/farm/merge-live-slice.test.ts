/**
 * 실행: npx tsx src/lib/farm/merge-live-slice.test.ts
 */
import assert from "node:assert/strict";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  mergeLiveBarnSnapshots,
  mergeLiveReadings,
  retainLiveList,
} from "./merge-live-slice";

const farmKey: FarmKey = { lsindRegistNo: "123456", itemCode: "P00" };

function reading(key: string, tempC: number): BarnReading {
  return {
    key,
    farmKey,
    moduleUid: 1,
    controllerKey: key,
    eqpmnNo: "05",
    stallNo: "01",
    stallTyCode: "SP07",
    label: key,
    tempC,
    humidityPct: null,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: "2026-10-02T07:00:00.000Z",
    status: "normal",
    packetMode: "live",
    wireVer: 12,
  };
}

function snapshot(id: string): BarnMapSnapshot {
  return {
    meta: {
      id,
      farmKey,
      moduleUid: 1,
      stallNo: "01",
      name: id,
      grid: { col: 1, row: 1 },
    },
    controllerCount: 1,
    tempC: 24.5,
    humidityPct: null,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    status: "normal",
    receivedAt: "2026-10-02T07:00:00.000Z",
  };
}

const cards = [reading("SP07:01:05", 24.5), reading("SP07:01:08", 24.5)];
const barns = [snapshot("SP07:01")];

assert.equal(retainLiveList(cards, []).length, 2);
assert.equal(retainLiveList([], []).length, 0);
assert.equal(retainLiveList([], cards), cards);

const keptReadings = mergeLiveReadings(cards, []);
assert.equal(keptReadings, cards);

const keptBarns = mergeLiveBarnSnapshots(barns, []);
assert.equal(keptBarns, barns);

const replaced = mergeLiveReadings(cards, [reading("SP07:01:12", 24.7)]);
assert.equal(replaced.length, 1);
assert.equal(replaced[0]?.key, "SP07:01:12");

console.log("merge-live-slice.test.ts: ok");
