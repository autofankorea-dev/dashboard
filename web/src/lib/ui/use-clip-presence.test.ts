/**
 * 실행: npx tsx src/lib/ui/use-clip-presence.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipPresenceLiveKey,
  clipPresencePhaseKey,
  nextClipPresenceEntries,
  type ClipPresenceEntry,
} from "./use-clip-presence";

function shown(key: string): ClipPresenceEntry<{ name: string }> {
  return { key, phase: "shown", item: { name: key } };
}

describe("clipPresenceLiveKey", () => {
  it("joins keys with a null separator", () => {
    assert.equal(clipPresenceLiveKey(["온도", "습도"]), "온도\0습도");
    assert.equal(clipPresenceLiveKey([]), "");
  });

  it("same labels produce the same key even if called twice", () => {
    const a = clipPresenceLiveKey(["01 온도", "01 습도"]);
    const b = clipPresenceLiveKey(["01 온도", "01 습도"]);
    assert.equal(a, b);
  });
});

describe("nextClipPresenceEntries", () => {
  it("marks first-time keys as enter and removed keys as exit", () => {
    const prev = [shown("온도")];
    const next = nextClipPresenceEntries(
      prev,
      ["온도", "습도"],
      new Map([
        ["온도", { name: "온도" }],
        ["습도", { name: "습도" }],
      ]),
    );
    assert.equal(clipPresencePhaseKey(next), "온도:shown|습도:enter");
  });

  it("keeps enter until the timer would promote it", () => {
    const prev: ClipPresenceEntry<{ name: string }>[] = [
      { key: "온도", phase: "enter", item: { name: "온도" } },
    ];
    const next = nextClipPresenceEntries(
      prev,
      ["온도"],
      new Map([["온도", { name: "온도" }]]),
    );
    assert.equal(clipPresencePhaseKey(next), "온도:enter");
  });

  it("identical live keys keep the same phase signature (setState bail)", () => {
    const prev = [shown("온도"), shown("습도")];
    const next = nextClipPresenceEntries(
      prev,
      ["온도", "습도"],
      new Map([
        ["온도", { name: "온도" }],
        ["습도", { name: "습도" }],
      ]),
    );
    assert.equal(clipPresencePhaseKey(next), clipPresencePhaseKey(prev));
  });

  it("does not oscillate when only item identity changes", () => {
    const prev = [shown("온도")];
    const a = nextClipPresenceEntries(
      prev,
      ["온도"],
      new Map([["온도", { name: "온도" }]]),
    );
    const b = nextClipPresenceEntries(
      a,
      ["온도"],
      new Map([["온도", { name: "온도" }]]),
    );
    assert.equal(clipPresencePhaseKey(a), clipPresencePhaseKey(b));
  });
});
