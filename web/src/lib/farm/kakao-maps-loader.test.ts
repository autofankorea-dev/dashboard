import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/kakao-maps-loader.test.ts
 */
import assert from "node:assert/strict";
import { leafletZoomToKakaoLevel } from "./kakao-maps-loader";

assert.equal(leafletZoomToKakaoLevel(18), 1);
assert.equal(leafletZoomToKakaoLevel(17), 2);
assert.equal(leafletZoomToKakaoLevel(13), 6);
assert.equal(leafletZoomToKakaoLevel(5), 14);

console.log("kakao-maps-loader.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
