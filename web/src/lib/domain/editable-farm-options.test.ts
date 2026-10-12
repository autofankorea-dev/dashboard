import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/domain/editable-farm-options.test.ts
 */
import assert from "node:assert/strict";
import { editableFarmOptionsFromKnownFarms } from "./editable-farm-options";
import type { FarmLocationRow } from "./farm-location-shared";

const farmA = { lsindRegistNo: "FARM01", itemCode: "P00" };
const farmB = { lsindRegistNo: "FARM03", itemCode: "P00" };

const locA: FarmLocationRow = {
  farmKey: farmA,
  farmName: "테스트농장",
  sido: "서울특별시",
  sigungu: "금천구",
  addressDetail: "가산디지털2로 1",
  addressText: "서울특별시 금천구 가산디지털2로 1",
  lat: 37.48,
  lng: 126.88,
  geocodeSource: "geocode_api",
  updatedAt: "2026-08-27T00:00:00Z",
  updatedBy: null,
};

const withLocation = editableFarmOptionsFromKnownFarms([farmA], [locA], farmA);
assert.equal(withLocation.length, 1);
assert.equal(withLocation[0]?.location?.addressText, locA.addressText);
assert.equal(withLocation[0]?.hasLiveData, true);

const missingLocation = editableFarmOptionsFromKnownFarms(
  [farmA],
  [],
  farmB,
);
assert.equal(missingLocation.length, 2);
const emptyDraft = missingLocation.find(
  (o) => o.farmKey.lsindRegistNo === farmB.lsindRegistNo,
);
assert.ok(emptyDraft);
assert.equal(emptyDraft.location, null);
assert.equal(emptyDraft.hasLiveData, false);

console.log("editable-farm-options.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
