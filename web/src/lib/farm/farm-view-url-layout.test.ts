import assert from "node:assert/strict";
import { test } from "vitest";
import { resolveListLayoutParam } from "./farm-view-url";

test("group is the default list layout", () => {
  assert.equal(resolveListLayoutParam(new URLSearchParams()), "group");
  assert.equal(
    resolveListLayoutParam(new URLSearchParams("listLayout=group")),
    "group",
  );
  assert.equal(
    resolveListLayoutParam(new URLSearchParams("listLayout=flat")),
    "flat",
  );
});
