import { test } from "vitest";
import assert from "node:assert/strict";
import { clipCommandSettingY } from "./decoded-setting-hold";
import { mapMotorPctToSplitY } from "./unified-barn-trend-series";
import { SPLIT_Y_WITH_HUM } from "./unified-barn-trend-layout";

{
  const clipped = clipCommandSettingY(10, 90, 0, 100);
  assert.deepEqual(clipped, { yLo: 10, yHi: 90 });
}

{
  const clipped = clipCommandSettingY(80, 20, 40, 60);
  assert.deepEqual(clipped, { yLo: 40, yHi: 60 });
}

assert.equal(clipCommandSettingY(null, 50, 0, 100), null);
assert.equal(clipCommandSettingY(10, 20, 50, 80), null);

{
  const layout = SPLIT_Y_WITH_HUM;
  const lo = mapMotorPctToSplitY(20, layout);
  const hi = mapMotorPctToSplitY(80, layout);
  const clipped = clipCommandSettingY(lo, hi, layout.motorLo, layout.motorHi);
  assert.ok(clipped);
  assert.ok(clipped.yLo >= layout.motorLo);
  assert.ok(clipped.yHi <= layout.motorHi);
  assert.ok(clipped.yHi > clipped.yLo);
}

console.log("decoded-setting-hold.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
