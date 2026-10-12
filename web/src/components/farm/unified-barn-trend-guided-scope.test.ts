import { test } from "vitest";
/**
 * 실행: npx vitest run src/components/farm/unified-barn-trend-guided-scope.test.ts
 */
import assert from "node:assert/strict";
import {
  buildGuidedScopePlayback,
  resolveGuidedScopePlayback,
} from "./unified-barn-trend-guided-scope";

const gesture = {
  token: 3,
  startRatio: 0.2,
  endRatio: 0.6,
  startIndex: 4,
  endIndex: 12,
  durationMs: 900,
};

const swapped = buildGuidedScopePlayback({
  gesture: { ...gesture, yStartRatio: 0.52, yEndRatio: 0.5 },
  leftDomain: [0, 100],
  tempLo: 20,
  tempHi: 80,
});
assert.ok(Math.abs(swapped.base.yStartRatio - 0.47) < 1e-9);
assert.ok(Math.abs(swapped.base.yEndRatio - 0.55) < 1e-9);
assert.equal(swapped.startRatio, 0.2);
assert.equal(swapped.startIndex, 4);

const around = buildGuidedScopePlayback({
  gesture: { ...gesture, yRatio: 0.5 },
  leftDomain: [0, 100],
  tempLo: 20,
  tempHi: 80,
});
assert.equal(around.base.yStartRatio, 0.42);
assert.equal(around.base.yEndRatio, 0.58);

const band = buildGuidedScopePlayback({
  gesture,
  leftDomain: [0, 100],
  tempLo: 20,
  tempHi: 80,
});
assert.ok(Math.abs(band.base.yStartRatio - 0.26) < 1e-9);
assert.ok(Math.abs(band.base.yEndRatio - 0.74) < 1e-9);

const collapsed = buildGuidedScopePlayback({
  gesture,
  leftDomain: [0, 100],
  tempLo: 50,
  tempHi: 50,
});
assert.ok(Math.abs(collapsed.base.yStartRatio - 0.46) < 1e-9);
assert.ok(Math.abs(collapsed.base.yEndRatio - 0.54) < 1e-9);

const resolved = resolveGuidedScopePlayback(band, {
  startRatio: 0.9,
  endRatio: 0.95,
  yStartRatio: 0.3,
  yEndRatio: 0.4,
  durationMs: 400,
});
assert.equal(resolved.startRatio, 0.2);
assert.equal(resolved.endRatio, 0.6);
assert.equal(resolved.yStartRatio, 0.3);
assert.equal(resolved.yEndRatio, 0.4);
assert.equal(resolved.durationMs, 400);
assert.equal(resolved.token, 3);

console.log("unified-barn-trend-guided-scope.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
