import { test } from "vitest";
/**
 * 실행: npx vitest run src/components/farm/unified-barn-trend-scoped.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/domain/alarms";
import { SPLIT_Y_WITH_HUM } from "@/lib/farm/unified-barn-trend-layout";
import { DEFAULT_UNIFIED_LAYERS } from "@/lib/farm/unified-barn-trend-series";
import { rebuildScopedUnifiedBarnTrend } from "./unified-barn-trend-scoped";

const picked = {
  categories: ["a", "b", "c", "d", "e"],
  series: [],
  envelopes: [],
  histograms: [],
  tempDomain: [10, 30] as [number, number],
  tempOverflowDomain: null,
};

const base = {
  xScopeRangeMs: null,
  window15m: null,
  deferredWindowBundle: null,
  controllers: [],
  uplinkCoverage: [],
  plotThresholds: DEFAULT_ALARM_THRESHOLDS,
  layout: SPLIT_Y_WITH_HUM,
  layers: DEFAULT_UNIFIED_LAYERS,
  plotWidthPx: 640,
  chartScopeLevel: "farm" as const,
  trendRaw: null,
  overlayAlign: undefined,
  comparisonActive: false,
};

assert.equal(
  rebuildScopedUnifiedBarnTrend({ ...base, picked: null, xScope: null }),
  null,
);

const open = rebuildScopedUnifiedBarnTrend({
  ...base,
  picked,
  xScope: null,
});
assert.deepEqual(open?.categories, picked.categories);
assert.equal(open?.thermoWindows, null);

const sliced = rebuildScopedUnifiedBarnTrend({
  ...base,
  picked,
  xScope: { start: 1, end: 3, yBands: null },
});
assert.deepEqual(sliced?.categories, ["b", "c", "d"]);
assert.deepEqual(sliced?.tempDomain, [10, 30]);

console.log("unified-barn-trend-scoped.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
