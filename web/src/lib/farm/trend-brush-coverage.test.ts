import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  TREND_BRUSH_LOADED_7D_START,
  brushWindowCoveredBy7d,
  brushWindowNeeds15m,
  mapBrushWindowOnto7d,
} from "./trend-brush-coverage";

describe("brushWindowCoveredBy7d", () => {
  it("covers the default 7-day window at the recent end", () => {
    assert.equal(
      brushWindowCoveredBy7d({ start: TREND_BRUSH_LOADED_7D_START, width: 7 / 30 }),
      true,
    );
  });

  it("rejects a window that starts in the older 23 days", () => {
    assert.equal(brushWindowCoveredBy7d({ start: 0, width: 7 / 30 }), false);
  });
});

describe("mapBrushWindowOnto7d", () => {
  it("maps the full 7-day window to the whole 7d axis", () => {
    const range = mapBrushWindowOnto7d(
      { start: TREND_BRUSH_LOADED_7D_START, width: 7 / 30 },
      168,
    );
    assert.equal(range.from, 0);
    assert.equal(range.to, 168);
  });
});

describe("brushWindowNeeds15m", () => {
  it("requests 15m at or under 48 hours", () => {
    assert.equal(brushWindowNeeds15m({ start: 0.96, width: 1 / 30 }), true);
    assert.equal(brushWindowNeeds15m({ start: 0.9, width: 2 / 30 }), true);
  });

  it("keeps 1h context for a 7-day window", () => {
    assert.equal(
      brushWindowNeeds15m({ start: TREND_BRUSH_LOADED_7D_START, width: 7 / 30 }),
      false,
    );
  });
});
