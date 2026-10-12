import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/cover-reveal-morph.test.ts
 */
import assert from "node:assert/strict";
import { flipInvert, unionRect } from "./cover-reveal-morph";

{
  const first = { left: 10, top: 20, width: 200, height: 40 };
  const last = { left: 10, top: 80, width: 100, height: 20 };
  const flip = flipInvert(first, last);
  assert.equal(flip.x, 0);
  assert.equal(flip.y, -60);
  assert.equal(flip.sx, 2);
  assert.equal(flip.sy, 2);
}

{
  const a = { left: 0, top: 0, width: 80, height: 20 };
  const b = { left: 0, top: 24, width: 120, height: 16 };
  const u = unionRect(a, b);
  assert.equal(u.left, 0);
  assert.equal(u.top, 0);
  assert.equal(u.width, 120);
  assert.equal(u.height, 40);
}

console.log("cover-reveal-morph.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
