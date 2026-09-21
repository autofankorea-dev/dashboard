import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandCompactControllerPeriod,
  overlayCompactControllerPeriod,
  seedCompact30dFrom24h,
  synthesizeOverview30dFrom7d,
  type CompactControllerPeriod,
} from "./farm-trend-compact";
import { TREND_PERIODS } from "./farm-trend-types";

describe("expandCompactControllerPeriod", () => {
  it("rebuilds a dense axis and sparse samples", () => {
    const fromMs = Date.UTC(2026, 7, 1, 0, 0, 0);
    const compact: CompactControllerPeriod = {
      v: 1,
      period: "24h",
      fromMs,
      bucketCount: TREND_PERIODS["24h"].bucketCount,
      strideMs: TREND_PERIODS["24h"].strideMs,
      totalSamples: 3,
      series: [
        {
          ty: "SP02",
          lb: "임신사",
          sn: "1",
          k: "SP02:1:01",
          e: "01",
          p: [
            [0, 20.5, 60, null, 10, null, null, null, null, 2],
            [2, 21, 61, null, 12, null, null, null, null, 1],
          ],
        },
      ],
    };
    const out = expandCompactControllerPeriod(compact);
    assert.equal(out.period, "24h");
    assert.equal(out.categories.length, 96);
    assert.equal(out.bucketAts.length, 96);
    assert.equal(out.totalSamples, 3);
    const ctrl = out.sp[0]!.stalls[0]!.controllers[0]!;
    assert.equal(ctrl.temp[0], 20.5);
    assert.equal(ctrl.temp[1], null);
    assert.equal(ctrl.temp[2], 21);
    assert.equal(ctrl.sampleCount[0], 2);
    assert.equal(ctrl.humidity[2], 61);
  });

  it("hold-forwards sparse channel thermo", () => {
    const fromMs = Date.UTC(2026, 7, 1, 0, 0, 0);
    const compact: CompactControllerPeriod = {
      v: 1,
      period: "24h",
      fromMs,
      bucketCount: TREND_PERIODS["24h"].bucketCount,
      strideMs: TREND_PERIODS["24h"].strideMs,
      totalSamples: 1,
      series: [
        {
          ty: "SP02",
          lb: "임신사",
          sn: "1",
          k: "SP02:1:01",
          e: "01",
          p: [[1, 20, null, null, null, null, null, null, null, 1]],
          th: [[1, 24, 5, 10, 90, 2, 4, 20, 80, 3, 3, 30, 70]],
        },
      ],
    };
    const ctrl = expandCompactControllerPeriod(compact).sp[0]!.stalls[0]!
      .controllers[0]!;
    assert.equal(ctrl.thermoA?.setpoint[0], null);
    assert.equal(ctrl.thermoA?.setpoint[1], 24);
    assert.equal(ctrl.thermoA?.setpoint[2], 24);
    assert.equal(ctrl.thermoB?.setpoint[2], 2);
    assert.equal(ctrl.thermoC?.maxVent[2], 70);
  });

  it("does not allocate sample rows for empty series list", () => {
    const out = expandCompactControllerPeriod({
      v: 1,
      period: "7d",
      fromMs: 0,
      bucketCount: TREND_PERIODS["7d"].bucketCount,
      strideMs: TREND_PERIODS["7d"].strideMs,
      totalSamples: 0,
      series: [],
    });
    assert.equal(out.sp.length, 0);
    assert.equal(out.categories.length, 168);
  });
});

describe("synthesizeOverview30dFrom7d", () => {
  it("puts 7 daily averages into the last 7 of 30 slots", () => {
    const n = TREND_PERIODS["7d"].bucketCount;
    const d7 = expandCompactControllerPeriod({
      v: 1,
      period: "7d",
      fromMs: Date.UTC(2026, 7, 12, 0, 0, 0),
      bucketCount: n,
      strideMs: TREND_PERIODS["7d"].strideMs,
      totalSamples: 2,
      series: [
        {
          ty: "SP02",
          lb: "임신사",
          sn: "1",
          k: "k1",
          e: "01",
          p: [
            [0, 10, null, null, null, null, null, null, null, 1],
            [n - 1, 20, null, null, null, null, null, null, null, 1],
          ],
          th: [[0, 24, 5, 10, 90, 2, 4, 20, 80, 3, 3, 30, 70]],
        },
      ],
    });
    const overview = synthesizeOverview30dFrom7d(d7);
    assert.equal(overview.categories.length, 30);
    const ctrl = overview.sp[0]!.stalls[0]!.controllers[0]!;
    assert.equal(ctrl.temp[0], null);
    assert.equal(ctrl.temp[22], null);
    assert.equal(ctrl.temp[23], 10);
    assert.equal(ctrl.temp[29], 20);
    assert.equal(ctrl.thermoA?.setpoint[23], 24);
    assert.equal(ctrl.thermoA?.setpoint[29], 24);
    assert.equal(ctrl.thermoB?.setpoint[29], 2);
  });
});

describe("seedCompact30dFrom24h + overlayCompactControllerPeriod", () => {
  const h24From = Date.UTC(2026, 8, 20, 0, 0, 0);
  const axisFromMs =
    h24From + TREND_PERIODS["24h"].durationMs - TREND_PERIODS["30d"].durationMs;

  it("puts 24h 15m averages on the rightmost 24 hourly slots", () => {
    const h24: CompactControllerPeriod = {
      v: 1,
      period: "24h",
      fromMs: h24From,
      bucketCount: TREND_PERIODS["24h"].bucketCount,
      strideMs: TREND_PERIODS["24h"].strideMs,
      totalSamples: 4,
      series: [
        {
          ty: "SP07",
          lb: "비육사",
          sn: "1",
          k: "k1",
          e: "01",
          p: [
            [0, 10, 40, null, null, null, null, null, null, 1],
            [1, 20, 50, null, null, null, null, null, null, 1],
            [2, 30, 60, null, null, null, null, null, null, 1],
            [3, 40, 70, null, null, null, null, null, null, 1],
          ],
        },
      ],
    };
    const seeded = seedCompact30dFrom24h(h24, axisFromMs);
    assert.equal(seeded.period, "30d");
    assert.equal(seeded.bucketCount, 720);
    assert.equal(seeded.fromMs, axisFromMs);
    const firstHour = seeded.series[0]!.p[0]!;
    assert.equal(firstHour[0], 696);
    assert.equal(firstHour[1], 25);
    assert.equal(firstHour[2], 55);
    assert.equal(firstHour[9], 4);
  });

  it("overlays a later day without clearing the seeded tail", () => {
    const seeded = seedCompact30dFrom24h(
      {
        v: 1,
        period: "24h",
        fromMs: h24From,
        bucketCount: TREND_PERIODS["24h"].bucketCount,
        strideMs: TREND_PERIODS["24h"].strideMs,
        totalSamples: 1,
        series: [
          {
            ty: "SP07",
            lb: "비육사",
            sn: "1",
            k: "k1",
            e: "01",
            p: [[92, 18, null, null, null, null, null, null, null, 1]],
          },
        ],
      },
      axisFromMs,
    );
    const older: CompactControllerPeriod = {
      v: 1,
      period: "30d",
      fromMs: axisFromMs,
      bucketCount: 720,
      strideMs: TREND_PERIODS["30d"].strideMs,
      totalSamples: 2,
      series: [
        {
          ty: "SP07",
          lb: "비육사",
          sn: "1",
          k: "k1",
          e: "01",
          p: [[0, 11, null, null, null, null, null, null, null, 2]],
        },
      ],
    };
    const merged = overlayCompactControllerPeriod(seeded, older);
    const slots = merged.series[0]!.p.map((p) => p[0]).sort((a, b) => a - b);
    assert.deepEqual(slots, [0, 719]);
    const bySlot = new Map(merged.series[0]!.p.map((p) => [p[0], p[1]]));
    assert.equal(bySlot.get(0), 11);
    assert.equal(bySlot.get(719), 18);
  });
});
