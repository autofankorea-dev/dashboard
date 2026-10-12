import { test } from "vitest";
import assert from "node:assert/strict";
import {
  clampMenuValue,
  snapToStep,
} from "@/lib/controllers/controller-panel-map";
import { formatTrendBandEdge } from "@/lib/farm/trend-chart-format";

// snapToStep: 0.1 격자에서 FP 꼬리 제거
assert.equal(snapToStep(26.200000000000003, 0.1), 26.2);
assert.equal(snapToStep(Math.round(26.2 / 0.1) * 0.1, 0.1), 26.2);
assert.equal(snapToStep(24.5, 0.1), 24.5);
assert.equal(snapToStep(70, 1), 70);
assert.equal(snapToStep(73, 5, 0), 75);

// clampMenuValue: 설정온도·편차 0.1
assert.equal(clampMenuValue("setpoint", 24.55), 24.6);
assert.equal(clampMenuValue("setpoint", -0.1), 0);
assert.equal(clampMenuValue("setpoint", 30.1), 30);
assert.equal(clampMenuValue("deviation", 3.54), 3.5);
assert.equal(clampMenuValue("minVent", 11.4), 11);

// 차트 라벨 포맷
assert.equal(formatTrendBandEdge(26.200000000000003, "℃"), "26.2℃");
assert.equal(formatTrendBandEdge(22, "℃"), "22℃");
assert.equal(formatTrendBandEdge(65, "%"), "65%");

console.log("controller-panel-map snap/format: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
