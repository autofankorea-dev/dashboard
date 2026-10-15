import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { opsLayout } from "@/lib/ui/dashboard-page-ui";

test("ops sections follow health, users, commands, presets", () => {
  assert.match(opsLayout.sectionScan, /order-1/);
  assert.match(opsLayout.sectionDirectory, /order-2/);
  assert.match(opsLayout.sectionCommands, /order-3/);
  assert.match(opsLayout.sectionPresets, /order-4/);
  const scan = readFileSync(new URL("./ops-scan-client.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("./admin-ops-home.tsx", import.meta.url), "utf8");
  const presets = readFileSync(
    new URL("./admin-command-presets-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(scan, /sectionScan/);
  assert.match(home, /sectionDirectory/);
  assert.match(home, /sectionCommands/);
  assert.match(presets, /sectionPresets/);
});
