import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  insertRateStatus,
  statusFromInsertRate,
} from "@/lib/admin/health/insert-rate-status";

describe("insertRateStatus", () => {
  it("treats missing buckets as unobserved", () => {
    assert.equal(insertRateStatus([]), "unknown");
    assert.equal(statusFromInsertRate("unknown"), "unknown");
  });

  it("treats a quiet recent window as a fault", () => {
    assert.equal(insertRateStatus([{ count: 0 }, { count: 0 }]), "critical");
    assert.equal(statusFromInsertRate("critical"), "critical");
  });

  it("treats a single gap as a warning", () => {
    assert.equal(insertRateStatus([{ count: 4 }, { count: 0 }]), "warn");
    assert.equal(statusFromInsertRate("ok"), "ok");
  });
});
