import assert from "node:assert/strict";
import { test } from "vitest";
import { formatStallTypeLabel, formatStallTypeLabelLocalized, STALL_TYPE_NAMES, STALL_TYPE_NAMES_EN } from "@/lib/domain/stall-type";
import { parseProfileSheetPrefs } from "@/lib/ui/profile-sheet-prefs";
import { SHEET_COPY, SHEET_COPY_KEYS, sheetCopy } from "@/lib/ui/sheet-copy";

const REQUIRED = [
  "header.logout",
  "header.farmSelect",
  "farm.all",
  "farm.live",
  "farm.locationOnly",
  "cover.stallType",
  "cover.channel1",
  "cover.channel2",
  "cover.channel3",
  "cover.ok",
  "cover.caution",
  "cover.warning",
  "cover.down",
  "chart.temp",
  "chart.humidity",
  "settings.screen",
  "settings.motor",
  "settings.cover",
  "settings.language",
  "settings.address",
  "list.controller",
  "list.settings",
  "list.bulk",
  "list.bulkStart",
  "list.bulkStop",
  "cover.detail",
  "panel.chart",
  "panel.toSettings",
  "chart.motor",
] as const;

test("sheet copy keeps the six surfaces' keys in both languages", () => {
  for (const key of REQUIRED) {
    assert.ok(SHEET_COPY_KEYS.includes(key), key);
    assert.ok(SHEET_COPY[key].ko.length > 0);
    assert.ok(SHEET_COPY[key].en.length > 0);
  }
  assert.equal(sheetCopy("en", "farm.all", { count: 3 }), "All 3 farms");
  assert.equal(sheetCopy("ko", "header.logout"), "로그아웃");
  assert.equal(formatStallTypeLabel("SP07"), "비육사");
  assert.equal(formatStallTypeLabelLocalized("SP07", "ko"), "비육사");
  assert.equal(formatStallTypeLabelLocalized("SP07", "en"), "Finisher");
  for (const code of Object.keys(STALL_TYPE_NAMES)) {
    assert.ok(STALL_TYPE_NAMES_EN[code], code);
  }
});

test("missing profile prefs stay on number, cover on, and Korean", () => {
  assert.deepEqual(parseProfileSheetPrefs(undefined), {
    motorDisplay: "number",
    envCover: true,
    locale: "ko",
  });
  assert.deepEqual(
    parseProfileSheetPrefs({ motorDisplay: "bar", envCover: false, locale: "en" }),
    { motorDisplay: "bar", envCover: false, locale: "en" },
  );
  assert.equal(parseProfileSheetPrefs({ motorDisplay: "other", locale: "fr" }).motorDisplay, "number");
  assert.equal(parseProfileSheetPrefs({ locale: "fr" }).locale, "ko");
});
