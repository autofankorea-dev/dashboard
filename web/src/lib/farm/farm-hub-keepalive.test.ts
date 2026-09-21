/**
 * 실행: npx tsx src/lib/farm/farm-hub-keepalive.test.ts
 */
import assert from "node:assert/strict";
import {
  canUnmountKeepAlivePanel,
  FARM_HUB_KEEPALIVE_TTL_MS,
  isFarmHubKeepAlivePanel,
  keepAliveFlagsForActiveView,
  keepAliveRemainingMs,
  nextPanelInactiveSince,
  isFarmHubPanelLiveActive,
} from "./farm-hub-keepalive";

{
  assert.equal(isFarmHubKeepAlivePanel("map"), false);
  assert.equal(isFarmHubKeepAlivePanel("list"), true);
  assert.equal(isFarmHubKeepAlivePanel("chart"), true);
  assert.equal(isFarmHubKeepAlivePanel("chartlab"), false);
  assert.equal(isFarmHubKeepAlivePanel("aria"), false);
}

{
  const t0 = 1_000_000;
  let since = nextPanelInactiveSince({}, "map", "chart", t0);
  assert.equal(since.chart, undefined);
  since = nextPanelInactiveSince(since, "chart", "map", t0 + 100);
  assert.equal(since.chart, t0 + 100);
  since = nextPanelInactiveSince(since, "map", "chart", t0 + 200);
  assert.equal(since.chart, undefined);
}

{
  assert.equal(canUnmountKeepAlivePanel("chart", "map", null), true);
  assert.equal(canUnmountKeepAlivePanel("chart", "chart", null), false);
  assert.equal(
    canUnmountKeepAlivePanel("chart", "map", { from: "chart", to: "map" }),
    false,
  );
  assert.equal(
    canUnmountKeepAlivePanel("list", "chart", { from: "map", to: "chart" }),
    true,
  );
}

{
  const ttl = FARM_HUB_KEEPALIVE_TTL_MS.chart;
  const leftAt = 1_000;
  assert.equal(keepAliveRemainingMs(leftAt, leftAt + ttl - 50, ttl), 50);
  assert.equal(keepAliveRemainingMs(leftAt, leftAt + ttl + 10, ttl), 0);
}

{
  assert.deepEqual(keepAliveFlagsForActiveView("map"), {
    list: false,
    chart: false,
  });
  assert.deepEqual(keepAliveFlagsForActiveView("aria"), {
    list: false,
    chart: false,
  });
}

{
  assert.equal(isFarmHubPanelLiveActive("list", "list"), true);
  assert.equal(isFarmHubPanelLiveActive("map", "list"), false);
  assert.equal(isFarmHubPanelLiveActive("aria", "chart"), false);
  assert.equal(isFarmHubPanelLiveActive("chart", "chart"), true);
}

console.log("farm-hub-keepalive.test.ts: ok");
