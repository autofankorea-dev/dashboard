import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/domain/profile-ui-retired.test.ts
 */
import assert from "node:assert/strict";
import { omitRetiredProfileUiConfigKeys } from "./profile-ui-retired";

{
  const out = omitRetiredProfileUiConfigKeys({
    barns: [],
    displaySettings: { "farm.map": true },
    piggyPlayerId: "x",
    barnAliases: {},
    barnLayouts: { a: { col: 1, row: 2 } },
    alarmSettings: { global: {} },
    onboarding: { tourVersion: 1 },
    controllers: [{ displayName: "A" }],
  });
  assert.equal("barns" in out, false);
  assert.equal("displaySettings" in out, false);
  assert.equal("piggyPlayerId" in out, false);
  assert.equal("barnAliases" in out, false);
  assert.deepEqual(out.barnLayouts, { a: { col: 1, row: 2 } });
  assert.deepEqual(out.alarmSettings, { global: {} });
  assert.deepEqual(out.onboarding, { tourVersion: 1 });
  assert.equal((out.controllers as unknown[]).length, 1);
}

{
  const out = omitRetiredProfileUiConfigKeys({
    barnAliases: { "farm-1-SP02": "남쪽" },
  });
  assert.equal(out.barnAliases && typeof out.barnAliases === "object", true);
}

console.log("profile-ui-retired.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
