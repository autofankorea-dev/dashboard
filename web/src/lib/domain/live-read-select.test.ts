import assert from "node:assert/strict";
import {
  LIVE_LEGACY_COLS,
  LIVE_LIST_COLS,
  LIVE_LIST_COLS_CORE,
  assertLiveListSelectIsThin,
  liveListSelectViolations,
} from "@/lib/domain/live-read-select";

assert.deepEqual(liveListSelectViolations(LIVE_LIST_COLS), []);
assert.deepEqual(liveListSelectViolations(LIVE_LIST_COLS_CORE), []);
assertLiveListSelectIsThin(LIVE_LIST_COLS);
assertLiveListSelectIsThin(LIVE_LIST_COLS_CORE);

assert.ok(liveListSelectViolations(LIVE_LEGACY_COLS).includes("decoded_json"));
assert.ok(
  liveListSelectViolations("a, channels, b").includes("channels"),
);

let threw = false;
try {
  assertLiveListSelectIsThin("raw_id, decoded_json");
} catch {
  threw = true;
}
assert.equal(threw, true);

console.log("live-read-select.test.ts: ok");
