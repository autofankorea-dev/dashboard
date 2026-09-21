import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  controllerTrendPeriodHasSeries,
  emptyTrendControllerPeriodData,
  isCompleteControllerTrendBundle,
  isFarmTrendLoadComplete,
  pickTrendCanvasPeriod,
  TREND_30D_DAY_CHUNKS,
  type TrendControllerPeriodData,
} from "./farm-trend-types";

function axisOnly(
  period: TrendControllerPeriodData["period"],
  bucketCount: number,
): TrendControllerPeriodData {
  return {
    period,
    categories: Array.from({ length: bucketCount }, (_, i) => String(i)),
    bucketAts: [],
    sp: [],
    totalSamples: 0,
  };
}

function withSamples(
  period: TrendControllerPeriodData["period"],
  bucketCount: number,
): TrendControllerPeriodData {
  return {
    period,
    categories: Array.from({ length: bucketCount }, (_, i) => String(i)),
    bucketAts: [],
    totalSamples: 12,
    sp: [
      {
        stallTyCode: "SP01",
        label: "임신사",
        stalls: [
          {
            stallNo: "1",
            controllers: [
              {
                stallNo: "1",
                controllerKey: "k1",
                eqpmnNo: "01",
                temp: [],
                humidity: [],
                fanA: [],
                fanB: [],
                fanC: [],
                fanSupply: [],
                fanExhaust: [],
                fanIntake: [],
                sampleCount: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("controllerTrendPeriodHasSeries", () => {
  it("treats a full empty axis as having no series", () => {
    assert.equal(controllerTrendPeriodHasSeries(axisOnly("30d", 720)), false);
    assert.equal(
      controllerTrendPeriodHasSeries(emptyTrendControllerPeriodData("30d")),
      false,
    );
  });

  it("accepts totalSamples even without sp rows", () => {
    assert.equal(
      controllerTrendPeriodHasSeries({
        ...axisOnly("24h", 96),
        totalSamples: 1,
      }),
      true,
    );
  });
});

describe("pickTrendCanvasPeriod", () => {
  it("does not prefer an empty 30d axis over 24h with samples", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": axisOnly("30d", 720),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "24h");
  });

  it("uses 30d when it has series", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": withSamples("30d", 720),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "30d");
  });

  it("keeps 24h on mini tiles while 30d is still filling", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": withSamples("30d", 720),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d", true), "24h");
  });

  it("uses 7d when it has series even if 24h is already loaded", () => {
    const bundle = {
      "24h": withSamples("24h", 96),
      "7d": withSamples("7d", 168),
      "30d": emptyTrendControllerPeriodData("30d"),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "7d");
  });

  it("falls through to the selected period when nothing has series", () => {
    const bundle = {
      "24h": axisOnly("24h", 96),
      "7d": emptyTrendControllerPeriodData("7d"),
      "30d": axisOnly("30d", 720),
    };
    assert.equal(pickTrendCanvasPeriod(bundle, "7d"), "7d");
  });
});

describe("isCompleteControllerTrendBundle", () => {
  it("is complete when the 30d 1h axis is filled", () => {
    assert.equal(
      isCompleteControllerTrendBundle({
        "24h": withSamples("24h", 96),
        "7d": withSamples("7d", 168),
        "30d": withSamples("30d", 720),
      }),
      true,
    );
  });

  it("is incomplete without a 30d axis", () => {
    assert.equal(
      isCompleteControllerTrendBundle({
        "24h": withSamples("24h", 96),
        "7d": withSamples("7d", 168),
        "30d": emptyTrendControllerPeriodData("30d"),
      }),
      false,
    );
  });
});

describe("isFarmTrendLoadComplete", () => {
  const bundle = {
    "24h": withSamples("24h", 96),
    "7d": withSamples("7d", 168),
    "30d": withSamples("30d", 720),
  };

  it("treats a seeded 30d axis as incomplete until day chunks finish", () => {
    assert.equal(isFarmTrendLoadComplete(bundle, 0), false);
    assert.equal(isFarmTrendLoadComplete(bundle, 3), false);
  });

  it("is complete after 30 day chunks on a 30d axis", () => {
    assert.equal(
      isFarmTrendLoadComplete(bundle, TREND_30D_DAY_CHUNKS),
      true,
    );
  });

  it("falls back to axis completeness when scan progress is omitted", () => {
    assert.equal(isFarmTrendLoadComplete(bundle), true);
  });
});
