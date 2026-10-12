import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/farm-crosshair-readout.test.ts
 */
import assert from "node:assert/strict";
import { invertSplitYCrosshairValues } from "./farm-crosshair-readout";
import {
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  mapTempCToSplitY,
  fitOverflowValueDomain,
  OVERLAY_ALIGN_ANCHOR,
  resolveSplitYLayout,
  SPLIT_Y_WITH_HUM,
} from "./unified-barn-trend-series";
import {
  SPLIT_Y_BAND_GAP,
  type SplitYVisibility,
} from "./unified-barn-trend-layout";

const ALL_PLOT: SplitYVisibility = {
  showTemp: true,
  showHum: true,
  showMotors: true,
  showCommand: false,
};

const THRESH = {
  tempLow: 20,
  tempHigh: 28,
  humidityLow: 50,
  humidityHigh: 70,
};

{
  const yTemp = mapTempCToSplitY(24.6, 20, 28, SPLIT_Y_WITH_HUM);
  assert.ok(yTemp != null);
  const inv = invertSplitYCrosshairValues(yTemp, {
    layout: SPLIT_Y_WITH_HUM,
    visibility: ALL_PLOT,
    overlay: false,
    ...THRESH,
  });
  assert.ok(inv.tempC != null && Math.abs(inv.tempC - 24.6) < 0.05);
  assert.equal(inv.humidityPct, null);
  assert.equal(inv.motorPct, null);
}

{
  const yHum = mapHumPctToSplitY(58, 50, 70, SPLIT_Y_WITH_HUM);
  assert.ok(yHum != null);
  const inv = invertSplitYCrosshairValues(yHum, {
    layout: SPLIT_Y_WITH_HUM,
    visibility: ALL_PLOT,
    overlay: false,
    ...THRESH,
  });
  assert.equal(inv.tempC, null);
  assert.ok(inv.humidityPct != null && Math.abs(inv.humidityPct - 58) < 0.05);
  assert.equal(inv.motorPct, null);
}

{
  const yMotor = mapMotorPctToSplitY(40, SPLIT_Y_WITH_HUM);
  assert.ok(yMotor != null);
  const inv = invertSplitYCrosshairValues(yMotor, {
    layout: SPLIT_Y_WITH_HUM,
    visibility: ALL_PLOT,
    overlay: false,
    ...THRESH,
  });
  assert.equal(inv.tempC, null);
  assert.equal(inv.humidityPct, null);
  assert.ok(inv.motorPct != null && Math.abs(inv.motorPct - 40) < 0.05);
}

{
  const overlayLayout = resolveSplitYLayout(ALL_PLOT, true);
  const y = mapTempCToSplitY(
    24.6,
    20,
    28,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  assert.ok(y != null);
  const inv = invertSplitYCrosshairValues(y, {
    layout: overlayLayout,
    visibility: ALL_PLOT,
    overlay: true,
    overlayAlign: OVERLAY_ALIGN_ANCHOR,
    ...THRESH,
  });
  assert.ok(inv.tempC != null && Math.abs(inv.tempC - 24.6) < 0.08);
  assert.ok(inv.humidityPct != null);
  assert.equal(inv.motorPct, null);

  const yMotor = mapMotorPctToSplitY(40, overlayLayout);
  assert.ok(yMotor != null);
  const invMotor = invertSplitYCrosshairValues(yMotor, {
    layout: overlayLayout,
    visibility: ALL_PLOT,
    overlay: true,
    overlayAlign: OVERLAY_ALIGN_ANCHOR,
    ...THRESH,
  });
  assert.equal(invMotor.tempC, null);
  assert.equal(invMotor.humidityPct, null);
  assert.ok(
    invMotor.motorPct != null && Math.abs(invMotor.motorPct - 40) < 0.05,
  );
}

{
  const gapY = SPLIT_Y_WITH_HUM.humHi + SPLIT_Y_BAND_GAP / 2;
  assert.ok(gapY > SPLIT_Y_WITH_HUM.humHi && gapY < SPLIT_Y_WITH_HUM.tempLo);
  const inv = invertSplitYCrosshairValues(gapY, {
    layout: SPLIT_Y_WITH_HUM,
    visibility: ALL_PLOT,
    overlay: false,
    ...THRESH,
  });
  assert.deepEqual(inv, { tempC: null, humidityPct: null, motorPct: null });
}

{
  const inv = invertSplitYCrosshairValues(-8, {
    layout: SPLIT_Y_WITH_HUM,
    visibility: { ...ALL_PLOT, showCommand: true },
    overlay: false,
    ...THRESH,
  });
  assert.deepEqual(inv, { tempC: null, humidityPct: null, motorPct: null });
}

{
  const rec = {
    tempLow: 15,
    tempHigh: 20,
    humidityLow: 50,
    humidityHigh: 70,
  };
  const fit = fitOverflowValueDomain(24.6, 25.4);
  const layout = resolveSplitYLayout(ALL_PLOT);
  const y = mapTempCToSplitY(
    25.0,
    rec.tempLow,
    rec.tempHigh,
    layout,
    [13, fit[1]],
    undefined,
    fit,
  );
  assert.ok(y != null);
  const inv = invertSplitYCrosshairValues(y, {
    layout,
    visibility: ALL_PLOT,
    overlay: false,
    ...rec,
    tempDomain: [13, fit[1]],
    tempOverflowDomain: fit,
  });
  assert.ok(inv.tempC != null && Math.abs(inv.tempC - 25) < 0.08);
  assert.equal(inv.humidityPct, null);
}

{
  const rec = {
    tempLow: 15,
    tempHigh: 20,
    humidityLow: 50,
    humidityHigh: 70,
  };
  const overlayLayout = resolveSplitYLayout(ALL_PLOT, true);
  const fit = fitOverflowValueDomain(24.6, 25.4);
  const y = mapTempCToSplitY(
    25.0,
    rec.tempLow,
    rec.tempHigh,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
    fit,
  );
  assert.ok(y != null);
  const inv = invertSplitYCrosshairValues(y, {
    layout: overlayLayout,
    visibility: ALL_PLOT,
    overlay: true,
    overlayAlign: OVERLAY_ALIGN_ANCHOR,
    ...rec,
    tempOverflowDomain: fit,
  });
  assert.ok(inv.tempC != null && Math.abs(inv.tempC - 25) < 0.08);
  assert.equal(inv.humidityPct, null);
  assert.equal(inv.motorPct, null);
}

console.log("farm-crosshair-readout.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
