import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { buildModuleActionPath, classifyHealthError } from "./d11-map";
import { formatHealthAgeMin } from "./format-health-time";

describe("classifyHealthError", () => {
  it("maps the five operator types to one action", () => {
    assert.deepEqual(classifyHealthError("S1", "R3"), {
      type: "Receive down",
      action: "Check collector and MQTT first",
      codeTitle: "S1 · R3",
    });
    assert.equal(classifyHealthError("S1", "R2")?.type, "Partial outage");
    assert.equal(classifyHealthError("S1", "R2", "collector-rs")?.type, "Receive down");
    assert.equal(classifyHealthError("S5", "R1")?.type, "Partial outage");
    assert.equal(classifyHealthError("S3")?.action, "Check last seen and interval only");
    assert.equal(classifyHealthError("S2")?.type, "Display / storage");
    assert.equal(classifyHealthError("S4")?.type, "Command");
  });

  it("skips non-action types", () => {
    assert.equal(classifyHealthError("S6-A"), null);
    assert.equal(classifyHealthError("S7"), null);
    assert.equal(classifyHealthError("—"), null);
  });
});

describe("buildModuleActionPath", () => {
  it("expands S1/R2 into a full action path", () => {
    const path = buildModuleActionPath("S1", "R2");
    assert.ok(path);
    assert.equal(path.codeTitle, "S1 · R2");
    assert.deepEqual(path.steps, [
      "측정이 안 옴",
      "이 농장만",
      "다른 농장에 새 데이터가 오는지 확인",
      "이 농장만인지 여러 농장인지 분기",
    ]);
  });

  it("returns null when there is no hint", () => {
    assert.equal(buildModuleActionPath("—", "R2"), null);
  });
});

describe("formatHealthAgeMin", () => {
  it("uses day/hour instead of raw minutes", () => {
    assert.equal(formatHealthAgeMin(0.4), "방금");
    assert.equal(formatHealthAgeMin(3), "3분");
    assert.equal(formatHealthAgeMin(2995), "2일");
  });
});
