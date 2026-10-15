import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { localizeFarmSpeciesLabel } from "@/lib/domain/farm-summaries";
import { TOUR_STEPS } from "@/lib/onboarding/tour-steps";
import { tourStepBody, tourStepBullets, tourStepTitle } from "@/lib/onboarding/tour-copy";
import { formatCommandSummary } from "@/lib/ui/controller-labels";
import { sheetCopy } from "@/lib/ui/sheet-copy";

function readSrc(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

test("account and hub species labels use the same English dictionary", () => {
  assert.equal(localizeFarmSpeciesLabel("123456 · 양돈", "en"), "123456 · Swine");
  assert.equal(localizeFarmSpeciesLabel("123456 · 양돈", "ko"), "123456 · 양돈");
  assert.equal(sheetCopy("en", "account.national"), "All sites");
  assert.equal(sheetCopy("ko", "account.nationalFarms"), "전국 관제 농장");
  const menu = readSrc("../../components/account/account-menu.tsx");
  assert.match(menu, /localizeFarmSpeciesLabel/);
  const hub = readSrc("../../components/farm/admin-hub-control-view.tsx");
  assert.match(hub, /account\.national/);
});

test("preset vent line and command summary follow the sheet dictionary", () => {
  assert.equal(
    sheetCopy("en", "preset.summary", { setpoint: "25.0", dev: "2.0", min: 10, max: 100 }),
    "25.0℃ · ±2.0℃ · Vent 10~100%",
  );
  assert.equal(
    sheetCopy("ko", "preset.summary", { setpoint: "25.0", dev: "2.0", min: 10, max: 100 }),
    "25.0℃ · ±2.0℃ · 환기 10~100%",
  );
  const summary = formatCommandSummary(
    {
      minVentPct: 10,
      maxVentPct: 80,
      setpointTemp: 24,
      tempDeviation: 1,
      channels: [
        {
          channel: "A",
          eqpmnCode: "FAN",
          setpointTemp: 24,
          tempDeviation: 1,
          minVentPct: 10,
          maxVentPct: 80,
        },
      ],
    },
    "en",
  );
  assert.equal(summary, "A: 24℃ +1 · vent 10~80%");
  assert.match(readSrc("../../components/admin/admin-command-presets-panel.tsx"), /preset\.summary/);
  assert.equal(sheetCopy("en", "preset.edit"), "Edit");
  assert.equal(sheetCopy("ko", "preset.deleteThis"), "이 프리셋 삭제");
  assert.match(readSrc("../../components/admin/admin-command-presets-panel.tsx"), /preset\.deleteThis/);
  assert.match(readSrc("../../components/admin/admin-command-presets-panel.tsx"), /preset\.edit/);
  assert.match(readSrc("../../components/controllers/command-history-table.tsx"), /formatCommandSummary/);
});

test("english tour steps and hover chrome come from the sheet dictionary", () => {
  const header = TOUR_STEPS.find((step) => step.id === "f-header");
  assert.ok(header);
  assert.equal(tourStepTitle(header, "ko", false), "상단 도구");
  assert.equal(tourStepTitle(header, "en", false), "Header tools");
  assert.match(tourStepBody(header, "en", true), /Alarms/);
  assert.equal(tourStepBullets(header, "en", false)?.[0], "Alarms · today's report · (admin) ops");
  assert.equal(sheetCopy("en", "chart.limitBreach"), "Outside limit");
  assert.equal(sheetCopy("en", "ui.expand"), "Expand");
  assert.match(readSrc("../../components/trends/trend-hover-card.tsx"), /chart\.limitBreach/);
  assert.match(readSrc("../../components/onboarding/feature-tour.tsx"), /tourStepTitle/);
});
