/**
 * 실행: npx tsx src/lib/farm/shared-command-presets.test.ts
 */
import assert from "node:assert/strict";
import { mergePresetStripItems } from "./shared-command-presets";
import { panelDraftFromCommandDefaults } from "./command-defaults";

const draft = {
  setpointTemp: 25,
  tempDeviation: 2,
  minVentPct: 10,
  maxVentPct: 100,
};

const merged = mergePresetStripItems({
  shared: [{ id: "s1", name: "비육기본", channels: { A: draft } }],
  personal: [{ id: "p1", name: "내칩", channels: { B: draft } }],
});
assert.equal(merged.length, 2);
assert.equal(merged[0]?.source, "shared");
assert.equal(merged[0]?.removable, false);
assert.equal(merged[1]?.source, "personal");
assert.equal(merged[1]?.removable, true);

const fromDb = panelDraftFromCommandDefaults({
  setpoint_temp: "26.0",
  temp_deviation: "1.5",
  min_vent_pct: 15,
  max_vent_pct: 90,
});
assert.equal(fromDb.setpointTemp, 26);
assert.equal(fromDb.tempDeviation, 1.5);
assert.equal(fromDb.minVentPct, 15);
assert.equal(fromDb.maxVentPct, 90);

console.log("shared-command-presets.test.ts ok");
