import assert from "node:assert/strict";
import {
  hoverPairSlotDx,
  isScaleEdgeMidId,
  nearestByXView,
  pickDraggableScaleEdgeHit,
  pickGutterScaleEdgeId,
  chartTipPresenceClass,
  clipWipeClass,
  shouldPreferLookbackPinch,
} from "./trend-chart-interaction";

{
  assert.equal(hoverPairSlotDx(100, 1), 100);
  assert.equal(hoverPairSlotDx(100, 5), 18.75);
  assert.equal(hoverPairSlotDx(0, 10), 0);
}

{
  const items = [
    { id: "a", xView: 10 },
    { id: "b", xView: 40 },
    { id: "c", xView: 42 },
  ];
  assert.equal(nearestByXView(items, 41, 8)?.id, "c");
  assert.equal(nearestByXView(items, 10, 8)?.id, "a");
  assert.equal(nearestByXView(items, 80, 8), null);
  assert.equal(nearestByXView([], 10, 8), null);
}

{
  const yFor = (value: number) => value;
  const guides = [
    { id: "temp-farm-hi", value: 32, draggable: true },
    { id: "temp-farm-mid", value: 50, draggable: true },
    { id: "temp-farm-lo", value: 68, draggable: true },
  ];
  assert.equal(
    pickDraggableScaleEdgeHit(guides, 50, yFor, 100, 100, 20)?.id,
    "temp-farm-mid",
  );
  assert.equal(
    pickDraggableScaleEdgeHit(guides, 32, yFor, 100, 100, 10)?.id,
    "temp-farm-hi",
  );
  assert.equal(
    pickDraggableScaleEdgeHit(
      [{ id: "temp-farm-mid", value: 50, draggable: true }],
      50,
      yFor,
      100,
      100,
      20,
    )?.id,
    "temp-farm-mid",
  );
  assert.equal(
    pickDraggableScaleEdgeHit(
      [{ id: "temp-hi", value: 32, draggable: false }],
      32,
      yFor,
      100,
      100,
      20,
    ),
    null,
  );
  assert.equal(
    pickDraggableScaleEdgeHit(guides, 38, yFor, 100, 100, 20)?.id,
    "temp-farm-mid",
  );
  assert.equal(isScaleEdgeMidId("temp-farm-mid"), true);
  assert.equal(isScaleEdgeMidId("temp-farm-hi"), false);
}

{
  const labels = [
    { id: "temp-farm-mid", side: "left" as const, draggable: true, topPct: 40 },
    { id: "hum-farm-mid", side: "left" as const, draggable: true, topPct: 70 },
    { id: "temp-hi", side: "right" as const, draggable: true, topPct: 40 },
    { id: "motor-mid", side: "left" as const, draggable: false, topPct: 88 },
  ];
  assert.equal(
    pickGutterScaleEdgeId(labels, "left", 40, 0, 100, 28),
    "temp-farm-mid",
  );
  assert.equal(
    pickGutterScaleEdgeId(labels, "left", 70, 0, 100, 28),
    "hum-farm-mid",
  );
  assert.equal(pickGutterScaleEdgeId(labels, "left", 99, 0, 100, 20), null);
  assert.equal(pickGutterScaleEdgeId(labels, "right", 40, 0, 100, 28), "temp-hi");
}

{
  assert.equal(chartTipPresenceClass("enter"), "farm-chart-tip-in");
  assert.equal(chartTipPresenceClass("exit"), "farm-chart-tip-out");
  assert.equal(chartTipPresenceClass("shown"), undefined);
  assert.equal(clipWipeClass("enter"), "farm-chart-clip-wipe-in");
  assert.equal(clipWipeClass("exit"), "farm-chart-clip-wipe-out");
  assert.equal(clipWipeClass("shown"), undefined);
}

{
  assert.equal(shouldPreferLookbackPinch(0), false);
  assert.equal(shouldPreferLookbackPinch(1), false);
  assert.equal(shouldPreferLookbackPinch(2), true);
  assert.equal(shouldPreferLookbackPinch(3), true);
}

console.log("trend-chart-interaction.test.ts ok");
