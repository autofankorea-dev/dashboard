import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "vitest";

function globalsCss(): string {
  const candidates = [
    join(process.cwd(), "src/app/globals.css"),
    join(process.cwd(), "web/src/app/globals.css"),
  ];
  for (const path of candidates) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      // try the next root
    }
  }
  throw new Error("globals.css not found");
}

const darkBlock = globalsCss().split(".dark {")[1] ?? "";
assert.match(
  darkBlock,
  /--status-warn-on-canvas:\s*oklch\(from var\(--status-warn\) 0\.78 c h\)/,
);
assert.match(
  darkBlock,
  /--status-danger-on-canvas:\s*oklch\(from var\(--status-danger\) 0\.82 c h\)/,
);
assert.doesNotMatch(
  darkBlock,
  /--status-warn-on-canvas:\s*var\(--status-warn\)/,
);
assert.doesNotMatch(
  darkBlock,
  /--status-danger-on-canvas:\s*var\(--status-danger\)/,
);

test("dark warn and danger numbers keep their hue and a higher lightness", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
