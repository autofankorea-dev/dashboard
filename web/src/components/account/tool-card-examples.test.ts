import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
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
