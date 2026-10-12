import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/ui/pointer-press.test.ts
 */
import assert from "node:assert/strict";
import { isPrimaryPress } from "./pointer-press";

assert.equal(
  isPrimaryPress({ isPrimary: true, pointerType: "touch", button: -1 }),
  true,
  "touch is a press even when button is unset",
);

assert.equal(
  isPrimaryPress({ isPrimary: true, pointerType: "mouse", button: 0 }),
  true,
  "left mouse is a press",
);
assert.equal(
  isPrimaryPress({ isPrimary: true, pointerType: "mouse", button: 2 }),
  false,
  "right mouse is not a press",
);

assert.equal(
  isPrimaryPress({ isPrimary: false, pointerType: "touch", button: 0 }),
  false,
  "second finger is ignored",
);

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
