import { test } from "vitest";
import assert from "node:assert/strict";
import {
  computeStackMetricRows,
  worstSingleStackMetric,
  worstStackMetricSev,
} from "./stack-metric";

const hotPastCoolNow = {
  id: "T",
  label: "온도",
  unit: "℃",
  values: [40, 40, 40, 22],
  band: { lo: 10, hi: 30 },
};

const rows = computeStackMetricRows([hotPastCoolNow]);
assert.equal(rows.length, 1);
assert.deepEqual(rows[0]!.sevs.slice(0, -1), ["neutral", "neutral", "neutral"]);
assert.equal(rows[0]!.sevs.at(-1), "normal");
assert.equal(worstStackMetricSev(rows), "normal");

const hotNow = {
  ...hotPastCoolNow,
  values: [22, 22, 22, 40],
};
const rowsHot = computeStackMetricRows([hotNow]);
assert.deepEqual(rowsHot[0]!.sevs.slice(0, -1), ["neutral", "neutral", "neutral"]);
assert.equal(rowsHot[0]!.sevs.at(-1), "warning");
assert.equal(worstStackMetricSev(rowsHot), "warning");
assert.equal(worstSingleStackMetric(hotNow), "warning");
assert.equal(worstSingleStackMetric(hotPastCoolNow), "normal");

/** bars 집계 후에도 맨 오른쪽만 채점 */
const many = {
  id: "T",
  label: "온도",
  values: Array.from({ length: 8 }, (_, i) => (i < 6 ? 40 : 22)),
  band: { lo: 10, hi: 30 },
};
const binned = computeStackMetricRows([many], 4);
assert.ok(binned[0]!.sevs.length <= 4);
assert.ok(binned[0]!.sevs.slice(0, -1).every((s) => s === "neutral"));
assert.equal(binned[0]!.sevs.at(-1), "normal");

console.log("stack-metric latest-only severity: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
