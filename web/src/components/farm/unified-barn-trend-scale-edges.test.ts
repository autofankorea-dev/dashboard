/**
 * 실행: node node_modules/tsx/dist/cli.mjs src/components/farm/unified-barn-trend-scale-edges.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/domain/alarms";
import {
  DEFAULT_UNIFIED_LAYERS,
  resolveSplitYLayout,
} from "@/lib/farm/unified-barn-trend-series";
import { buildFarmTrendScaleEdges } from "./unified-barn-trend-scale-edges";

const layout = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: false,
  showCommand: false,
});
const available = {
  motors: false,
  motorCh: false,
  temp: true,
  hum: false,
  band: false,
  dev: false,
  ema: false,
  humBand: false,
  humDev: false,
  humEma: false,
  thermo: false,
  thermoMotor: false,
};
const visibility = {
  showTemp: true,
  showHum: false,
  showMotors: false,
  showCommand: false,
};

const empty = buildFarmTrendScaleEdges({
  built: null,
  layers: DEFAULT_UNIFIED_LAYERS,
  plotThresholds: DEFAULT_ALARM_THRESHOLDS,
  mappingThresholds: DEFAULT_ALARM_THRESHOLDS,
  layout,
  scopeVisibility: visibility,
  alarmEditEnabled: false,
  tempMapLayout: layout,
  tempMapOverflow: null,
  chartLeftUnit: "℃",
  overlayActive: false,
  alarmRangeOn: { temp: false, hum: false },
});
assert.deepEqual(empty.scaleEdgeLabels, []);
assert.deepEqual(empty.alarmRangeBands, []);

const edges = buildFarmTrendScaleEdges({
  built: { available },
  layers: DEFAULT_UNIFIED_LAYERS,
  plotThresholds: DEFAULT_ALARM_THRESHOLDS,
  mappingThresholds: DEFAULT_ALARM_THRESHOLDS,
  layout,
  scopeVisibility: visibility,
  alarmEditEnabled: false,
  tempMapLayout: layout,
  tempMapOverflow: null,
  chartLeftUnit: "℃",
  overlayActive: false,
  alarmRangeOn: { temp: true, hum: false },
});
const ids = edges.scaleEdgeLabels.map((label) => label.id);
assert.ok(ids.includes("temp-hi"));
assert.ok(ids.includes("temp-lo"));
assert.ok(ids.includes("temp-farm-mid"));
for (const label of edges.scaleEdgeLabels) {
  assert.equal(Number.isFinite(label.value), true);
}
assert.equal(edges.alarmRangeBands.length, 1);
assert.equal(edges.alarmRangeBands[0]?.id, "temp-farm-range");
assert.ok(edges.alarmRangeBands[0]!.lo < edges.alarmRangeBands[0]!.hi);

console.log("unified-barn-trend-scale-edges.test.ts: ok");
