import assert from "node:assert/strict";
import { test } from "vitest";
import { controllerEnvCoverNotices } from "@/lib/farm/controller-env-cover";
import { coverExampleReading } from "@/lib/ui/settings-example-reading";

test("settings cover example follows the cover-off notice rule", () => {
  assert.deepEqual(controllerEnvCoverNotices(coverExampleReading("ok")), []);
  const hot = controllerEnvCoverNotices(coverExampleReading("temp"));
  assert.equal(hot.some((notice) => notice.kind === "humidity"), false);
  assert.equal(hot[0]?.kind, "temp");
  assert.equal(hot[0]?.grade, "caution");
  const comm = controllerEnvCoverNotices(coverExampleReading("comm"));
  assert.equal(comm[0]?.kind, "comm");
  assert.equal(comm[0]?.grade, "warning");
});
