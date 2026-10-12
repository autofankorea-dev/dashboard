/**
 * 실행: node node_modules/tsx/dist/cli.mjs src/lib/farm/unified-trend-split-y.test.ts
 *
 * 알람 구간 안 왕복과 모터 선형, 평탄 이탈 도메인 여유.
 */
import assert from "node:assert/strict";
import { resolveSplitYLayout } from "./unified-barn-trend-layout";
import { fitOverflowValueDomain } from "./unified-trend-split-y-overflow";
import {
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  unmapHumPctFromSplitY,
  unmapMotorPctFromSplitY,
  unmapTempCFromSplitY,
} from "./unified-trend-split-y";

const layout = resolveSplitYLayout({
  showTemp: true,
  showHum: true,
  showMotors: true,
  showCommand: false,
});

function assertRoundTrip(
  value: number,
  map: (v: number) => number | null,
  unmap: (y: number) => number | null,
) {
  const y = map(value);
  assert.ok(y != null && Number.isFinite(y));
  const back = unmap(y);
  assert.ok(back != null && Number.isFinite(back));
  assert.ok(Math.abs(back - value) < 1e-6, `${value} -> ${y} -> ${back}`);
}

const tempLow = 18;
const tempHigh = 28;
for (const value of [tempLow, (tempLow + tempHigh) / 2, tempHigh]) {
  assertRoundTrip(
    value,
    (v) => mapTempCToSplitY(v, tempLow, tempHigh, layout),
    (y) => unmapTempCFromSplitY(y, tempLow, tempHigh, layout),
  );
}

const humLow = 40;
const humHigh = 70;
for (const value of [humLow, (humLow + humHigh) / 2, humHigh]) {
  assertRoundTrip(
    value,
    (v) => mapHumPctToSplitY(v, humLow, humHigh, layout),
    (y) => unmapHumPctFromSplitY(y, humLow, humHigh, layout),
  );
}

assert.equal(mapTempCToSplitY(null, tempLow, tempHigh, layout), null);
assert.equal(mapHumPctToSplitY(undefined, humLow, humHigh, layout), null);
assert.equal(mapMotorPctToSplitY(null, layout), null);

const y0 = mapMotorPctToSplitY(0, layout);
const y50 = mapMotorPctToSplitY(50, layout);
const y100 = mapMotorPctToSplitY(100, layout);
assert.equal(y0, layout.motorLo);
assert.equal(y100, layout.motorHi);
assert.ok(y0 != null && y50 != null && y100 != null);
assert.ok(Math.abs(y50 - (y0 + y100) / 2) < 1e-9);
const back50 = unmapMotorPctFromSplitY(y50, layout);
assert.ok(back50 != null && Math.abs(back50 - 50) < 1e-6);

const flat = 10;
const [lo, hi] = fitOverflowValueDomain(flat, flat);
assert.ok(lo < flat && hi > flat);
assert.ok(Math.abs(flat - lo - (hi - flat)) < 1e-9);

console.log("unified-trend-split-y.test.ts: ok");
