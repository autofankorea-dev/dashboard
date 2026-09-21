import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOrderedPool } from "./trend-day-pool";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("runOrderedPool", () => {
  it("applies results in index order even when later indices finish first", async () => {
    const applied: number[] = [];
    const started: number[] = [];
    let maxInFlight = 0;
    let inFlight = 0;

    await runOrderedPool({
      start: 0,
      end: 6,
      concurrency: 3,
      fetchOne: async (index) => {
        started.push(index);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay((6 - index) * 8);
        inFlight -= 1;
        return index;
      },
      onApply: (index, value) => {
        applied.push(value ?? -1);
        assert.equal(index, value);
      },
    });

    assert.deepEqual(applied, [0, 1, 2, 3, 4, 5]);
    assert.equal(started[0], 0);
    assert.ok(maxInFlight >= 2 && maxInFlight <= 3);
  });

  it("still advances past a failed fetch", async () => {
    const applied: Array<number | undefined> = [];
    await runOrderedPool({
      start: 0,
      end: 3,
      concurrency: 2,
      fetchOne: async (index) => {
        if (index === 1) throw new Error("day failed");
        return index;
      },
      onApply: (index, value) => {
        applied[index] = value;
      },
    });
    assert.deepEqual(applied, [0, undefined, 2]);
  });
});
