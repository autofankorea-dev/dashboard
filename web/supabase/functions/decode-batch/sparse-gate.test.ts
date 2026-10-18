import { test } from "vitest";
import assert from "node:assert/strict";
import { shouldWriteSparse } from "./sparse-gate";

test("error-only changes and clears bypass sparse suppression", () => {
  const metrics = { temp_c: 25, fan_exhaust_pct: 30, fan_intake_pct: 20 };
  const args = { last: { ...metrics, error_code_raw: 0, updated_at: "2026-10-19T00:00:00Z" },
    next: { ...metrics, error_code_raw: 0 }, nowMs: Date.parse("2026-10-19T00:00:01Z"),
    epsTemp: 0.2, epsFan: 2, heartbeatSec: 1800 };
  assert.equal(shouldWriteSparse(args), false);
  assert.equal(shouldWriteSparse({ ...args, next: { ...metrics, error_code_raw: 0xabcd } }), true);
  assert.equal(shouldWriteSparse({ ...args, last: { ...args.last, error_code_raw: 0xabcd } }), true);
});
