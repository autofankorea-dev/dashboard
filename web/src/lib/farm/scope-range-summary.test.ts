import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/scope-range-summary.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/domain/alarms";
import {
  alarmBreachRate,
  buildScopeSummaryFromColumns,
  formatBreachPct,
  summarizeNumericWindow,
} from "./scope-range-summary";

{
  const vals = [10, 20, null, 30, 40];
  const win = summarizeNumericWindow(vals, 1, 3);
  assert.ok(win);
  assert.equal(win!.n, 2);
  assert.equal(win!.avg, 25);
  assert.equal(win!.min, 20);
  assert.equal(win!.max, 30);
}

{
  assert.equal(summarizeNumericWindow([], 0, 1), null);
  assert.equal(summarizeNumericWindow([null, null], 0, 1), null);
}

{
  // thresholds temp 10–35
  const vals = [22, 5, 40, 20, null];
  const rate = alarmBreachRate(vals, 0, 4, 10, 35);
  assert.equal(rate, 2 / 4);
}

{
  const summary = buildScopeSummaryFromColumns(
    {
      temp: [22.5, 22.5, 5, 40],
      hum: [60, 60, 60, 60],
      motor: [40, 50, 60, 70],
    },
    0,
    3,
    DEFAULT_ALARM_THRESHOLDS,
    { showTemp: true, showHum: true, showMotors: true, showCommand: true },
  );
  assert.ok(summary);
  assert.equal(summary!.metrics.length, 3);
  const temp = summary!.metrics.find((m) => m.id === "temp")!;
  assert.equal(temp.n, 4);
  assert.equal(temp.breachRate, 2 / 4);
  assert.equal(formatBreachPct(temp.breachRate), "50%");
  const motor = summary!.metrics.find((m) => m.id === "motor")!;
  assert.equal(motor.breachRate, null);
  assert.equal(motor.avg, 55);
}

{
  const onlyTemp = buildScopeSummaryFromColumns(
    { temp: [20, 21], hum: [50, 50], motor: [10, 10] },
    0,
    1,
    DEFAULT_ALARM_THRESHOLDS,
    { showTemp: true, showHum: false, showMotors: false, showCommand: true },
  );
  assert.ok(onlyTemp);
  assert.deepEqual(
    onlyTemp!.metrics.map((m) => m.id),
    ["temp"],
  );
}

console.log("scope-range-summary.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
