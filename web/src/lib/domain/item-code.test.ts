import assert from "node:assert/strict";
import { test } from "vitest";
import { getItemCodeName, getItemCodeNameLocalized } from "@/lib/domain/item-code";
import { farmShortLabel } from "@/lib/domain/farm-summaries";
import { healthStatusLabel } from "@/lib/admin/health/health-locale";

test("swine item code stays Korean by default and becomes Swine in English", () => {
  assert.equal(getItemCodeName("P00"), "양돈");
  assert.equal(getItemCodeNameLocalized("P", "ko"), "양돈");
  assert.equal(getItemCodeNameLocalized("P00", "en"), "Swine");
  assert.equal(getItemCodeNameLocalized("W01", "en"), "Dairy");
  assert.equal(
    farmShortLabel({ lsindRegistNo: "123456", itemCode: "P00" }, "en"),
    "123456 · Swine",
  );
  assert.equal(healthStatusLabel("ok", "ko"), "정상");
  assert.equal(healthStatusLabel("critical", "en"), "Fault");
});
