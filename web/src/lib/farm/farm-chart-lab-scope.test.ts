/**
 * 실행: npx tsx src/lib/farm/farm-chart-lab-scope.test.ts
 */
import assert from "node:assert/strict";
import type { BarnReading } from "@/lib/data/iot";
import {
  dismissFarmChartLabHero,
  farmChartLabControllerScopes,
  farmChartLabScopeKey,
  farmChartLabSelectionFromKeys,
  farmChartLabStallKey,
  indexReadingsByChartScope,
  controllersShareStall,
  uniqueFarmChartLabStalls,
} from "./farm-chart-scope";

const indexedReadings = [
  {
    stallTyCode: "sp03",
    stallNo: "01",
    controllerKey: "a",
  },
  {
    stallTyCode: "SP03",
    stallNo: "01",
    controllerKey: "b",
  },
] as BarnReading[];
const scopeIndex = indexReadingsByChartScope(indexedReadings);
assert.equal(scopeIndex.get("farm"), indexedReadings);
assert.deepEqual(scopeIndex.get("sp:SP03"), indexedReadings);
assert.deepEqual(scopeIndex.get("stall:SP03:01"), indexedReadings);
assert.deepEqual(scopeIndex.get("SP03:01:a"), [indexedReadings[0]]);

assert.deepEqual(farmChartLabControllerScopes([]), []);
assert.equal(
  farmChartLabScopeKey({
    level: "controller",
    stallTyCode: "SP03",
    stallNo: "1",
    controllerKey: "a",
  }),
  "SP03:1:a",
);

assert.deepEqual(
  dismissFarmChartLabHero({
    dismissedKey: "a",
    primaryKey: "a",
    partnerKey: null,
  }),
  { mode: "batch", primaryKey: "a", partnerKey: null },
);
assert.deepEqual(
  dismissFarmChartLabHero({
    dismissedKey: "b",
    primaryKey: "a",
    partnerKey: "b",
  }),
  { mode: "single", primaryKey: "a", partnerKey: null },
);
assert.deepEqual(
  dismissFarmChartLabHero({
    dismissedKey: "a",
    primaryKey: "a",
    partnerKey: "b",
  }),
  { mode: "single", primaryKey: "b", partnerKey: null },
);

const a = {
  level: "controller" as const,
  stallTyCode: "SP03",
  stallNo: "1",
  controllerKey: "a",
};
const b = {
  level: "controller" as const,
  stallTyCode: "SP03",
  stallNo: "1",
  controllerKey: "b",
};
assert.equal(
  farmChartLabSelectionFromKeys([a, b], {
    mode: "batch",
    primaryKey: "SP03:1:a",
    partnerKey: null,
  }).mode,
  "batch",
);
const singleSel = farmChartLabSelectionFromKeys([a, b], {
  mode: "single",
  primaryKey: "SP03:1:a",
  partnerKey: "SP03:1:b",
});
assert.equal(singleSel.mode, "single");
assert.equal(singleSel.primary?.controllerKey, "a");
assert.equal(singleSel.partner, null);
const compareSel = farmChartLabSelectionFromKeys([a, b], {
  mode: "compare",
  primaryKey: "SP03:1:a",
  partnerKey: "SP03:1:b",
});
assert.equal(compareSel.mode, "compare");
assert.equal(compareSel.partner?.controllerKey, "b");

assert.equal(
  farmChartLabStallKey({
    stallTyCode: "SP03",
    stallNo: "1",
  }),
  "stall:SP03:1",
);
assert.equal(
  controllersShareStall(
    {
      stallTyCode: "SP03",
      stallNo: "1",
    },
    {
      stallTyCode: "SP03",
      stallNo: "1",
    },
  ),
  true,
);
assert.deepEqual(
  uniqueFarmChartLabStalls([a, b]).map((s) => s.controllerKey),
  ["a"],
);

console.log("farm-chart-lab-scope.test.ts: ok");
