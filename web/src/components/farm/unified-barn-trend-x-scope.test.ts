/**
 * 실행: node node_modules/tsx/dist/cli.mjs src/components/farm/unified-barn-trend-x-scope.test.ts
 */
import assert from "node:assert/strict";
import {
  resolveXScopeRangeMs,
  scopeEntryFromZoomHint,
  xScopeEntryOutOfRange,
} from "./unified-barn-trend-x-scope";
import { buildUnifiedBarnTrendWindow } from "./unified-barn-trend-window";
import { buildUnifiedCommandSettingSegs } from "./unified-barn-trend-command-overlay";
import { DEFAULT_COMMAND_CHANNEL_FLAGS } from "@/lib/farm/command-hold-bands";
import { SPLIT_Y_WITH_HUM } from "@/lib/farm/unified-barn-trend-layout";

assert.equal(
  xScopeEntryOutOfRange(10, { start: 0, end: 4 }),
  false,
);
assert.equal(
  xScopeEntryOutOfRange(10, { start: 8, end: 9 }),
  true,
);
assert.equal(xScopeEntryOutOfRange(1, { start: 0, end: 0 }), true);

const fromRatio = scopeEntryFromZoomHint(11, {
  yBands: ["temp", "command"],
  startRatio: 0,
  endRatio: 1,
});
assert.deepEqual(fromRatio, { start: 0, end: 10, yBands: ["temp"] });

const fromIndex = scopeEntryFromZoomHint(11, {
  yBands: [],
  startRatio: 0,
  endRatio: 1,
  startIndex: 3,
  endIndex: 1,
});
assert.deepEqual(fromIndex, { start: 1, end: 3, yBands: null });
assert.equal(
  scopeEntryFromZoomHint(2, {
    yBands: ["temp"],
    startRatio: 0,
    endRatio: 1,
  }),
  null,
);

const hour = 3_600_000;
const t0 = Date.parse("2026-10-12T00:00:00.000Z");
const range = resolveXScopeRangeMs({
  overview: false,
  scope: { start: 0, end: 2 },
  categoryCount: 3,
  bucketAts: [0, 1, 2].map((i) => new Date(t0 + i * hour).toISOString()),
});
assert.ok(range);
assert.equal(range.fromMs, t0);
assert.equal(
  resolveXScopeRangeMs({
    overview: true,
    scope: { start: 0, end: 2 },
    categoryCount: 3,
    bucketAts: ["2026-10-12T00:00:00.000Z"],
  }),
  null,
);

assert.equal(
  buildUnifiedBarnTrendWindow({
    controllers: [],
    controllerTrendByPeriod: null,
    canvasPeriod: "24h",
    useBrushCanvas: false,
    context30d: false,
    brushWindow: { start: 0, width: 1 },
    uplinkCoverage: [],
    overview: false,
    comparisonActive: false,
  }),
  null,
);

assert.deepEqual(
  buildUnifiedCommandSettingSegs({
    showCommandOverlay: false,
    showTempCommandOverlay: false,
    showMotorCommandOverlay: false,
    hasBuilt: true,
    windows: null,
    categories: [],
    tempLow: 18,
    tempHigh: 28,
    tempBandLo: 0,
    tempBandHi: 40,
    layout: SPLIT_Y_WITH_HUM,
    commandChannels: DEFAULT_COMMAND_CHANNEL_FLAGS,
  }),
  [],
);

console.log("unified-barn-trend-x-scope.test.ts ok");
