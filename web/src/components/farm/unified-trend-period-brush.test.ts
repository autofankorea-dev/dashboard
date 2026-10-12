import { test } from "vitest";
/**
 * 실행: npx vitest run src/components/farm/unified-trend-period-brush.test.ts
 */
import assert from "node:assert/strict";
import {
  brushPlotPad,
  brushRatioFromTrackU,
  brushWindowCssPct,
  BRUSH_MIN_WIDTH,
  BRUSH_PERIOD_WINDOW,
  brushWindowFromDraft,
  clampBrushWindow,
  displayPeriodFromBrushWindow,
  formatBrushWindowLabel,
  formatLookbackWindowLabel,
  zoomBrushLookback,
  cycleBrushLookbackPreset,
  moveBrushWindow,
  resolveBrushHighlightWindow,
  brushOverviewBarRect,
  brushGroupedBarSlot,
} from "./unified-trend-period-brush";

{
  const full = clampBrushWindow(-0.2, 1.4);
  assert.equal(full.start, 0);
  assert.equal(full.width, 1);

  const tiny = clampBrushWindow(0.5, 0.0001);
  assert.ok(tiny.width >= BRUSH_MIN_WIDTH);
  assert.ok(tiny.start >= 0);
  assert.ok(tiny.start + tiny.width <= 1 + 1e-9);
}

{
  assert.equal(brushWindowFromDraft(0.1, 0.11), null);
  const mid = brushWindowFromDraft(0.2, 0.5);
  assert.ok(mid);
  assert.ok(Math.abs(mid.start - 0.2) < 1e-9);
  assert.ok(Math.abs(mid.width - 0.3) < 1e-9);

  const past = brushWindowFromDraft(0.1, 0.4);
  assert.ok(past);
  assert.ok(past.start < 0.2);
}

{
  const seven = BRUSH_PERIOD_WINDOW["7d"];
  const moved = moveBrushWindow(seven, 0.2);
  assert.ok(Math.abs(moved.width - seven.width) < 1e-9);
  assert.ok(moved.start < seven.start);
  assert.ok(moved.start + moved.width <= 1 + 1e-9);
}

{
  assert.equal(displayPeriodFromBrushWindow({ start: 0.96, width: 1 / 30 }), "24h");
  assert.equal(displayPeriodFromBrushWindow(BRUSH_PERIOD_WINDOW["7d"]), "7d");
  assert.equal(displayPeriodFromBrushWindow(BRUSH_PERIOD_WINDOW["30d"]), "30d");
}

{
  assert.equal(formatBrushWindowLabel({ start: 0, width: 1 }), "약 30일");
  assert.match(formatBrushWindowLabel({ start: 0.9, width: 0.02 }), /시간|1일/);
}

{
  const win = { start: 0.2, width: 0.4 };
  const full = resolveBrushHighlightWindow(win, null, 100);
  assert.equal(full.start, 0.2);
  assert.equal(full.width, 0.4);

  const scoped = resolveBrushHighlightWindow(
    win,
    { start: 20, end: 80 },
    101,
  );
  assert.ok(Math.abs(scoped.start - (0.2 + 0.2 * 0.4)) < 0.001);
  assert.ok(Math.abs(scoped.width - 0.6 * 0.4) < 0.001);
}

{
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].start, 0);
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].width, 1);
  assert.ok(BRUSH_PERIOD_WINDOW["7d"].start > 0.7);
}

{
  const pad = brushPlotPad(false);
  assert.ok(Math.abs(pad.padL - 0.01) < 1e-12);
  assert.ok(Math.abs(pad.innerW - 0.98) < 1e-12);
  assert.equal(brushRatioFromTrackU(0.01, false), 0);
  assert.ok(Math.abs(brushRatioFromTrackU(0.5, false) - 0.5) < 1e-12);
  assert.equal(brushRatioFromTrackU(0.99, false), 1);
  const css = brushWindowCssPct({ start: 0, width: 1 }, false);
  assert.ok(Math.abs(css.leftPct - 1) < 1e-9);
  assert.ok(Math.abs(css.widthPct - 98) < 1e-9);
}

{
  const comfort = brushOverviewBarRect(100);
  assert.ok(comfort.height > brushOverviewBarRect(50).height);
  const slot = brushGroupedBarSlot(0, 10, 0.01, 0.98);
  assert.ok(slot.a.x < slot.b.x);
  assert.ok(slot.a.width > 0);
  assert.ok(Math.abs(slot.a.width - slot.b.width) < 1e-9);
  const next = brushGroupedBarSlot(1, 10, 0.01, 0.98);
  assert.ok(next.a.x > slot.b.x);
}

{
  const seven = BRUSH_PERIOD_WINDOW["7d"];
  const inWin = zoomBrushLookback(seven, -1);
  assert.ok(inWin.width < seven.width);
  assert.ok(Math.abs(inWin.start + inWin.width - 1) < 1e-9);
  const outWin = zoomBrushLookback(seven, 1);
  assert.ok(outWin.width > seven.width);
  assert.ok(Math.abs(outWin.start + outWin.width - 1) < 1e-9);
  const floor = zoomBrushLookback({ start: 0, width: BRUSH_MIN_WIDTH }, -1);
  assert.ok(Math.abs(floor.width - BRUSH_MIN_WIDTH) < 1e-12);
  const full = zoomBrushLookback({ start: 0, width: 1 }, 1);
  assert.equal(full.width, 1);
  assert.equal(full.start, 0);
  assert.equal(formatLookbackWindowLabel(seven), "최근 7일");
  assert.equal(
    formatLookbackWindowLabel(BRUSH_PERIOD_WINDOW["24h"]),
    "최근 1일",
  );
  assert.equal(cycleBrushLookbackPreset(seven).width, 1);
  assert.equal(
    cycleBrushLookbackPreset(BRUSH_PERIOD_WINDOW["30d"]).width,
    BRUSH_PERIOD_WINDOW["24h"].width,
  );
}

console.log("unified-trend-period-brush.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
