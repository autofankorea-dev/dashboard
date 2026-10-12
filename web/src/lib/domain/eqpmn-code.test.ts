import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/domain/eqpmn-code.test.ts
 */
import assert from "node:assert/strict";
import {
  formatChannelEquipmentLabel,
  isValidEqpmnCode,
} from "./eqpmn-code";

assert.equal(isValidEqpmnCode("EC02"), true);
assert.equal(isValidEqpmnCode("ec15"), true);
assert.equal(isValidEqpmnCode(""), false);
assert.equal(isValidEqpmnCode(null), false);
assert.equal(isValidEqpmnCode("A"), false);

assert.equal(formatChannelEquipmentLabel("A", "EC02"), "배기팬");
assert.equal(
  formatChannelEquipmentLabel("A", null),
  "—",
  "슬롯으로 장비코드를 추정하지 않는다",
);

console.log("eqpmn-code.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
