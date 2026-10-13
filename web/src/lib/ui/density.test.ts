import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "vitest";
import { densityClass } from "./density";

function readRepoFile(rel: string): string {
  const candidates = [join(process.cwd(), rel), join(process.cwd(), "web", rel)];
  for (const path of candidates) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      // try the next root
    }
  }
  throw new Error(`${rel} not found`);
}

test("type scale is the root tokens with no compact override", () => {
  assert.match(densityClass.bodyToMd, /--density-body-md/);
  const css = readRepoFile("src/app/globals.css");
  assert.match(css, /--density-body-md:\s*1\.75rem/);
  assert.match(css, /--density-card-title-md:\s*2rem/);
  assert.equal(css.includes('html[data-density="compact"]'), false);
  assert.equal(
    css.includes('html[data-viewport-preview="desktop"][data-density="comfortable"]'),
    false,
  );
});

test("header has no density toggle and the controller card uses the md scale", () => {
  const header = readRepoFile("src/components/layout/header-tools-menu.tsx");
  assert.equal(header.includes("header-density"), false);
  assert.equal(header.includes("toggleDashboardDensity"), false);
  assert.match(header, /\[bell, ops, report, themeEl, viewport\]/);
  const pageUi = readRepoFile("src/lib/ui/dashboard-page-ui.ts");
  assert.match(
    pageUi,
    /cardTitle:\s*\n?\s*"text-\[length:var\(--density-card-title\)\][^"]*md:text-\[length:var\(--density-card-title-md\)\]"/,
  );
  assert.match(
    pageUi,
    /envCoverValue:[\s\S]*font-semibold[\s\S]*md:text-\[length:var\(--density-card-title-md\)\]/,
  );
  assert.equal(pageUi.includes("envCoverIdentity"), false);
  assert.equal(readRepoFile("src/app/globals.css").includes("--density-cover-"), false);
  const cover = readRepoFile("src/components/farm/controller-env-cover.tsx");
  const summaryHeader = readRepoFile("src/components/farm/controller-summary-parts.tsx");
  assert.match(cover, /absolute inset-0/);
  assert.match(cover, /dashboardTypography\.cardTitle/);
  assert.equal(cover.includes("cardDesc"), false);
  assert.match(cover, /fitText/);
  assert.match(cover, /mt-1\.5 size-2\.5 shrink-0 rounded-sm/);
  assert.match(summaryHeader, /mt-1\.5 size-2\.5 shrink-0 rounded-sm/);
  assert.match(summaryHeader, /fitText/);
  assert.match(summaryHeader, /dashboardTypography\.cardTitle/);
  assert.equal(summaryHeader.includes("cardDesc"), false);
  assert.match(cover, /StallUnitNoMark/);
  assert.match(cover, /ControllerNoMark/);
  assert.equal(cover.includes("data-cover-environment-status"), false);
  assert.equal(cover.includes('data-cover-morph="band"'), false);
  assert.equal(cover.includes("md:min-h-24"), false);
  const gaugeRow = readRepoFile("src/components/farm/controller-summary-gauge-row.tsx");
  assert.match(gaugeRow, /flex h-full min-w-0 flex-col/);
  assert.equal(gaugeRow.includes("showEnvCover ? null : cardBody"), false);
  const doc = readRepoFile("docs/UI_DENSITY.md");
  assert.equal(doc.includes("header-density"), false);
  assert.equal(doc.includes("조밀"), false);
});

test("screen text uses one Pretendard family", () => {
  const css = readRepoFile("src/app/globals.css");
  const layout = readRepoFile("src/app/layout.tsx");
  assert.match(css, /--font-pretendard:\s*"Pretendard Variable"/);
  assert.match(css, /--font-sans:\s*var\(--font-pretendard\)/);
  assert.match(css, /--font-mono:\s*var\(--font-pretendard\)/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.equal(css.includes("--font-geist"), false);
  assert.equal(layout.includes("next/font/google"), false);
  assert.match(layout, /pretendard\.css/);
  const pdf = readRepoFile("src/lib/report/build-daily-report-pdf-base.ts");
  assert.match(pdf, /"Pretendard Variable"/);
});
