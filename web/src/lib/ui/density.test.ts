import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import {
  DENSITY_STORAGE_KEY,
  applyDensity,
  getDashboardDensity,
  nextDensity,
  subscribeDashboardDensity,
  toggleDashboardDensity,
} from "./density";

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

const restore: Array<() => void> = [];

afterEach(() => {
  while (restore.length) restore.pop()?.();
});

function installDom(initial: "comfortable" | "compact" | "" = "") {
  const store = new Map<string, string>();
  const dataset: { density?: string } = {};
  if (initial) dataset.density = initial;
  const prevDocument = globalThis.document;
  const prevStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: { dataset } },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      setItem: (key: string, value: string) => store.set(key, value),
      getItem: (key: string) => store.get(key) ?? null,
    },
  });
  restore.push(() => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: prevDocument,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: prevStorage,
    });
  });
  return { store, dataset };
}

test("nextDensity flips comfortable and compact", () => {
  assert.equal(nextDensity("comfortable"), "compact");
  assert.equal(nextDensity("compact"), "comfortable");
});

test("the first subscriber adopts the density init script", () => {
  installDom("compact");
  const unsubscribe = subscribeDashboardDensity(() => {});
  restore.push(unsubscribe);
  assert.equal(getDashboardDensity(), "compact");
  applyDensity("comfortable");
});

test("applyDensity persists the mode and notifies subscribers", () => {
  const { store, dataset } = installDom();
  const seen: string[] = [];
  const unsubscribe = subscribeDashboardDensity(() => {
    seen.push(getDashboardDensity());
  });
  restore.push(unsubscribe);

  applyDensity("compact");
  assert.equal(dataset.density, "compact");
  assert.equal(store.get(DENSITY_STORAGE_KEY), "compact");
  assert.equal(getDashboardDensity(), "compact");
  assert.deepEqual(seen, ["compact"]);

  assert.equal(toggleDashboardDensity(), "comfortable");
  assert.equal(dataset.density, "comfortable");
  assert.equal(store.get(DENSITY_STORAGE_KEY), "comfortable");
  assert.deepEqual(seen, ["compact", "comfortable"]);
});

test("compact is unconditional and the narrow scale stays on comfortable", () => {
  const css = readRepoFile("src/app/globals.css");
  const compactAt = css.indexOf('html[data-density="compact"]');
  const narrowAt = css.indexOf("@media (max-width: 1279px)");
  assert.ok(compactAt > 0 && narrowAt > compactAt);
  assert.match(
    css,
    /@media \(max-width: 1279px\) \{\s*html\[data-viewport-preview="desktop"\]\[data-density="comfortable"\]/,
  );
});

test("header density control sits beside theme and is not a profile pin", () => {
  const header = readRepoFile("src/components/layout/header-tools-menu.tsx");
  assert.match(header, /data-tour-id="header-density"/);
  assert.match(header, /toggleDashboardDensity/);
  assert.match(
    header,
    /\[bell, ops, report, themeEl, densityEl, viewport\]/,
  );
  const pins = readRepoFile("src/lib/ui/profile-pin-tools.ts");
  assert.equal(pins.includes('"density"'), false);
  const doc = readRepoFile("docs/UI_DENSITY.md");
  assert.equal(doc.includes("연결되지 않음"), false);
  assert.match(doc, /header-density/);
});
