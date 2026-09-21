/**
 * 실행: npx tsx src/lib/data/alarm-baseline.test.ts
 */
import assert from "node:assert/strict";
import {
  ALARM_HUM_BOUNDS,
  ALARM_TEMP_BOUNDS,
  alarmBaselineFromRange,
  alarmRangeFromBaseline,
  alarmScaleEdgeKind,
  applyAlarmScaleEdgeCommit,
  formatAlarmBaselineSummary,
  formatAlarmGlanceCells,
} from "./alarm-baseline";

{
  const { baseline, deviation } = alarmBaselineFromRange(23, 27);
  assert.equal(baseline, 25);
  assert.equal(deviation, 2);
}

{
  const range = alarmRangeFromBaseline(25, 2, ALARM_TEMP_BOUNDS);
  assert.equal(range.lo, 23);
  assert.equal(range.hi, 27);
}

{
  const clamped = alarmRangeFromBaseline(25, 40, ALARM_TEMP_BOUNDS);
  assert.equal(clamped.lo, 15);
  assert.equal(clamped.hi, 35);
}

{
  const hum = alarmRangeFromBaseline(60, 5, ALARM_HUM_BOUNDS);
  assert.equal(hum.lo, 55);
  assert.equal(hum.hi, 65);
}

{
  assert.equal(alarmScaleEdgeKind("temp-farm-mid"), "temp-baseline");
  assert.equal(alarmScaleEdgeKind("temp-farm-hi"), "temp-deviation");
  assert.equal(alarmScaleEdgeKind("band-tick-hum-mid"), "hum-baseline");
  assert.equal(alarmScaleEdgeKind("temp-hi"), "temp-deviation");
  assert.equal(alarmScaleEdgeKind("motor-mid"), null);
}

{
  const current = {
    tempLow: 23,
    tempHigh: 27,
    humidityLow: 55,
    humidityHigh: 65,
  };
  const shifted = applyAlarmScaleEdgeCommit(current, "temp-farm-mid", 26);
  assert.deepEqual(shifted, {
    tempLow: 24,
    tempHigh: 28,
    humidityLow: 55,
    humidityHigh: 65,
  });
  const widened = applyAlarmScaleEdgeCommit(current, "temp-farm-hi", 29);
  assert.deepEqual(widened, {
    tempLow: 21,
    tempHigh: 29,
    humidityLow: 55,
    humidityHigh: 65,
  });
  const humMid = applyAlarmScaleEdgeCommit(current, "hum-farm-mid", 58);
  assert.deepEqual(humMid, {
    tempLow: 23,
    tempHigh: 27,
    humidityLow: 53,
    humidityHigh: 63,
  });
}

{
  assert.equal(
    formatAlarmBaselineSummary({
      tempLow: 23,
      tempHigh: 27,
      humidityLow: 55,
      humidityHigh: 65,
    }),
    "온도 25℃ ±2℃ · 습도 60% ±5%",
  );
}

{
  const cells = formatAlarmGlanceCells({
    tempLow: 16,
    tempHigh: 19,
    humidityLow: 42,
    humidityHigh: 58,
  });
  assert.equal(cells.temp, "17.5");
  assert.equal(cells.tempDev, "±1.5");
  assert.equal(cells.humidity, "50±8");
}

console.log("alarm-baseline.test.ts: ok");
