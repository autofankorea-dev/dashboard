import assert from "node:assert/strict";
import { describe, it, afterEach } from "vitest";
import { farmFieldMergeEnabled } from "./farm-field-merge-enabled";

describe("farmFieldMergeEnabled", () => {
  const prev = process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1;
    else process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1 = prev;
  });

  it("defaults to on when unset", () => {
    delete process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1;
    assert.equal(farmFieldMergeEnabled(), true);
  });

  it("respects false/0/off", () => {
    process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1 = "false";
    assert.equal(farmFieldMergeEnabled(), false);
    process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1 = "0";
    assert.equal(farmFieldMergeEnabled(), false);
    process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1 = "off";
    assert.equal(farmFieldMergeEnabled(), false);
  });

  it("respects true/1/on", () => {
    process.env.NEXT_PUBLIC_FARM_FIELD_MERGE_V1 = "true";
    assert.equal(farmFieldMergeEnabled(), true);
  });
});
