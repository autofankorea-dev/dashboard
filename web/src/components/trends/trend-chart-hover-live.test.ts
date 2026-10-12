import { test } from "vitest";
/**
 * 실행: npx vitest run src/components/trends/trend-chart-hover-live.test.ts
 */
import assert from "node:assert/strict";
import type { TrendEventMark } from "@/lib/domain/trend-chart-types";
import { tipPinId } from "@/lib/farm/trend-chart-geometry";
import type { PinnedTip } from "./trend-chart-interaction";
import { resolveTrendHoverCardLive } from "./trend-chart-hover-live";

const mark = { id: "e1" } as TrendEventMark;

function pin(partial: Partial<PinnedTip> & Pick<PinnedTip, "id">): PinnedTip {
  return {
    idx: 1,
    seriesKey: "온도",
    nx: 0,
    ny: 0,
    ox: 0,
    oy: 0,
    ...partial,
  };
}

const base = {
  hoverEventMark: null,
  pinnedTips: [] as PinnedTip[],
  hoverIdx: 2,
  n: 8,
  hoverSeries: "습도",
  overlayHoverMerge: false,
};

assert.deepEqual(resolveTrendHoverCardLive(base), {
  kind: "point",
  idx: 2,
  seriesKey: "습도",
});

assert.deepEqual(
  resolveTrendHoverCardLive({ ...base, hoverEventMark: mark }),
  { kind: "event", mark },
);

assert.deepEqual(
  resolveTrendHoverCardLive({
    ...base,
    hoverEventMark: mark,
    pinnedTips: [pin({ id: "pin", eventMark: mark })],
  }),
  { kind: "point", idx: 2, seriesKey: "습도" },
);

assert.equal(
  resolveTrendHoverCardLive({
    ...base,
    hoverEventMark: mark,
    hoverSeries: null,
    pinnedTips: [pin({ id: "pin", eventMark: mark })],
  }),
  null,
);

assert.equal(
  resolveTrendHoverCardLive({
    ...base,
    pinnedTips: [pin({ id: tipPinId(2, "습도") })],
  }),
  null,
);

assert.deepEqual(
  resolveTrendHoverCardLive({
    ...base,
    overlayHoverMerge: true,
    pinnedTips: [pin({ id: tipPinId(2, "습도") })],
  }),
  { kind: "point", idx: 2, seriesKey: "습도" },
);

assert.equal(
  resolveTrendHoverCardLive({
    ...base,
    overlayHoverMerge: true,
    pinnedTips: [pin({ id: tipPinId(2, "온도") })],
  }),
  null,
);

assert.equal(
  resolveTrendHoverCardLive({ ...base, hoverSeries: "event:e1" }),
  null,
);

console.log("trend-chart-hover-live.test.ts ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
