/**
 * 실행: npx tsx src/lib/data/controller-key.test.ts
 */
import assert from "node:assert/strict";
import { normalizeEqpmnNo } from "./controller-key";
import {
  formatControllerHeaderSecondary,
  formatControllerNoLabel,
} from "@/lib/farm/controller-summary-display";

assert.equal(normalizeEqpmnNo(1), "01");
assert.equal(normalizeEqpmnNo("01"), "01");
assert.equal(normalizeEqpmnNo(10), "10");
assert.equal(normalizeEqpmnNo(11), "11");
assert.equal(normalizeEqpmnNo("12"), "12");
assert.equal(normalizeEqpmnNo(99), "99");
assert.equal(normalizeEqpmnNo(0), "01");
assert.equal(normalizeEqpmnNo(100), "01");
assert.equal(normalizeEqpmnNo("abc"), "01");

assert.equal(formatControllerNoLabel("11"), "11번");
assert.equal(
  formatControllerHeaderSecondary({ eqpmnNo: "12" }),
  "컨트롤러 12",
);

console.log("controller-key.test.ts: ok");
