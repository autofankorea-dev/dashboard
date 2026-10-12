/**
 * 실행: node node_modules/tsx/dist/cli.mjs src/components/trends/trend-chart-hit.test.ts
 */
import assert from "node:assert/strict";
import type { TrendSeries } from "@/lib/domain/trend-chart-types";
import { findTrendDataPointHit } from "./trend-chart-hit";

const series: TrendSeries[] = [
  {
    name: "온도",
    color: "#000",
    data: [10, null],
  },
];

const hit = findTrendDataPointHit({
  xPx: 20,
  yPx: 30,
  plotW: 100,
  plotH: 100,
  markerRadiusPx: 2,
  eventLane: false,
  eventLaneH: 0,
  eventLaneTop: 80,
  chartH: 100,
  innerW: 80,
  innerH: 60,
  n: 2,
  viewW: 100,
  mode: "line",
  series,
  histograms: [],
  barW: 4,
  barSlotW: 8,
  padTop: 8,
  yFor: () => 30,
  xFor: (i) => (i === 0 ? 20 : 80),
  xForBar: (i) => i,
  xAtIndex: (i) => (i === 0 ? 20 : 80),
  markerRy: () => 2,
  positionedEventMarks: [],
});

assert.equal(hit?.idx, 0);
assert.equal(hit?.seriesKey, "온도");
assert.equal(
  findTrendDataPointHit({
    xPx: 0,
    yPx: 0,
    plotW: 0,
    plotH: 10,
    markerRadiusPx: 2,
    eventLane: false,
    eventLaneH: 0,
    eventLaneTop: 0,
    chartH: 100,
    innerW: 80,
    innerH: 60,
    n: 2,
    viewW: 100,
    mode: "line",
    series,
    histograms: [],
    barW: 4,
    barSlotW: 8,
    padTop: 8,
    yFor: () => 30,
    xFor: () => 20,
    xForBar: () => 0,
    xAtIndex: () => 20,
    markerRy: () => 2,
    positionedEventMarks: [],
  }),
  null,
);

console.log("trend-chart-hit.test.ts ok");
