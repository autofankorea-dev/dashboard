import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/geo/geocode-query.test.ts
 */
import assert from "node:assert/strict";
import {
  geocodeQueryFallbacks,
  locationAddressQuery,
  kakaoAddressQueries,
  isStreetLevelAddress,
} from "./geocode-query";

{
  const q = geocodeQueryFallbacks("경기도 포천시 일동면 성장로 950-102");
  assert.deepEqual(q, [
    "경기도 포천시 일동면 성장로 950-102",
    "경기도 포천시 일동면 성장로",
    "경기도 포천시 일동면",
  ]);
}

{
  const q = kakaoAddressQueries("경기도 포천시 일동면 성장로 950-102");
  assert.equal(q[0], "경기도 포천시 일동면 성장로 950-102");
  assert.ok(q.includes("경기도 포천시 성장로 950-102"));
  assert.ok(q.includes("포천시 성장로 950-102"));
  assert.ok(isStreetLevelAddress("경기도 포천시 일동면 성장로 950-102"));
  assert.equal(isStreetLevelAddress("경기도 포천시 일동면"), false);
}

{
  const q = locationAddressQuery({
    addressText: "경기도 포천시",
    sido: "경기도",
    sigungu: "포천시",
    addressDetail: "일동면 성장로 950-102",
  });
  assert.equal(q, "경기도 포천시 일동면 성장로 950-102");
}

console.log("geocode-query.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
