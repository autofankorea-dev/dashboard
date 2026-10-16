import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { sheetCopy } from "@/lib/ui/sheet-copy";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

test("alarm and report cards share the sheet example frame", () => {
  const example = read("./tool-card-examples.tsx");
  assert.match(example, /data-tool-example="report"/);
  assert.match(example, /data-tool-example="alarm"/);
  assert.equal(sheetCopy("ko", "report.templateTitle"), "스마트축사 일보");
  assert.equal(sheetCopy("en", "report.templateTitle"), "Daily stall report");
  assert.equal(sheetCopy("en", "tool.example"), "Example");
  assert.equal(sheetCopy("ko", "tool.exampleAlarm"), "온도 주의");

  const panel = read("./account-menu-alarm-panel.tsx");
  assert.equal(panel.includes("headerToolsCard"), false);
  assert.match(panel, /AlarmTemplateExample/);
  assert.match(panel, /"tools.noActive"/);
  assert.match(panel, /"alarm.toPanel"/);
  assert.match(panel, /alarm\.alarmType/);

  const reportButton = read("../layout/daily-report-button.tsx");
  assert.match(reportButton, /ReportTemplateExample/);
  assert.equal(reportButton.includes("headerToolsCard"), false);

  const header = read("../layout/header-tools-menu.tsx");
  assert.match(header, /AccountMenuAlarmPanel/);
});

test("sheet previews keep the width of the component they stand in for", () => {
  const widths = [
    accountMenuLayout.previewCard,
    accountMenuLayout.previewAlarm,
    accountMenuLayout.previewReport,
    accountMenuLayout.previewAddress,
  ];
  assert.equal(new Set(widths).size, widths.length);

  const examples = read("./account-settings-examples.tsx");
  assert.match(examples, /data-settings-example="controller"/);
  assert.match(examples, /previewCard/);
  assert.match(examples, /previewAddress/);
  const tools = read("./tool-card-examples.tsx");
  assert.match(tools, /previewReport/);
  assert.match(tools, /previewAlarm/);
  const settings = read("./account-settings-card.tsx");
  assert.match(settings, /SettingsControllerPanelExample/);
  assert.match(settings, /previewAddress/);
  assert.match(read("./account-menu-alarm-panel.tsx"), /previewAlarm/);
  assert.match(read("../layout/daily-report-button.tsx"), /previewReport/);
});
