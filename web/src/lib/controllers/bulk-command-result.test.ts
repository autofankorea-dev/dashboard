import { expect, it } from "vitest";
import { controllerCommandResult } from "./bulk-command-result";

it("counts a rejected multi-channel controller once and excludes partial failures from success", () => {
  const result = controllerCommandResult([{ key: "farm1:module1:ctrl1", id: "channelA" },
    { key: "farm1:module1:ctrl1", id: "channelB" }, { key: "farm2:module1:ctrl1", id: "other-farm" }],
  [{ key: "farm1:module1:ctrl1", error: "channel C failed" }, { key: "farm1:module1:ctrl1", error: "alarm failed" }]);
  expect(result.sent).toBe(1);
  expect(result.failed).toHaveLength(1);
  expect(result.sentItems).toHaveLength(3); // still poll every registered ID
  expect(result.ok).toBe(false);
});

it("counts repeated successful channel IDs as one controller", () => {
  expect(controllerCommandResult([{ key: "ctrl1" }, { key: "ctrl1" }, { key: "ctrl2" }], []).sent).toBe(2);
});
