import { test } from "vitest";
/**
 * 실행: npx vitest run src/lib/farm/trend-chart-layout.test.ts
 * trend-chart.tsx에서 추출한 레이아웃 순수 함수의 characterization 테스트.
 */
import assert from "node:assert/strict";
import {
  buildAxisTickViews,
  buildLeftAxisTicks,
  collectUniqueAlarmBands,
  computeBarLayout,
  dedupeReferenceLines,
  plotXForBar,
  plotXForIndex,
  plotXForMs,
  plotYForValue,
  positionCommandSettingHits,
  positionEventMarks,
  type TrendPlotXScale,
} from "@/lib/farm/trend-chart-layout";
import { PAD_TOP } from "@/lib/farm/trend-chart-geometry";
import type {
  TrendCommandSettingSeg,
  TrendEventLane,
  TrendEventMark,
  TrendRangeBand,
  TrendReferenceLine,
  TrendSeries,
} from "@/lib/domain/trend-chart-types";

const near = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

// plotYForValue — 도메인 하한=바닥, 상한=PAD_TOP, 비유한=바닥
{
  const innerH = 100;
  assert.equal(plotYForValue(0, [0, 50], innerH), PAD_TOP + innerH);
  assert.equal(plotYForValue(50, [0, 50], innerH), PAD_TOP);
  assert.equal(plotYForValue(25, [0, 50], innerH), PAD_TOP + 50);
  assert.equal(plotYForValue(NaN, [0, 50], innerH), PAD_TOP + innerH);
  assert.equal(plotYForValue(10, [NaN, 50], innerH), PAD_TOP + innerH);
  // 퇴화 도메인(mn===mx) — 0 나눗셈 방지 (mx-mn||1)
  assert.equal(plotYForValue(7, [5, 5], innerH), PAD_TOP + innerH - 2 * innerH);
}

// plotXForIndex / plotXForMs
{
  const even: TrendPlotXScale = { n: 5, timeAxisMs: null, padL: 10, innerW: 80 };
  assert.equal(plotXForIndex(0, even), 10);
  assert.equal(plotXForIndex(4, even), 90);
  assert.equal(plotXForIndex(2, even), 50);
  assert.equal(plotXForMs(123, even), null);

  const single: TrendPlotXScale = { n: 1, timeAxisMs: [1000], padL: 10, innerW: 80 };
  assert.equal(plotXForIndex(0, single), 50);
  assert.equal(plotXForMs(0, single), 50);

  // 불균등 시간축 — 시간 비례 배치
  const t: TrendPlotXScale = {
    n: 3,
    timeAxisMs: [0, 1000, 4000],
    padL: 10,
    innerW: 80,
  };
  assert.equal(plotXForIndex(0, t), 10);
  assert.equal(plotXForIndex(1, t), 30);
  assert.equal(plotXForIndex(2, t), 90);
  assert.equal(plotXForMs(2000, t), 50);
  // 구간 앞은 null(미표시), 구간 뒤는 우측 끝 클램프 — trendMsToPlotX 계약
  assert.equal(plotXForMs(-1000, t), null);
  assert.equal(plotXForMs(9000, t), 90);

  // 시간축 길이 불일치/span 0 → 등간격 폴백
  const mismatch: TrendPlotXScale = { n: 3, timeAxisMs: [0, 1], padL: 10, innerW: 80 };
  assert.equal(plotXForIndex(1, mismatch), 50);
  assert.equal(plotXForMs(0, mismatch), null);
  const flat: TrendPlotXScale = { n: 3, timeAxisMs: [5, 5, 5], padL: 10, innerW: 80 };
  assert.equal(plotXForIndex(1, flat), 50);
}

// buildLeftAxisTicks
{
  const base = { show: true, chartH: 112, innerH: 100, unit: "℃" } as const;
  assert.deepEqual(buildLeftAxisTicks({ ...base, domain: [0, 40], mode: "ends" }).map((t) => t.id), [
    "left-axis-0",
    "left-axis-1",
  ]);
  const thirds = buildLeftAxisTicks({ ...base, domain: [0, 40], mode: "thirds" });
  assert.equal(thirds.length, 3);
  assert.deepEqual(
    thirds.map((t) => t.text),
    [0, 20, 40].map((v) => `${v}℃`),
  );
  near(thirds[0]!.topPct, ((PAD_TOP + 100) / 112) * 100);
  near(thirds[2]!.topPct, (PAD_TOP / 112) * 100);
  assert.equal(buildLeftAxisTicks({ ...base, domain: [0, 40], mode: "full" }).length, 5);
  assert.deepEqual(buildLeftAxisTicks({ ...base, show: false, domain: [0, 40], mode: "full" }), []);
  assert.deepEqual(buildLeftAxisTicks({ ...base, domain: [5, 5], mode: "full" }), []);
  assert.deepEqual(buildLeftAxisTicks({ ...base, domain: [NaN, 5], mode: "full" }), []);
}

const mark = (id: string, atMs: number, row: number): TrendEventMark =>
  ({ id, atMs, row }) as TrendEventMark;

// positionEventMarks
{
  const lane: TrendEventLane = {
    label: "명령",
    rowLabels: ["A", "B"],
    emptyLabel: "없음",
    marks: [mark("a", 0, 0), mark("b", 2000, 1), mark("c", 1000, 9), mark("skip", 5, -1)],
  };
  const xForMs = (ms: number) => (ms === 5 ? null : 10 + ms / 25);
  const out = positionEventMarks(lane, { eventLaneH: 20, eventLaneTop: 100 }, xForMs);
  assert.deepEqual(
    out.map((p) => [p.mark.id, p.xView, p.yView]),
    [
      ["a", 10, 105],
      ["b", 90, 115],
      ["c", 50, 115], // row 9 → rows-1 클램프
    ],
  );
  assert.deepEqual(positionEventMarks(null, { eventLaneH: 20, eventLaneTop: 0 }, xForMs), []);
  assert.deepEqual(positionEventMarks(lane, { eventLaneH: 0, eventLaneTop: 0 }, xForMs), []);
}

// positionCommandSettingHits
{
  const seg = (x0Ms: number, x1Ms: number, yLo: number, yHi: number): TrendCommandSettingSeg =>
    ({ mark: mark("m", x0Ms, 0), x0Ms, x1Ms, yLo, yHi }) as TrendCommandSettingSeg;
  const xForMs = (ms: number) => (ms < 0 ? null : ms / 10);
  const yForLeft = (v: number) => (Number.isFinite(v) ? 100 - v : NaN);
  const out = positionCommandSettingHits(
    [
      seg(100, 300, 20, 30), // 정상
      seg(300, 100, 30, 20), // 역순 → 정렬
      seg(-1, 200, 10, 10.5), // x0 null → xMin, 높이 최소 2
      seg(100, 102, 0, 1), // 폭 0.2 ≤ 0.3 → 제외
      seg(100, 300, NaN, 5), // Y 비유한 → 제외
      seg(900, 2000, 0, 10), // xMax 클램프
    ],
    { xMin: 5, xMax: 95 },
    xForMs,
    yForLeft,
  );
  assert.deepEqual(
    out.map((h) => [h.x0, h.x1, h.y, h.h]),
    [
      [10, 30, 70, 10],
      [10, 30, 70, 10],
      [5, 20, 89.5, 2],
      [90, 95, 90, 10],
    ],
  );
  assert.deepEqual(positionCommandSettingHits([], { xMin: 0, xMax: 1 }, xForMs, yForLeft), []);
}

// computeBarLayout / plotXForBar
{
  const l4 = computeBarLayout({ mode: "bar", n: 4, innerW: 80, seriesCount: 2, barWidthCapPct: null });
  assert.equal(l4.barGroupW, 20);
  near(l4.barW, 7);
  near(l4.barSlotW, 14);
  assert.equal(l4.barCenterCluster, true);

  const capped = computeBarLayout({ mode: "bar", n: 4, innerW: 80, seriesCount: 2, barWidthCapPct: 3 });
  assert.equal(capped.barW, 3);
  assert.equal(capped.barSlotW, 6);

  const l5 = computeBarLayout({ mode: "bar", n: 5, innerW: 80, seriesCount: 0 });
  assert.equal(l5.barCenterCluster, false);
  near(l5.barW, 16 * 0.7);
  near(l5.barSlotW, 16 * 0.7);
  assert.equal(computeBarLayout({ mode: "line", n: 2, innerW: 80, seriesCount: 1 }).barCenterCluster, false);
  assert.equal(computeBarLayout({ mode: "bar", n: 0, innerW: 80, seriesCount: 1 }).barGroupW, 80);

  const scale: TrendPlotXScale = { n: 4, timeAxisMs: null, padL: 10, innerW: 80 };
  const xFor = (i: number) => plotXForIndex(i, scale);
  // 클러스터: spacing = min(max(14*1.25, 80/6), 80/3) = min(max(17.5,13.33), 26.67) = 17.5
  near(plotXForBar(0, l4, scale, xFor), 50 - 26.25);
  near(plotXForBar(3, l4, scale, xFor), 50 + 26.25);
  near(plotXForBar(1, l4, scale, xFor), 50 - 26.25 + 17.5);
  // 비클러스터 → xFor 위임
  const scale5: TrendPlotXScale = { n: 5, timeAxisMs: null, padL: 10, innerW: 80 };
  assert.equal(plotXForBar(2, l5, scale5, (i) => plotXForIndex(i, scale5)), 50);
  // n<=1 → 중앙
  const scale1: TrendPlotXScale = { n: 1, timeAxisMs: null, padL: 10, innerW: 80 };
  assert.equal(plotXForBar(0, computeBarLayout({ mode: "bar", n: 1, innerW: 80, seriesCount: 1 }), scale1, xFor), 50);
}

// collectUniqueAlarmBands / dedupeReferenceLines
{
  const s = (name: string, band: { lo: number; hi: number } | null, axis?: "left" | "right", color = "#000"): TrendSeries =>
    ({ name, data: [], band, axis, color }) as unknown as TrendSeries;
  const series = [
    s("t1", { lo: 10, hi: 30 }),
    s("t2", { lo: 10, hi: 30 }, "left", "#111"), // 중복 → 제외
    s("h1", { lo: 10, hi: 30 }, "right", "#222"), // 다른 축 → 포함
    s("none", null),
  ];
  const ranges: TrendRangeBand[] = [
    { id: "r1", lo: 0, hi: 5, color: "#333", fillOpacity: 0.2 },
    { id: "r2", lo: 1, hi: 2, axis: "right", color: "#444" },
  ];
  const bands = collectUniqueAlarmBands(series, ranges);
  assert.deepEqual(bands, [
    { band: { lo: 10, hi: 30 }, axis: "left", color: "#000", fillWindow: false },
    { band: { lo: 10, hi: 30 }, axis: "right", color: "#222", fillWindow: false },
    { id: "r1", band: { lo: 0, hi: 5 }, axis: "left", color: "#333", fillWindow: true, fillOpacity: 0.2 },
    { id: "r2", band: { lo: 1, hi: 2 }, axis: "right", color: "#444", fillWindow: true, fillOpacity: undefined },
  ]);

  const refs: TrendReferenceLine[] = [
    { value: 30, color: "a" }, // left hi 중복 → 제거
    { value: 30 + 1e-7, color: "b" }, // 1e-6 이내 → 제거
    { value: 20, color: "c" }, // 유지
    { value: 2, axis: "right", color: "d" }, // right r2 hi → 제거
    { value: 5, axis: "right", color: "e" }, // 5는 left 밴드 → right에선 유지
  ];
  assert.deepEqual(
    dedupeReferenceLines(refs, bands).map((r) => r.color),
    ["c", "e"],
  );
  // 밴드 없으면 동일 참조 반환
  assert.equal(dedupeReferenceLines(refs, []), refs);
}

// buildAxisTickViews
{
  const ticks = [
    { t: 0, fullLabel: "10/01 00:00" },
    { t: 0.5, fullLabel: "10/01 12:00" },
    { t: 1, fullLabel: "10/02 00:00" },
  ];
  const noPeriod = buildAxisTickViews(ticks, { period: undefined, padL: 10, innerW: 80, viewW: 100 });
  assert.deepEqual(
    noPeriod.map((v) => [v.key, v.leftPct, v.parts]),
    [
      ["0-10/01 00:00", 10, { date: null, time: "10/01 00:00" }],
      ["1-10/01 12:00", 50, { date: null, time: "10/01 12:00" }],
      ["2-10/02 00:00", 90, { date: null, time: "10/02 00:00" }],
    ],
  );
  assert.equal(buildAxisTickViews(ticks, { period: undefined, padL: 10, innerW: 80, viewW: 0 })[1]!.leftPct, 0);

  const withPeriod = buildAxisTickViews(ticks, { period: "24h", padL: 10, innerW: 80, viewW: 100 });
  assert.equal(withPeriod.length, 3);
  // 날짜가 바뀌는 눈금(2번째→3번째)에는 date 파트가 붙고, 같은 날 이어지는 눈금은 time만
  assert.equal(withPeriod[1]!.parts.date, null);
  assert.notEqual(withPeriod[2]!.parts.date, null);
  assert.deepEqual(buildAxisTickViews([], { period: "24h", padL: 10, innerW: 80, viewW: 100 }), []);
}

console.log("trend-chart-layout.test.ts: ok");

test("module asserts", () => {
  // node:assert 호출은 이 파일을 불러올 때 이미 실행된다.
});
