/**
 * 실행: npx tsx src/components/trends/trend-chart-geometry.test.ts
 */
import assert from "node:assert/strict";
import {
  buildEnvelopePaths,
  buildLineSegments,
  computeTipPlacement,
  domainFor,
  finiteValues,
  markerRadiusInViewUnits,
  mergeOverlappingTempHumEdgeLabels,
  nudgeEdgeLabelTops,
  stackLeftAlarmBaselineLabels,
  PAD_BOTTOM,
  PAD_TOP,
  parseScaleEdgeEditSeed,
  parseScaleEdgeValueUnit,
  tipPinId,
  trendPlotPadPx,
  trendPlotPadRatios,
  trendTimeToPlotRatio,
  trendMsToPlotX,
  trendChartHasRenderableContent,
  xScopeTouchesCommandLane,
  interpolateTimelineMsFromXView,
  formatCrosshairClock,
  chartDomainYFromViewY,
  crosshairChipFlipsRight,
  type EdgeBandLabel,
} from "./trend-chart-geometry";
import { inferHoverMetricGroup } from "./trend-chart-format";
import type {
  TrendEnvelope,
  TrendSeries,
} from "@/lib/data/trend-chart-types";

// 좌표 매퍼 스텁 — 인덱스=x, 값=y (axis 무시).
const xForId = (i: number) => i;
const yForId = (v: number) => v;

// 첫 확대 1×1 측정값은 fallback view 크기를 사용해 marker를 px 크기로 유지.
assert.equal(markerRadiusInViewUnits(1.6, 100, 1, 32), 1.6);
assert.ok(Math.abs(markerRadiusInViewUnits(1.6, 48, 1, 8) - 1.6) < 1e-9);
// 실제 크기를 측정한 뒤에는 preserveAspectRatio=none 비율로 변환.
assert.equal(markerRadiusInViewUnits(2, 100, 200, 32), 1);

// domainFor: forced 우선, 빈 배열 fallback, 동일값 확장, 패딩.
assert.deepEqual(domainFor([1, 2, 3], [0, 10]), [0, 10]);
assert.deepEqual(domainFor([], undefined), [0, 1]);
{
  // 동일값 → ±1 확장 후 패딩까지 적용.
  const [lo, hi] = domainFor([5, 5], undefined);
  assert.ok(lo < 4 && hi > 6, "동일값은 확장+패딩으로 넓혀야 함");
}
{
  const [lo, hi] = domainFor([0, 10], undefined);
  assert.ok(lo < 0 && hi > 10, "패딩이 양끝을 넓혀야 함");
}

// finiteValues: 축 필터 + null/NaN 제거.
const series: TrendSeries[] = [
  { name: "a", data: [1, null, 3], color: "#000", axis: "left" },
  { name: "b", data: [10, 20], color: "#111", axis: "right" },
  { name: "c", data: [Number.NaN, 5], color: "#222" }, // axis 미지정 → left
];
assert.deepEqual(finiteValues(series, "left"), [1, 3, 5]);

// 명령 Y밴드만: 시리즈 없어도 타임라인+레인 → 렌더 가능
assert.equal(
  trendChartHasRenderableContent({
    series: [],
    histograms: [],
    categoriesLength: 48,
    eventLaneActive: true,
  }),
  true,
);
assert.equal(
  trendChartHasRenderableContent({
    series: [],
    histograms: [],
    categoriesLength: 48,
    eventLaneActive: false,
  }),
  false,
);
assert.equal(
  trendChartHasRenderableContent({
    series: [{ data: [null, null] }],
    histograms: [],
    categoriesLength: 10,
    eventLaneActive: true,
  }),
  true,
);
assert.equal(
  trendChartHasRenderableContent({
    series: [{ data: [1, 2] }],
    histograms: [],
    categoriesLength: 0,
    eventLaneActive: false,
  }),
  true,
);
assert.deepEqual(finiteValues(series, "right"), [10, 20]);

// parseScaleEdgeValueUnit: 숫자 뒤 단위 접미.
assert.equal(parseScaleEdgeValueUnit("28.5℃"), "℃");
assert.equal(parseScaleEdgeValueUnit("+5℃"), "℃");
assert.equal(parseScaleEdgeValueUnit("100%"), "%");
assert.equal(parseScaleEdgeValueUnit("42"), "");

// parseScaleEdgeEditSeed: editValue 우선, 없으면 텍스트에서 숫자 추출.
assert.equal(parseScaleEdgeEditSeed({ editValue: 12.5, text: "x" }), "12.5");
assert.equal(parseScaleEdgeEditSeed({ editValue: undefined, text: "-3.2℃" }), "-3.2");
assert.equal(parseScaleEdgeEditSeed({ editValue: undefined, text: "n/a" }), "");

// tipPinId: idx + 추론 그룹.
assert.equal(tipPinId(3, "온도"), tipPinId(3, "온도"));
assert.ok(tipPinId(3, "온도").startsWith("3::"));

// computeTipPlacement: 플롯 경계 안에 클램프.
{
  const p = computeTipPlacement(10, 10, 400, 300);
  assert.ok(p.left >= 0 && p.left <= 400, "left in bounds");
  assert.ok(p.top >= 0 && p.top <= 300, "top in bounds");
}

// nudgeEdgeLabelTops: 같은 side 근접 라벨을 최소 간격으로 벌림.
{
  const labels: EdgeBandLabel[] = [
    { id: "1", side: "left", topPct: 10, text: "a", color: "#000", title: "a" },
    { id: "2", side: "left", topPct: 11, text: "b", color: "#000", title: "b" },
  ];
  const out = nudgeEdgeLabelTops(labels, 5);
  const tops = out.map((l) => l.topPct).sort((a, b) => a - b);
  assert.ok(tops[1]! - tops[0]! >= 5, "최소 간격 확보");
}

{
  const labels: EdgeBandLabel[] = [
    {
      id: "band-tick-temp-0",
      side: "left",
      topPct: 10,
      text: "29.0℃",
      color: "#000",
      title: "눈금",
    },
    {
      id: "band-tick-hum-0",
      side: "left",
      topPct: 10.4,
      text: "67%",
      color: "#000",
      title: "눈금",
    },
    {
      id: "temp-hi",
      side: "right",
      topPct: 20,
      text: "27℃",
      color: "#000",
      title: "온도 상한",
    },
    {
      id: "hum-hi",
      side: "right",
      topPct: 21,
      text: "65%",
      color: "#000",
      title: "습도 상한",
    },
    {
      id: "band-tick-motor-0",
      side: "left",
      topPct: 10.2,
      text: "100%",
      color: "#000",
      title: "눈금",
    },
  ];
  const merged = mergeOverlappingTempHumEdgeLabels(labels, 5.5);
  const left = merged.filter((l) => l.side === "left");
  const right = merged.filter((l) => l.side === "right");
  assert.equal(left.some((l) => l.text === "29.0℃, 67%"), true);
  assert.equal(left.some((l) => l.id === "band-tick-motor-0"), true);
  assert.equal(right.some((l) => l.text === "27℃, 65%"), true);
  assert.equal(right.some((l) => l.title === "온도, 습도"), true);
}

{
  const labels: EdgeBandLabel[] = [
    {
      id: "temp-farm-mid",
      side: "left",
      topPct: 40,
      text: "17.5℃",
      color: "#000",
      title: "온도 알람 기준",
    },
    {
      id: "hum-farm-mid",
      side: "left",
      topPct: 40.2,
      text: "50%",
      color: "#000",
      title: "습도 알람 기준",
    },
    {
      id: "temp-hi",
      side: "right",
      topPct: 20,
      text: "20℃",
      color: "#000",
      title: "권장 온도 상한",
    },
    {
      id: "hum-hi",
      side: "right",
      topPct: 20.4,
      text: "60%",
      color: "#000",
      title: "권장 습도 상한",
    },
  ];
  const merged = mergeOverlappingTempHumEdgeLabels(labels, 5.5);
  const left = merged.filter((l) => l.side === "left");
  const right = merged.filter((l) => l.side === "right");
  assert.equal(left.length, 2);
  assert.equal(left.some((l) => l.id === "temp-farm-mid" && l.text === "17.5℃"), true);
  assert.equal(left.some((l) => l.id === "hum-farm-mid" && l.text === "50%"), true);
  assert.equal(right.some((l) => l.text === "20℃, 60%"), true);
  const stacked = stackLeftAlarmBaselineLabels(merged, 8.5, true);
  const stackedLeft = stacked
    .filter((l) => l.side === "left")
    .sort((a, b) => a.topPct - b.topPct);
  assert.equal(stackedLeft[0]?.id, "temp-farm-mid");
  assert.equal(stackedLeft[1]?.id, "hum-farm-mid");
  assert.ok(
    stackedLeft[1]!.topPct - stackedLeft[0]!.topPct >= 8.5 - 1e-6,
    "온·습 기준 세로 간격",
  );
  const splitKept = stackLeftAlarmBaselineLabels(
    [
      {
        id: "temp-farm-mid",
        side: "left",
        topPct: 22,
        text: "17.5℃",
        color: "#000",
        title: "온도 알람 기준",
      },
      {
        id: "hum-farm-mid",
        side: "left",
        topPct: 58,
        text: "50%",
        color: "#000",
        title: "습도 알람 기준",
      },
    ],
    8.5,
  );
  assert.equal(
    splitKept.find((l) => l.id === "temp-farm-mid")?.topPct,
    22,
  );
  assert.equal(
    splitKept.find((l) => l.id === "hum-farm-mid")?.topPct,
    58,
  );
}

// buildLineSegments: null에서 세그먼트가 끊긴다.
{
  const s: TrendSeries = {
    name: "t",
    data: [1, 2, null, 4, 5],
    color: "#000",
  };
  const segs = buildLineSegments(s, xForId, yForId);
  assert.equal(segs.length, 2, "null 기준 2개 세그먼트");
  assert.equal(segs[0], "0.00,1.00 1.00,2.00");
  assert.equal(segs[1], "3.00,4.00 4.00,5.00");
}
// 단일 포인트 세그먼트(길이 1)는 버려진다.
{
  const s: TrendSeries = { name: "t", data: [1, null, 3], color: "#000" };
  assert.deepEqual(buildLineSegments(s, xForId, yForId), []);
}

// buildEnvelopePaths: high/low 유효 구간을 닫힌 path로.
{
  const env: TrendEnvelope = {
    high: [2, 3, 4],
    low: [1, 1, 1],
  } as TrendEnvelope;
  const paths = buildEnvelopePaths(env, 3, xForId, yForId);
  assert.equal(paths.length, 1);
  assert.ok(paths[0]!.startsWith("M") && paths[0]!.endsWith("Z"));
}
// 길이 < 2 → 빈 배열.
{
  const env: TrendEnvelope = { high: [2], low: [1] } as TrendEnvelope;
  assert.deepEqual(buildEnvelopePaths(env, 1, xForId, yForId), []);
}

{
  const pc = trendPlotPadRatios({ leftUnit: true, labelGutter: false });
  assert.ok(Math.abs(pc.padL - 0.01) < 1e-12);
  assert.ok(Math.abs(pc.padR - 0.01) < 1e-12);
  assert.ok(Math.abs(pc.innerW - 0.98) < 1e-12);
  assert.ok(Math.abs(trendTimeToPlotRatio(0, { leftUnit: true }) - 0.01) < 1e-12);
  assert.ok(Math.abs(trendTimeToPlotRatio(1, { leftUnit: true }) - 0.99) < 1e-12);
  assert.ok(Math.abs(trendTimeToPlotRatio(0.5, { leftUnit: true }) - 0.5) < 1e-12);
  const mobile = trendPlotPadRatios({ leftUnit: true, labelGutter: true });
  assert.ok(Math.abs(mobile.padL - 0.01) < 1e-12);
  assert.ok(Math.abs(mobile.padR - 0.2) < 1e-12);
  assert.ok(Math.abs(mobile.innerW - 0.79) < 1e-12);
  assert.ok(
    Math.abs(trendTimeToPlotRatio(0.5, { leftUnit: true, labelGutter: true }) - 0.405) <
      1e-12,
  );
  const px = trendPlotPadPx(200, { leftUnit: true, labelGutter: false });
  assert.equal(px.padL, 2);
  assert.equal(px.padR, 2);
  assert.equal(px.innerW, 196);
  assert.equal(PAD_BOTTOM, 6);
  const t0 = Date.parse("2026-09-08T00:00:00.000Z");
  const t1 = Date.parse("2026-09-10T00:00:00.000Z");
  const mid = Date.parse("2026-09-09T00:00:00.000Z");
  assert.equal(trendMsToPlotX(mid, t0, t1, 6, 88), 50);
  assert.equal(trendMsToPlotX(t0, t0, t1, 6, 88), 6);
  assert.equal(trendMsToPlotX(t1, t0, t1, 6, 88), 94);
  assert.equal(trendMsToPlotX(t0 - 1, t0, t1, 6, 88), null);
  assert.equal(trendMsToPlotX(t1 + 1, t0, t1, 6, 88), 94);
}

assert.equal(xScopeTouchesCommandLane(0.2, 0.8), false);
assert.equal(xScopeTouchesCommandLane(0.9, 1.0), false);
assert.equal(xScopeTouchesCommandLane(0.5, 1.05), true);
assert.equal(xScopeTouchesCommandLane(1.2, 1.4), true);

assert.equal(inferHoverMetricGroup("채널 A 설정"), "temp");
assert.equal(inferHoverMetricGroup("채널 B 설정"), "temp");
assert.equal(inferHoverMetricGroup("채널 A 환기"), "motor");
assert.equal(inferHoverMetricGroup("온도 설정 변경"), "temp");
assert.equal(inferHoverMetricGroup("환기 설정 변경"), "motor");
assert.equal(inferHoverMetricGroup("채널 A"), "motor");
assert.equal(inferHoverMetricGroup("온도 산포"), "temp");
assert.equal(inferHoverMetricGroup("습도 산포"), "hum");

{
  const ms = interpolateTimelineMsFromXView(50, 10, 80, [0, 10_000], 2);
  assert.equal(ms, 5_000);
  assert.equal(interpolateTimelineMsFromXView(10, 10, 80, [100, 200], 2), 100);
  assert.equal(interpolateTimelineMsFromXView(90, 10, 80, [100, 200], 2), 200);
  assert.equal(interpolateTimelineMsFromXView(50, 10, 80, null, 2), null);
}

{
  const t = new Date(2026, 8, 17, 9, 40).getTime();
  assert.equal(formatCrosshairClock(t), "09:40");
  assert.equal(formatCrosshairClock(t, { withDate: true }), "9/17 09:40");
}

{
  const innerH = 100;
  assert.equal(chartDomainYFromViewY(PAD_TOP, PAD_TOP, innerH, [0, 100]), 100);
  assert.equal(
    chartDomainYFromViewY(PAD_TOP + innerH, PAD_TOP, innerH, [0, 100]),
    0,
  );
  assert.equal(
    chartDomainYFromViewY(PAD_TOP + innerH / 2, PAD_TOP, innerH, [0, 100]),
    50,
  );
  assert.equal(
    chartDomainYFromViewY(PAD_TOP + innerH + 8, PAD_TOP, innerH, [0, 100]),
    null,
  );
}

assert.equal(crosshairChipFlipsRight(20, 12, 40, 8), true);
assert.equal(crosshairChipFlipsRight(80, 12, 40, 8), false);

console.log("trend-chart-geometry.test.ts: ok");
