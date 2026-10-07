import assert from "node:assert/strict";
import { sensorValueForDisplay, formatSensorNumber, formatPctForDisplay, formatTempForDisplay, operationPctForDisplay } from "./reading-display";
import { formatHumidityPct, formatTempC, buildFarmSummaries } from "./farm-summaries";
import { fmt } from "@/lib/report/build-daily-report-pdf-base";
import { buildGaugeFillSegments } from "@/lib/farm/controller-summary-display";
import type { BarnReading } from "./iot";
for (const value of [NaN, Infinity, -Infinity, null, undefined]) {
  assert.equal(sensorValueForDisplay("normal", value), null);
  assert.equal(formatSensorNumber(value), null);
  assert.equal(formatPctForDisplay("normal", value), null);
  assert.equal(formatTempForDisplay("normal", value), null);
  assert.equal(fmt(value, 1, "%"), "—");
}
assert.equal(formatHumidityPct(NaN), "—");
assert.equal(formatTempC(Infinity), "—");
assert.equal(formatPctForDisplay("normal", 0), "0%", "zero is a valid measurement");
assert.equal(formatHumidityPct(65), "65.0%");
assert.equal(fmt(65, 1, "%"), "65.0%");
assert.equal(sensorValueForDisplay("offline", 65), null, "existing offline policy unchanged");
assert.equal(operationPctForDisplay({status:"normal", fanSupply:NaN,fanExhaust:50,fanIntake:null}),50);
assert.deepEqual(buildGaugeFillSegments(NaN, 10, 35, false),{span:25,cur:0,rest:25,pct:null});
const reading = { farmKey:{lsindRegistNo:"TEST",itemCode:"P00"},status:"normal",receivedAt:"2026-10-08T00:00:00Z",tempC:24,humidityPct:NaN } as BarnReading;
assert.equal(buildFarmSummaries([reading,{...reading,humidityPct:60}],[])[0]?.avgHumidityPct,60, "missing readings must not corrupt valid averages");
