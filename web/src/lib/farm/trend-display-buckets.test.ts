import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  abbreviateTrendAxisLabel,
  formatTrendScopeRangeLabel,
  parseTrendAxisMdLabel,
  parseCategoryTimelineMs,
  downsampleColumnsForChart,
  pickLttbIndices,
  targetChartDisplayBars,
  tickEveryForDisplayBars,
  formatTrendAxisTickLines,
  trendChartTickTargetForWidth,
  buildTrendTickIndices,
  thinTrendTicksByMinGapPx,
  thinBrushTicksByMinGapPx,
  buildBrushAlignedAxisTicks,
  buildTrendAxisMarks,
} from "./trend-display-buckets";

describe("parseTrendAxisMdLabel", () => {
  it("parses M/D and M/D HH and M/D HH:mm", () => {
    assert.deepEqual(parseTrendAxisMdLabel("7/1"), { month: 7, day: 1 });
    assert.deepEqual(parseTrendAxisMdLabel("12/31 14"), {
      month: 12,
      day: 31,
    });
    assert.deepEqual(parseTrendAxisMdLabel("8/4 14:30"), {
      month: 8,
      day: 4,
    });
  });
});

describe("abbreviateTrendAxisLabel", () => {
  it("24h: endpoint full, middle hour", () => {
    assert.equal(
      abbreviateTrendAxisLabel("24h", "09:30", { endpoint: true }),
      "09:30",
    );
    assert.equal(
      abbreviateTrendAxisLabel("24h", "09:30", { endpoint: false }),
      "09",
    );
  });

  it("24h: M/D HH:mm → HH:mm / HH (no month on ticks)", () => {
    assert.equal(
      abbreviateTrendAxisLabel("24h", "8/10 16:20", { endpoint: true }),
      "16:20",
    );
    assert.equal(
      abbreviateTrendAxisLabel("24h", "8/10 19:20", {
        endpoint: false,
        prevLabel: "8/10 16:20",
      }),
      "19",
    );
    assert.equal(
      abbreviateTrendAxisLabel("24h", "8/11 01:20", {
        endpoint: false,
        prevLabel: "8/10 22:20",
      }),
      "8/11 01",
    );
    assert.equal(
      abbreviateTrendAxisLabel("24h", "8/11 15:20", { endpoint: true }),
      "15:20",
    );
  });

  it("30d: month boundary → N월, else day", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/1", {
        endpoint: false,
        prevLabel: "6/28",
      }),
      "7월",
    );
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/15", {
        endpoint: false,
        prevLabel: "7/8",
      }),
      "15",
    );
  });

  it("30d: month change on a non-1st keeps M/D", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "8/6", {
        endpoint: false,
        prevLabel: "7/30",
      }),
      "8/6",
    );
  });

  it("30d: first tick mid-month keeps M/D", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "7/15", {
        endpoint: true,
        prevLabel: null,
      }),
      "7/15",
    );
  });

  it("30d: first tick on day 1 → N월", () => {
    assert.equal(
      abbreviateTrendAxisLabel("30d", "8/1", {
        endpoint: true,
        prevLabel: null,
      }),
      "8월",
    );
  });

  it("7d: same month/day policy (hours dropped on tick)", () => {
    assert.equal(
      abbreviateTrendAxisLabel("7d", "7/1 00", {
        endpoint: false,
        prevLabel: "6/30 18",
      }),
      "7월",
    );
    assert.equal(
      abbreviateTrendAxisLabel("7d", "7/3 12", {
        endpoint: true,
        prevLabel: "7/1 00",
      }),
      "3",
    );
  });
});

describe("formatTrendScopeRangeLabel", () => {
  it("same month omits end month", () => {
    assert.equal(formatTrendScopeRangeLabel("8/3", "8/5"), "8/3 ~ 5");
    assert.equal(formatTrendScopeRangeLabel("8/3 14", "8/5 09"), "8/3 14 ~ 5 09");
  });

  it("different month keeps both", () => {
    assert.equal(formatTrendScopeRangeLabel("7/28", "8/2"), "7/28 ~ 8/2");
  });

  it("24h keeps times", () => {
    assert.equal(formatTrendScopeRangeLabel("09:00", "15:30"), "09:00 ~ 15:30");
    assert.equal(
      formatTrendScopeRangeLabel("8/10 16:20", "8/11 15:20"),
      "16:20 ~ 15:20",
    );
  });
});

describe("tickEveryForDisplayBars", () => {
  it("targets ~8 ticks on wide charts", () => {
    assert.equal(tickEveryForDisplayBars(30), 4);
    assert.equal(Math.ceil(30 / tickEveryForDisplayBars(30)), 8);
  });

  it("targets ~6 ticks on compact charts", () => {
    assert.equal(tickEveryForDisplayBars(30, { compact: true }), 5);
    assert.equal(Math.ceil(30 / tickEveryForDisplayBars(30, { compact: true })), 6);
  });
});

describe("formatTrendAxisTickLines", () => {
  it("first 24h tick shows date, same day omits it", () => {
    assert.deepEqual(
      formatTrendAxisTickLines("24h", "8/10 16:20", { endpoint: true }),
      ["8/10 16:20"],
    );
    assert.deepEqual(
      formatTrendAxisTickLines("24h", "8/10 19:00", {
        endpoint: false,
        prevLabel: "8/10 16:20",
      }),
      ["19"],
    );
  });

  it("stacked 24h shows date once, then hour without :00", () => {
    assert.deepEqual(
      formatTrendAxisTickLines("24h", "8/10 16:20", {
        endpoint: true,
        stacked: true,
      }),
      ["8/10", "16:20"],
    );
    assert.deepEqual(
      formatTrendAxisTickLines("24h", "8/10 19:00", {
        endpoint: false,
        stacked: true,
        prevLabel: "8/10 16:20",
      }),
      ["19"],
    );
    assert.deepEqual(
      formatTrendAxisTickLines("24h", "8/11 01:00", {
        endpoint: false,
        stacked: true,
        prevLabel: "8/10 22:00",
      }),
      ["8/11", "01"],
    );
  });

  it("stacked 7d shows M/D and hour without minutes", () => {
    assert.deepEqual(
      formatTrendAxisTickLines("7d", "7/3 12", {
        endpoint: false,
        stacked: true,
      }),
      ["7/3", "12"],
    );
  });

  it("stacked 30d shows full M/D", () => {
    assert.deepEqual(
      formatTrendAxisTickLines("30d", "7/15", {
        endpoint: false,
        stacked: true,
        prevLabel: "7/8",
      }),
      ["7/15"],
    );
  });

  it("does not repeat the same calendar date", () => {
    assert.deepEqual(
      formatTrendAxisTickLines("30d", "7/15", {
        endpoint: false,
        stacked: true,
        prevLabel: "7/15",
      }),
      [],
    );
  });
});

describe("trendChartTickTargetForWidth", () => {
  it("caps stacked ticks on a phone-width plot", () => {
    assert.equal(trendChartTickTargetForWidth(360, { stacked: true }), 4);
    assert.equal(trendChartTickTargetForWidth(280, { stacked: true }), 3);
  });

  it("allows up to 8 ticks on a wide plot", () => {
    assert.equal(trendChartTickTargetForWidth(800), 8);
  });
});

describe("buildTrendTickIndices", () => {
  it("keeps first and last", () => {
    const idx = buildTrendTickIndices(96, 12, 8);
    assert.equal(idx[0], 0);
    assert.equal(idx[idx.length - 1], 95);
    assert.ok(idx.length <= 9);
  });
});

describe("thinTrendTicksByMinGapPx", () => {
  it("drops middle ticks that would collide", () => {
    const idx = thinTrendTicksByMinGapPx(
      [0, 1, 2, 3],
      (i) => i * 20,
      50,
    );
    assert.deepEqual(idx, [0, 3]);
  });
});

describe("thinBrushTicksByMinGapPx", () => {
  it("keeps first and last when middles collide", () => {
    const ticks = thinBrushTicksByMinGapPx(
      [
        { t: 0, fullLabel: "a" },
        { t: 0.2, fullLabel: "b" },
        { t: 0.4, fullLabel: "c" },
        { t: 1, fullLabel: "d" },
      ],
      (t) => t * 100,
      50,
    );
    assert.deepEqual(
      ticks.map((x) => x.fullLabel),
      ["a", "d"],
    );
  });
});

describe("buildBrushAlignedAxisTicks", () => {
  it("uses quarter-hour / on-the-hour ticks inside the brush", () => {
    const ticks = buildBrushAlignedAxisTicks(
      ["8/11 01:35", "8/11 03:00", "8/11 18:35"],
      5,
    );
    assert.ok(ticks.length >= 2 && ticks.length <= 5);
    for (const tick of ticks) {
      assert.match(tick.fullLabel, /^\d{1,2}\/\d{1,2} \d{2}:(00|15|30|45)$/);
    }
    assert.deepEqual(
      ticks.map((x) => x.fullLabel),
      ["8/11 06:00", "8/11 12:00", "8/11 18:00"],
    );
    assert.ok((ticks[0]?.t ?? 0) > 0);
    assert.ok((ticks[ticks.length - 1]?.t ?? 1) < 1);
  });

  it("wraps midnight onto local on-the-hour ticks", () => {
    const coarse = buildBrushAlignedAxisTicks(["22:00", "06:00"], 3);
    assert.deepEqual(
      coarse.map((x) => x.fullLabel),
      ["00:00", "03:00", "06:00"],
    );
    const finer = buildBrushAlignedAxisTicks(["22:00", "06:00"], 5);
    assert.deepEqual(
      finer.map((x) => x.fullLabel),
      ["22:00", "00:00", "02:00", "04:00", "06:00"],
    );
  });

  it("uses 15-minute ticks on a short window", () => {
    const ticks = buildBrushAlignedAxisTicks(
      ["8/11 10:07", "8/11 11:50"],
      8,
    );
    assert.equal(ticks[0]?.fullLabel, "8/11 10:15");
    assert.equal(ticks[ticks.length - 1]?.fullLabel, "8/11 11:45");
    for (const tick of ticks) {
      assert.match(tick.fullLabel, /:(00|15|30|45)$/);
    }
  });

  it("keeps weekly majors on the 7-day grid and does not force the brush end date", () => {
    const marks = buildTrendAxisMarks(
      ["7/23", "8/19"],
      4,
      new Date(2026, 7, 19),
    );
    const labels = marks.majors.map((x) => x.fullLabel);
    assert.deepEqual(labels, ["7/23", "7/30", "8/6", "8/13"]);
    assert.ok(!labels.includes("8/19"));
    assert.ok((marks.majors[marks.majors.length - 1]?.t ?? 1) < 0.9);
    assert.ok(marks.minors.length > 10);
    assert.ok(marks.minors.every((t) => t < 0.996));
  });
});

describe("parseCategoryTimelineMs", () => {
  it("keeps calendar order across midnight", () => {
    const ms = parseCategoryTimelineMs(["22:00", "00:00", "02:00"]);
    assert.ok(ms);
    assert.ok(ms![1]! > ms![0]!);
    assert.ok(ms![2]! > ms![1]!);
  });

  it("places 8/5 between 7/30 and 8/13", () => {
    const ms = parseCategoryTimelineMs(["7/23", "7/30", "8/5 17:15", "8/13", "8/19"]);
    assert.ok(ms);
    assert.ok(ms![2]! > ms![1]! && ms![2]! < ms![3]!);
  });
});

describe("targetChartDisplayBars", () => {
  it("keeps native 15m for a day or less", () => {
    assert.equal(targetChartDisplayBars(96, 1770), 96);
    assert.equal(targetChartDisplayBars(48, 800), 48);
  });

  it("caps 30d by plot pixels", () => {
    assert.equal(targetChartDisplayBars(2880, 800), 320);
    assert.equal(targetChartDisplayBars(2880, 1770), 708);
  });
});

describe("downsampleColumnsForChart", () => {
  it("keeps source when already under pixel budget", () => {
    const cats = ["a", "b", "c"];
    const cols = [[1, 2, 3]];
    const out = downsampleColumnsForChart(cats, cols, 800);
    assert.equal(out.categories.length, 3);
    assert.deepEqual(out.columns[0], [1, 2, 3]);
  });

  it("thins long series by LTTB", () => {
    const cats = Array.from({ length: 200 }, (_, i) => String(i));
    const vals = cats.map((_, i) => (i === 80 ? 99 : 1));
    const out = downsampleColumnsForChart(cats, [vals], 100);
    assert.ok(out.categories.length < 200);
    assert.ok(out.categories.length >= 32);
    assert.ok(out.columns[0]?.includes(99));
  });
});

describe("pickLttbIndices", () => {
  it("keeps first and last and a peak", () => {
    const values = Array.from({ length: 20 }, (_, i) =>
      i === 10 ? 100 : 1,
    );
    const idx = pickLttbIndices(values, 6);
    assert.equal(idx[0], 0);
    assert.equal(idx[idx.length - 1], 19);
    assert.equal(idx.length, 6);
    assert.ok(idx.includes(10));
  });
});
