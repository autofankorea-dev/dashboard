import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { startSharedInflight } from "@/lib/farm/shared-inflight";

describe("startSharedInflight", () => {
  it("reuses the first start() and sets the map before start runs", async () => {
    const inflight = new Map<string, Promise<number>>();
    let starts = 0;
    const a = startSharedInflight(inflight, "k", async () => {
      starts += 1;
      return 7;
    });
    const b = startSharedInflight(inflight, "k", async () => {
      starts += 1;
      return 8;
    });
    assert.equal(a, b);
    assert.equal(await a, 7);
    assert.equal(starts, 1);
    assert.equal(inflight.has("k"), false);
  });
});
