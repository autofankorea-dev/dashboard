import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { formatStallTypeLabel, formatStallTypeLabelLocalized, STALL_TYPE_NAMES, STALL_TYPE_NAMES_EN } from "@/lib/domain/stall-type";
import { resolveNavMessage } from "@/lib/navigation/nav-messages";
import { parseProfileSheetPrefs } from "@/lib/ui/profile-sheet-prefs";
import { SHEET_COPY, SHEET_COPY_KEYS, sheetCopy, type SheetCopyKey } from "@/lib/ui/sheet-copy";

function readSrc(relFromUi: string): string {
  return readFileSync(new URL(relFromUi, import.meta.url), "utf8");
}

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

const REST_REQUIRED = [
  "tools.alarm",
  "tools.alarmCount",
  "tools.count",
  "tools.ops",
  "tools.opsExit",
  "tools.opsToMonitor",
  "tools.monitorToOps",
  "tools.report",
  "tools.reportPdf",
  "tools.reportNeedFarm",
  "tools.reportNeedFarmHint",
  "tools.reportAfterFarm",
  "tools.reportAfterFarmShort",
  "tools.pdf",
  "tools.autoSuffix",
  "tools.viewportMobileToPc",
  "tools.viewportPcToMobile",
  "tools.connUnknown",
  "tools.connCount",
  "tools.offlineCount",
  "tools.collapse",
  "tools.noActive",
  "tools.alarmList",
  "tools.critical",
  "tools.more",
  "tools.pinnedHint",
  "tools.pinnedShort",
  "tools.toolbar",
  "tools.close",
  "tools.design",
  "tools.function",
  "tools.groupAlarm",
  "tools.theme",
  "tools.help",
  "view.tabs",
  "view.field",
  "view.chart",
  "view.grid",
  "view.list",
  "field.showAll",
  "field.showAllAria",
  "field.show",
  "field.hide",
  "field.waiting",
  "account.menu",
  "account.close",
  "account.user",
  "account.noRole",
  "account.admin",
  "account.operator",
  "account.viewer",
  "account.national",
  "account.alert",
  "account.offline",
  "account.recent",
  "account.recentEmpty",
  "account.openFarm",
  "account.ack",
  "account.working",
  "account.ackAll",
  "account.ackNamed",
  "account.toolsMenu",
  "account.editDone",
  "account.editTools",
  "account.returnHeader",
  "account.tools",
  "account.lightMode",
  "account.darkMode",
  "account.returnTool",
  "account.pinHint",
  "nav.page",
  "nav.controllers",
  "nav.monitoring",
  "nav.pending",
  "nav.opsUsers",
  "nav.opsFarms",
  "nav.opsCommands",
  "nav.opsPresets",
  "nav.opsSystem",
  "nav.health",
  "nav.users",
  "nav.admin",
  "nav.ops",
  "nav.farm",
  "nav.farmSwitch",
  "nav.switching",
  "nav.farmSwitchAria",
  "nav.chartFarm",
  "nav.chart",
  "nav.panelPlace",
  "nav.refresh",
  "nav.refreshLabel",
  "nav.home",
  "nav.refreshShort",
  "nav.controller",
  "report.building",
  "report.collecting",
  "report.composing",
  "report.done",
  "report.failed",
  "report.noBarns",
  "report.noFarm",
  "cover.lastReceived",
  "cover.lastReceivedUnknown",
  "slot.stallEq",
  "slot.controllerNo",
  "slot.controllerIdx",
  "slot.controller",
  "slot.line",
  "alarm.module",
  "chart.farmAll",
  "chart.stallUnknown",
  "chart.stallNo",
  "chart.scopeController",
  "chart.scopeControllerPlain",
  "chart.noController",
  "chart.viewStalls",
  "chart.viewControllers",
  "chart.viewGraph",
  "chart.stallGraphs",
  "chart.stallHeading",
  "chart.controllerGraphs",
  "chart.controllerHeading",
  "chart.compareCount",
  "chart.compareClear",
  "chart.comparePick",
  "chart.compareSelect",
  "chart.compare",
  "chart.miniList",
  "chart.compareTitle",
  "chart.singleGraph",
  "chart.changeCompare",
  "chart.pickCompare",
  "chart.loadingDetail",
  "chart.loadingRecent",
  "chart.loading",
  "chart.pickLayers",
  "chart.pickControllers",
  "chart.loadFailed",
  "chart.empty",
  "chart.close",
  "list.flatView",
  "list.groupView",
  "list.switching",
  "login.id",
  "login.password",
  "login.submit",
  "login.submitting",
  "login.badCredentials",
  "login.missing",
  "login.failed",
  "login.or",
  "login.google",
  "login.kakao",
  "login.googleBlocked",
  "login.connectionFailed",
  "login.openWindow",
  "login.embeddedNote",
  "tour.skip",
  "tour.back",
  "tour.next",
  "tour.done",
  "tour.close",
  "tour.label",
] as const satisfies readonly SheetCopyKey[];

test("sheet copy keeps the remaining dashboard keys in both languages", () => {
  for (const key of REST_REQUIRED) {
    assert.ok(SHEET_COPY_KEYS.includes(key), key);
    assert.ok(SHEET_COPY[key].ko.length > 0, key);
    assert.ok(SHEET_COPY[key].en.length > 0, key);
  }
  for (const key of REQUIRED) {
    assert.ok(SHEET_COPY_KEYS.includes(key), key);
  }
  assert.equal(sheetCopy("ko", "tools.alarm"), "이상상황");
  assert.equal(sheetCopy("en", "tools.alarm"), "Alarms");
  assert.equal(sheetCopy("en", "tools.report"), "Today's report");
  assert.equal(sheetCopy("ko", "tools.ops"), "운영");
  assert.equal(
    sheetCopy("ko", "tools.viewportPcToMobile", { auto: " (자동)" }),
    "PC 레이아웃 (자동) → 모바일",
  );
  assert.equal(
    sheetCopy("en", "tools.viewportMobileToPc", { auto: "" }),
    "Mobile layout → PC",
  );
  assert.equal(sheetCopy("ko", "account.recentEmpty"), "최근 수신 데이터가 없습니다.");
  assert.equal(sheetCopy("en", "account.ackNamed", { type: "온도 상한" }), "Confirm 온도 상한");
  assert.equal(sheetCopy("ko", "nav.panelPlace", { place: "1-2" }), "1-2 패널로 이동 중…");
  assert.equal(resolveNavMessage("/farm").message, "모니터링으로 이동 중…");
  assert.equal(resolveNavMessage("/farm", { locale: "en" }).message, "Opening monitoring…");
  assert.equal(resolveNavMessage("/admin/ops", { locale: "en" }).message, "Opening ops · system…");
  assert.equal(
    resolveNavMessage("/farm", { message: "stay", locale: "en" }).message,
    "stay",
  );

  const header = readSrc("../../components/layout/header-tools-menu.tsx");
  for (const key of [
    "tools.alarm",
    "tools.report",
    "tools.ops",
    "tools.viewportMobileToPc",
    "tools.viewportPcToMobile",
    "nav.monitoring",
    "nav.ops",
  ] as const) {
    assert.ok(header.includes(`"${key}"`), key);
  }
  assert.match(header, /AccountMenuAlarmPanel/);

  const alarm = readSrc("../../components/account/account-menu-alarm-panel.tsx");
  for (const key of ["tools.noActive", "nav.chart", "nav.chartFarm", "alarm.toPanel"] as const) {
    assert.ok(alarm.includes(`"${key}"`), key);
  }
  assert.match(alarm, /alarm\.alarmType/);

  const recent = readSrc("../../components/account/recent-activity-menu-section.tsx");
  assert.ok(recent.includes('"account.recentEmpty"'));
  assert.ok(recent.includes('"account.recent"'));

  const nav = readSrc("../../lib/navigation/nav-messages.ts");
  assert.ok(nav.includes('"nav.monitoring"'));
  assert.ok(nav.includes('"nav.page"'));

  const view = readSrc("../../components/farm/farm-view-toggle.tsx");
  assert.ok(view.includes('"view.field"'));
  assert.ok(view.includes('"view.chart"'));
  const field = readSrc("../../components/farm/farm-field-status-grid.tsx");
  assert.ok(field.includes('"field.showAll"'));
  assert.ok(field.includes('"field.waiting"'));
  const help = readSrc("../../components/layout/feature-tour-help-button.tsx");
  assert.ok(help.includes('"tools.help"'));

  const pdf = readSrc("../../lib/report/build-daily-report-pdf.ts");
  assert.match(pdf, /다운로드 완료/);
  assert.equal(pdf.includes("sheetCopy"), false);
});

const SETTINGS_REQUIRED = [
  "bulk.clear",
  "bulk.enterSettings",
  "bulk.fieldCommand",
  "bulk.apply",
  "bulk.nothingChanged",
  "settings.editorTitle",
  "settings.setpoint",
  "settings.deviation",
  "settings.minVent",
  "settings.maxVent",
  "settings.lowAlarm",
  "settings.highAlarm",
  "settings.defaults",
  "settings.noChanges",
  "settings.close",
  "settings.glanceSet",
  "settings.vent",
  "confirm.title",
  "confirm.cancel",
  "confirm.send",
  "list.unitCount",
  "list.empty",
] as const satisfies readonly SheetCopyKey[];

test("english settings and bulk apply copy stays paired", () => {
  for (const key of SETTINGS_REQUIRED) {
    assert.ok(SHEET_COPY[key].ko.length > 0, key);
    assert.ok(SHEET_COPY[key].en.length > 0, key);
  }
  assert.equal(sheetCopy("ko", "bulk.clear"), "선택해제");
  assert.equal(sheetCopy("en", "bulk.clear"), "Clear");
  assert.equal(sheetCopy("ko", "bulk.enterSettings"), "설정입력");
  assert.equal(sheetCopy("en", "bulk.enterSettings"), "Enter settings");
  assert.equal(sheetCopy("en", "settings.editorTitle"), "Channel and alarm settings");
  assert.equal(sheetCopy("en", "settings.noChanges"), "No command changes.");
  assert.equal(sheetCopy("en", "bulk.fieldCommand"), "Field commands");
  assert.equal(sheetCopy("ko", "settings.defaults"), "기본값");

  const bulk = readSrc("../../components/farm/farm-map-bulk-apply.tsx");
  for (const key of ["bulk.clear", "bulk.enterSettings", "bulk.title", "bulk.fieldCommand"] as const) {
    assert.ok(bulk.includes(`"${key}"`), key);
  }
  const table = readSrc("../../components/farm/unified-settings-table.tsx");
  assert.ok(table.includes('"settings.setpoint"'));
  assert.ok(table.includes('"settings.lowAlarm"'));
  const glance = readSrc("../../components/farm/settings-glance-strip.tsx");
  assert.ok(glance.includes('"bulk.fieldCommand"'));
  assert.ok(glance.includes('"settings.glanceSet"'));
  const summary = readSrc("../../components/farm/barn-list-summary.tsx");
  assert.ok(summary.includes("formatStallTypeLabelLocalized"));
  const panel = readSrc("../../components/farm/barn-list-accordion-panel.tsx");
  assert.ok(panel.includes('"settings.editorTitle"'));
  assert.ok(panel.includes('"settings.defaults"'));
});

test("missing profile prefs stay on number, cover on, and Korean", () => {
  assert.deepEqual(parseProfileSheetPrefs(undefined), {
    motorDisplay: "number",
    motorFocus: "fan",
    envCover: true,
    locale: "ko",
  });
  assert.deepEqual(
    parseProfileSheetPrefs({ motorDisplay: "bar", motorFocus: "setpoint", envCover: false, locale: "en" }),
    { motorDisplay: "bar", motorFocus: "setpoint", envCover: false, locale: "en" },
  );
  assert.equal(parseProfileSheetPrefs({ motorDisplay: "other", motorFocus: "other", locale: "fr" }).motorDisplay, "number");
  assert.equal(parseProfileSheetPrefs({ motorFocus: "other" }).motorFocus, "fan");
  assert.equal(parseProfileSheetPrefs({ locale: "fr" }).locale, "ko");
});
