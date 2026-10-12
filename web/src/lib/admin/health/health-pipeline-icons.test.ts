import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { resolveHealthPipelineIcon } from "./health-pipeline-icons";

describe("resolveHealthPipelineIcon", () => {
  it("maps dag and pipeline ids to distinct icons", () => {
    const mqtt = resolveHealthPipelineIcon("mqtt");
    const collect = resolveHealthPipelineIcon("rs");
    const command = resolveHealthPipelineIcon("c-cmd");
    const farm = resolveHealthPipelineIcon("mod-FARM01--P00");
    assert.notEqual(mqtt, collect);
    assert.notEqual(collect, command);
    assert.equal(farm, resolveHealthPipelineIcon("field"));
    assert.equal(resolveHealthPipelineIcon("storage"), resolveHealthPipelineIcon("db"));
  });
});
