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
    /envCoverIdentity:[\s\S]*md:text-\[length:var\(--density-card-title-md\)\]/,
  );
  assert.match(
    pageUi,
    /envCoverValue:[\s\S]*md:text-\[length:var\(--density-value-lg-md\)\]/,
  );
  const cover = readRepoFile("src/components/farm/controller-env-cover.tsx");
  assert.match(cover, /md:min-h-24/);
  const doc = readRepoFile("docs/UI_DENSITY.md");
  assert.equal(doc.includes("header-density"), false);
  assert.equal(doc.includes("조밀"), false);
});
