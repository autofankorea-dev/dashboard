/**
 * 실행: npx tsx src/components/farm/unified-barn-trend-panel-helpers.test.ts
 */
import assert from "node:assert/strict";
import {
  alignBrushScoreSeries,
  binControllerWindowToStride,
  bucketAtsRangeMs,
  controllerWindowHasValues,
  farmAlarmMidValue,
  mapIndexWindowToSlice,
  pickSharedBrushOverviewKind,
  SCALE_EDGE_ALARM_KEY,
} from "./unified-barn-trend-panel-helpers";
import { TREND_MINI_STRIDE_MS, type TrendControllerSeries } from "@/lib/data/farm-trend-types";

{
  assert.equal(pickSharedBrushOverviewKind(true, false), "top");
  assert.equal(pickSharedBrushOverviewKind(false, true), "bottom");
  assert.equal(pickSharedBrushOverviewKind(true, true), "dual");
  assert.equal(pickSharedBrushOverviewKind(false, false), "farm");
}

{
  const aligned = alignBrushScoreSeries([80, 60], [90, 40, 10]);
  assert.equal(aligned.top.length, 3);
  assert.equal(aligned.bottom.length, 3);
  assert.equal(aligned.top[0], 80);
  assert.equal(aligned.top[2], null);
  assert.equal(aligned.bottom[2], 10);
}

{
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-hi"], "tempHigh");
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-farm-hi"], "tempHigh");
  assert.equal(SCALE_EDGE_ALARM_KEY["hum-farm-lo"], "humidityLow");
  assert.equal(SCALE_EDGE_ALARM_KEY["temp-farm-hi"], SCALE_EDGE_ALARM_KEY["temp-hi"]);
}

{
  assert.equal(farmAlarmMidValue(23, 27), 25);
  assert.equal(farmAlarmMidValue(55, 65), 60);
  assert.equal(farmAlarmMidValue(Number.NaN, 27), null);
}

{
  const n = 16;
  const fromMs = Date.UTC(2026, 8, 21, 0, 0, 0);
  const strideMs = 15 * 60 * 1000;
  const z = () => Array.from({ length: n }, () => null as number | null);
  const series: TrendControllerSeries = {
    stallNo: "1",
    controllerKey: "k",
    eqpmnNo: "01",
    temp: Array.from({ length: n }, (_, i) => (i < 8 ? 20 : 24)),
    humidity: z(),
    fanA: z(),
    fanB: z(),
    fanC: z(),
    fanSupply: z(),
    fanExhaust: z(),
    fanIntake: z(),
    sampleCount: Array.from({ length: n }, () => 1),
  };
  const binned = binControllerWindowToStride(
    {
      seriesList: [series],
      categories: Array.from({ length: n }, (_, i) => String(i)),
      bucketAts: Array.from({ length: n }, (_, i) =>
        new Date(fromMs + i * strideMs).toISOString(),
      ),
    },
    TREND_MINI_STRIDE_MS,
  );
  assert.equal(binned.categories.length, 2);
  assert.equal(binned.seriesList[0]!.temp[0], 20);
  assert.equal(binned.seriesList[0]!.temp[1], 24);
  assert.equal(binned.seriesList[0]!.sampleCount[0], 8);
}

{
  const empty: TrendControllerSeries = {
    stallNo: "1",
    controllerKey: "k",
    eqpmnNo: "01",
    temp: [null, null],
    humidity: [null, null],
    fanA: [null, null],
    fanB: [null, null],
    fanC: [null, null],
    fanSupply: [null, null],
    fanExhaust: [null, null],
    fanIntake: [null, null],
    sampleCount: [0, 0],
  };
  assert.equal(
    controllerWindowHasValues({
      seriesList: [empty],
      categories: ["a", "b"],
      bucketAts: ["t0", "t1"],
    }),
    false,
  );
  assert.equal(
    controllerWindowHasValues({
      seriesList: [{ ...empty, temp: [20, null] }],
      categories: ["a", "b"],
      bucketAts: ["t0", "t1"],
    }),
    true,
  );
}

{
  const slice = mapIndexWindowToSlice(24, 20, 23, 24);
  assert.equal(slice.from, 20);
  assert.equal(slice.to, 24);
  const fromMs = Date.UTC(2026, 8, 21, 0, 0, 0);
  const hour = 60 * 60 * 1000;
  const range = bucketAtsRangeMs(
    Array.from({ length: 24 }, (_, i) => new Date(fromMs + i * hour).toISOString()),
    20,
    24,
  );
  assert.equal(range?.fromMs, fromMs + 20 * hour);
  assert.equal(range?.toMs, fromMs + 24 * hour);
}

console.log("unified-barn-trend-panel-helpers.test.ts: ok");
