/**
 * 실행: npx tsx src/lib/farm/unified-barn-trend-series-m1.test.ts
 *
 * M1 — 집계는 layout 무관 1회, 매핑만 layout에 의존.
 */
import assert from "node:assert/strict";
import type { TrendControllerSeries } from "@/lib/data/farm-trend-types";
import { DEFAULT_ALARM_THRESHOLDS } from "@/lib/data/alarms";
import {
  aggregateUnifiedBarnTrendRaw,
  buildThresholdBreachCorridor,
  buildUnifiedBarnTrendSeries,
  DEFAULT_UNIFIED_LAYERS,
  mapUnifiedBarnTrendRawToSplitY,
  overlayControllerMetricSeries,
  replaceAverageMetricSeries,
  metricAvailabilityFromSeriesList,
  pickUnifiedTrendLayers,
  resolveSplitYLayout,
  SPLIT_Y_BAND_GAP,
  paddedExtentDomain,
  fitTempDisplayDomain,
  fitOverflowValueDomain,
  mapTempCToSplitY,
  mapHumPctToSplitY,
  mapMotorPctToSplitY,
  tempDisplayDomainFromRaw,
  buildSplitYBandScaleTicks,
  OVERLAY_ALIGN_ANCHOR,
  OVERLAY_MOTOR_GUTTER_WEIGHT,
  alarmEdgeDomain,
  SPLIT_Y_TEMP_EDGE_PAD_C,
  tempBrokenAxisPlotZones,
  unmapTempCFromSplitY,
} from "./unified-barn-trend-series";
import { emptyChannelThermo } from "./channel-thermo";

function sampleCtrl(
  temp: (number | null)[],
  hum: (number | null)[],
  opts?: { key?: string; zone?: string; equipment?: string; stallNo?: string },
): TrendControllerSeries {
  return {
    stallNo: opts?.stallNo ?? "1",
    controllerKey: opts?.key ?? "c1",
    eqpmnNo: "1",
    // 모터 표시 정본 = 채널 슬롯 A/B/C.
    fanA: temp.map(() => 40),
    fanB: temp.map(() => 30),
    fanC: temp.map(() => 20),
    // role(EC) 컬럼 — 하위호환용(모터 그래프는 슬롯을 쓴다).
    fanIntake: temp.map(() => 40),
    fanExhaust: temp.map(() => 30),
    fanSupply: temp.map(() => 20),
    temp,
    humidity: hum,
    sampleCount: temp.map(() => 1),
    zoneLabel: opts?.zone,
    equipmentLabel: opts?.equipment,
  };
}

const categories = ["a", "b", "c", "d"];
const list = [
  sampleCtrl([22, 23, 24, 25], [55, 56, 57, 58], {
    key: "c1",
    zone: "임신사",
    equipment: "01번 축사 01",
    stallNo: "1",
  }),
  sampleCtrl([21, 22, 23, 24], [50, 51, 52, 53], {
    key: "c2",
    zone: "자돈사",
    equipment: "01번 축사 02",
    stallNo: "2",
  }),
];
const thresholds = DEFAULT_ALARM_THRESHOLDS;
const layoutFull = resolveSplitYLayout({
  showTemp: true,
  showHum: true,
  showMotors: true,
  showCommand: true,
});
const layoutTempOnly = resolveSplitYLayout({
  showTemp: true,
  showHum: false,
  showMotors: false,
  showCommand: true,
});

{
  /** 밴드 사이 갭 — 상·하한 라벨 분리 */
  assert.ok(
    layoutFull.humLo - layoutFull.motorHi >= SPLIT_Y_BAND_GAP - 1e-6,
    "motor↔hum gap",
  );
  assert.ok(
    layoutFull.tempLo - layoutFull.humHi >= SPLIT_Y_BAND_GAP - 1e-6,
    "hum↔temp gap",
  );
  assert.equal(layoutTempOnly.tempLo, 0);
  assert.equal(layoutTempOnly.tempHi, 100);
}
{
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, thresholds);
  assert.ok(raw, "raw aggregate");
  assert.equal(raw!.tempAvg.length, 4);
  assert.ok(raw!.tempAvg.every((v) => v != null));
  assert.equal(raw!.tempSpreadExtremes.high[0]?.zoneLabel, "임신사");
  assert.equal(raw!.tempSpreadExtremes.low[0]?.zoneLabel, "자돈사");
  assert.equal(raw!.tempSpreadExtremes.high[0]?.equipmentLabel, "01번 축사 01");

  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  const built = buildUnifiedBarnTrendSeries(list, categories, thresholds, {
    layout: layoutFull,
  });
  assert.ok(mapped && built);
  assert.deepEqual(mapped!.seriesByKey.temp?.data, built!.seriesByKey.temp?.data);
  assert.deepEqual(
    mapped!.histogramMotorsMax[0]?.values,
    built!.histogramMotorsMax[0]?.values,
  );
  assert.equal(
    mapped!.seriesByKey.temp?.hoverSpreadExtremes?.high[0]?.zoneLabel,
    "임신사",
  );
}

{
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, thresholds);
  assert.ok(raw);
  const a = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  const b = mapUnifiedBarnTrendRawToSplitY(raw!, layoutTempOnly);
  assert.ok(a && b);
  /** 동일 raw, layout만 바뀌면 temp Y 좌표가 달라짐 */
  assert.notDeepEqual(
    a!.seriesByKey.temp?.data,
    b!.seriesByKey.temp?.data,
  );
  /** 원단위 hover는 layout 무관 */
  assert.deepEqual(
    a!.seriesByKey.temp?.hoverSecondary,
    b!.seriesByKey.temp?.hoverSecondary,
  );
}

{
  /** 상한 초과 시 breached */
  const hot = [
    sampleCtrl([40, 40, 40, 40], [60, 60, 60, 60], {
      key: "hot",
      zone: "분민사",
      equipment: "02번 축사 01",
    }),
    sampleCtrl([22, 22, 22, 22], [55, 55, 55, 55], {
      key: "ok",
      zone: "임신사",
      equipment: "01번 축사 01",
    }),
  ];
  const raw = aggregateUnifiedBarnTrendRaw(hot, categories, thresholds);
  assert.ok(raw);
  assert.equal(raw!.tempSpreadExtremes.high[0]?.breached, true);
  assert.equal(raw!.tempSpreadExtremes.high[0]?.zoneLabel, "분민사");
  assert.equal(raw!.tempSpreadExtremes.low[0]?.breached, false);
}

{
  /** 샘플 사이 교차 + 단일 피크도 코리도 면 생성 */
  const env = buildThresholdBreachCorridor({
    seriesPlot: [10, 40, 10, 50, 10],
    seriesRaw: [20, 40, 20, 36, 20],
    thresholdRaw: 35,
    thresholdPlot: 35,
    side: "high",
    fill: "var(--channel-temp)",
  });
  assert.ok(env?.polys?.length);
  assert.ok((env!.polys?.length ?? 0) >= 2);
  for (const run of env!.polys ?? []) {
    assert.ok(run.length >= 2);
  }
}

{
  /** 습도·모터 시계열이 없으면 해당 available 은 닫는다 */
  const emptyEnv = [
    {
      stallNo: "1",
      controllerKey: "c-empty",
      eqpmnNo: "1",
      fanA: [null, null, null, null],
      fanB: [null, null, null, null],
      fanC: [null, null, null, null],
      fanIntake: [null, null, null, null],
      fanExhaust: [null, null, null, null],
      fanSupply: [null, null, null, null],
      temp: [31, 31.2, 31.4, 31.1],
      humidity: [null, null, null, null],
      sampleCount: [1, 1, 1, 1],
    } satisfies TrendControllerSeries,
  ];
  const builtEmpty = buildUnifiedBarnTrendSeries(
    emptyEnv,
    categories,
    thresholds,
    { layout: layoutFull },
  );
  assert.ok(builtEmpty);
  assert.equal(builtEmpty!.available.hum, false);
  assert.equal(builtEmpty!.available.motors, false);
  assert.equal(builtEmpty!.available.temp, true);
  assert.equal(builtEmpty!.histogramMotorsMax.length, 0);
  assert.equal(builtEmpty!.seriesByKey.hum, undefined);
  const avail = metricAvailabilityFromSeriesList(emptyEnv);
  assert.equal(avail.temp, true);
  assert.equal(avail.hum, false);
  assert.equal(avail.motors, false);
}

{
  const thermo = sampleCtrl([22, 23, 24, 25], [55, 56, 57, 58], { key: "c-th" });
  const a = emptyChannelThermo(4);
  const b = emptyChannelThermo(4);
  const c = emptyChannelThermo(4);
  for (let i = 0; i < 4; i++) {
    a.setpoint[i] = i >= 2 ? 25 : 24;
    a.deviation[i] = 5;
    a.minVent[i] = i >= 2 ? 20 : 10;
    a.maxVent[i] = 90;
    b.setpoint[i] = 2;
    b.deviation[i] = 4;
    b.minVent[i] = 20;
    b.maxVent[i] = 80;
    c.setpoint[i] = 3;
    c.deviation[i] = 3;
    c.minVent[i] = 30;
    c.maxVent[i] = 70;
  }
  thermo.thermoA = a;
  thermo.thermoB = b;
  thermo.thermoC = c;
  const raw = aggregateUnifiedBarnTrendRaw([thermo], categories, thresholds, {
    includeThermo: true,
  });
  assert.ok(raw?.thermoWindows);
  assert.equal(raw!.thermoWindows!.a.loC[0], 24);
  assert.equal(raw!.thermoWindows!.a.hiC[0], 29);
  assert.equal(raw!.thermoWindows!.b.loC[0], 26);
  assert.equal(raw!.thermoWindows!.c.loC[0], 27);
  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  assert.ok(mapped);
  const linearTemp = alarmEdgeDomain(
    thresholds.tempLow,
    thresholds.tempHigh,
    SPLIT_Y_TEMP_EDGE_PAD_C,
  );
  assert.deepEqual(mapped.tempDomain, linearTemp);
  assert.equal(mapped.tempOverflowDomain, null);
  assert.equal(mapped!.available.thermo, false);
  assert.equal(mapped!.available.thermoMotor, false);
  const picked = pickUnifiedTrendLayers(mapped!, DEFAULT_UNIFIED_LAYERS);
  assert.equal(
    picked.series.filter((s) => s.markerOnly).length,
    0,
  );
  const skipped = aggregateUnifiedBarnTrendRaw(list, categories, thresholds, {
    includeThermo: true,
  });
  assert.equal(skipped!.thermoWindows, null);
}

{
  assert.deepEqual(paddedExtentDomain(24, 27), [23.4, 27.6]);
  assert.deepEqual(fitTempDisplayDomain([[24], [27]], [10, 35]), [23.4, 27.6]);
  assert.deepEqual(
    tempDisplayDomainFromRaw({
      tempAvg: [22, 25],
      tempMin: [22, 25],
      tempMax: [22, 25],
      emaShortRaw: [22, 25],
      emaLongRaw: [22, 25],
      tempLow: 24,
      tempHigh: 27,
    }),
    paddedExtentDomain(22, 25),
  );
  const raw = aggregateUnifiedBarnTrendRaw(list, categories, {
    ...thresholds,
    tempLow: 24,
    tempHigh: 27,
  });
  assert.ok(raw);
  const mapped = mapUnifiedBarnTrendRawToSplitY(raw!, layoutFull);
  assert.ok(mapped);
  const temps = mapped.seriesByKey.temp?.data ?? [];
  const finite = temps.filter((v): v is number => v != null && Number.isFinite(v));
  assert.ok(finite.length > 0);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  assert.equal(lo, layoutFull.tempLo);
  assert.ok(hi < layoutFull.tempHi);
  const edge = alarmEdgeDomain(24, 27, SPLIT_Y_TEMP_EDGE_PAD_C);
  const yAlarmLo = mapTempCToSplitY(24, 24, 27, layoutFull, edge);
  const yAlarmHi = mapTempCToSplitY(27, 24, 27, layoutFull, edge);
  assert.ok(yAlarmLo != null && yAlarmLo > layoutFull.tempLo);
  assert.ok(yAlarmHi != null && yAlarmHi < layoutFull.tempHi);
  assert.equal(mapTempCToSplitY(22, 24, 27, layoutFull, edge), layoutFull.tempLo);
  assert.equal(mapTempCToSplitY(29, 24, 27, layoutFull, edge), layoutFull.tempHi);
  const fittedPeak = mapTempCToSplitY(
    28,
    24,
    27,
    layoutFull,
    paddedExtentDomain(21, 28),
  );
  assert.ok(
    fittedPeak != null && fittedPeak < layoutFull.tempHi,
    "표시 최댓값+여유면 최고점도 밴드 안에 남음",
  );
}

{
  const ticks = buildSplitYBandScaleTicks({
    layout: layoutFull,
    showTemp: true,
    showHum: true,
    showMotors: true,
    tempLow: 23,
    tempHigh: 27,
    humidityLow: 55,
    humidityHigh: 65,
  });
  assert.equal(ticks.length, 3);
  assert.equal(ticks.find((t) => t.id === "band-tick-temp-mid")?.value, 25);
  assert.equal(ticks.find((t) => t.id === "band-tick-hum-mid")?.value, 60);
  assert.equal(ticks.find((t) => t.id === "band-tick-motor-mid")?.value, 50);
  const overlayTicks = buildSplitYBandScaleTicks({
    layout: layoutFull,
    showTemp: true,
    showHum: true,
    showMotors: true,
    overlay: true,
    tempLow: 23,
    tempHigh: 27,
    humidityLow: 55,
    humidityHigh: 65,
  });
  assert.equal(overlayTicks.length, 0);

  const overlayLayout = resolveSplitYLayout(
    {
      showTemp: true,
      showHum: true,
      showMotors: true,
      showCommand: true,
    },
    true,
  );
  assert.equal(overlayLayout.tempLo, overlayLayout.humLo);
  assert.equal(overlayLayout.tempHi, overlayLayout.humHi);
  assert.ok(overlayLayout.motorHi < overlayLayout.tempLo);
  assert.ok(Math.abs(overlayLayout.motorLo) < 1e-6);
  assert.ok(Math.abs(overlayLayout.tempHi - 100) < 1e-6);
  const overlayUsable = 100 - SPLIT_Y_BAND_GAP;
  assert.ok(
    Math.abs(overlayLayout.motorHi / overlayUsable - OVERLAY_MOTOR_GUTTER_WEIGHT) <
      1e-6,
  );
  const overlayOnTicks = buildSplitYBandScaleTicks({
    layout: overlayLayout,
    showTemp: true,
    showHum: true,
    showMotors: true,
    overlay: true,
    tempLow: 23,
    tempHigh: 27,
    humidityLow: 55,
    humidityHigh: 65,
  });
  assert.equal(overlayOnTicks.length, 0);

  const yTempHi = mapTempCToSplitY(
    27,
    23,
    27,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  const yHumHi = mapHumPctToSplitY(
    65,
    55,
    65,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  const yMotorHi = mapMotorPctToSplitY(100, overlayLayout, OVERLAY_ALIGN_ANCHOR);
  const yTempLo = mapTempCToSplitY(
    23,
    23,
    27,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  const yHumLo = mapHumPctToSplitY(
    55,
    55,
    65,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  const yMotorLo = mapMotorPctToSplitY(0, overlayLayout, OVERLAY_ALIGN_ANCHOR);
  assert.ok(yTempHi != null && yHumHi != null && yMotorHi != null);
  assert.ok(Math.abs(yTempHi - yHumHi) < 1e-6);
  assert.ok(Math.abs(yMotorHi - overlayLayout.motorHi) < 1e-6);
  assert.ok(yTempLo != null && yHumLo != null && yMotorLo != null);
  assert.ok(Math.abs(yTempLo - yHumLo) < 1e-6);
  assert.ok(Math.abs(yMotorLo - overlayLayout.motorLo) < 1e-6);
}

{
  const usable = 100 - 2 * SPLIT_Y_BAND_GAP;
  assert.ok(Math.abs(layoutFull.motorHi - layoutFull.motorLo - usable / 6) < 1e-6);
  assert.ok(Math.abs(layoutFull.humHi - layoutFull.humLo - usable / 3) < 1e-6);
  assert.ok(Math.abs(layoutFull.tempHi - layoutFull.tempLo - usable / 2) < 1e-6);
  const noMotor = resolveSplitYLayout({
    showTemp: true,
    showHum: true,
    showMotors: false,
    showCommand: true,
  });
  assert.ok(
    Math.abs(noMotor.tempHi - noMotor.tempLo - (noMotor.humHi - noMotor.humLo)) <
      1e-6,
  );
  const noMotorZones = tempBrokenAxisPlotZones(noMotor);
  assert.ok(noMotorZones);
  const yHotNoMotor = mapTempCToSplitY(24, 15, 20, noMotor, [13, 27]);
  assert.ok(
    yHotNoMotor != null &&
      yHotNoMotor >= noMotorZones.overflow.lo &&
      yHotNoMotor <= noMotorZones.overflow.hi,
  );
  const overlayLayout = resolveSplitYLayout(
    {
      showTemp: true,
      showHum: true,
      showMotors: true,
      showCommand: true,
    },
    true,
  );
  const overlayZones = tempBrokenAxisPlotZones(overlayLayout);
  assert.ok(overlayZones);
  const yHotOverlay = mapTempCToSplitY(
    24,
    15,
    20,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
    fitOverflowValueDomain(24, 24),
  );
  assert.ok(
    yHotOverlay != null &&
      yHotOverlay >= overlayZones.overflow.lo &&
      yHotOverlay <= overlayZones.overflow.hi,
  );
  const yEdgeOverlay = mapTempCToSplitY(
    20,
    15,
    20,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  const yHumEdge = mapHumPctToSplitY(
    60,
    40,
    60,
    overlayLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  assert.ok(yEdgeOverlay != null && yHumEdge != null);
  assert.ok(Math.abs(yEdgeOverlay - yHumEdge) < 1e-6);
  assert.ok(Math.abs(yEdgeOverlay - overlayZones.linear.hi) < 1e-6);
}

{
  const domain: [number, number] = [13, 27];
  const zones = tempBrokenAxisPlotZones(layoutFull);
  assert.ok(zones);
  const yMid = mapTempCToSplitY(17.5, 15, 20, layoutFull, domain);
  const yHot = mapTempCToSplitY(24, 15, 20, layoutFull, domain);
  const yEdge = mapTempCToSplitY(20, 15, 20, layoutFull, domain);
  assert.ok(yMid != null && yMid >= zones.linear.lo && yMid <= zones.linear.hi);
  assert.ok(yEdge != null && yEdge <= zones.linear.hi);
  assert.ok(yHot != null && yHot >= zones.overflow.lo && yHot <= zones.overflow.hi);
  const back = unmapTempCFromSplitY(yHot, 15, 20, layoutFull, domain);
  assert.ok(back != null && Math.abs(back - 24) < 0.05);
}

{
  const overlayList = [
    sampleCtrl([22, 23, 24, 25], [55, 56, 57, 58], {
      key: "c1",
      stallNo: "1",
    }),
    sampleCtrl([21, 22, 23, 24], [50, 51, 52, 53], {
      key: "c2",
      stallNo: "1",
    }),
  ];
  overlayList[0]!.eqpmnNo = "1";
  overlayList[1]!.eqpmnNo = "2";
  const overlayPack = overlayControllerMetricSeries({
    seriesList: overlayList,
    categories,
    thresholds,
    layout: layoutFull,
    layers: DEFAULT_UNIFIED_LAYERS,
  });
  const overlay = overlayPack.series;
  assert.equal(overlay.filter((s) => s.name.endsWith("온도")).length, 2);
  assert.equal(overlay.filter((s) => s.name.endsWith("습도")).length, 2);
  const mapped = mapUnifiedBarnTrendRawToSplitY(
    aggregateUnifiedBarnTrendRaw(overlayList, categories, thresholds)!,
    layoutFull,
  );
  const picked = pickUnifiedTrendLayers(mapped!, DEFAULT_UNIFIED_LAYERS);
  const replaced = replaceAverageMetricSeries(picked.series, overlay);
  assert.equal(
    replaced.some((s) => s.name === "온도" || s.name === "습도"),
    false,
  );
  assert.ok(replaced.some((s) => s.name === "01번 온도"));
}

{
  /** 컨트롤러 오버레이가 온도만 있으면 평균 습도 본선은 남긴다 */
  const overlayTempOnly = overlayControllerMetricSeries({
    seriesList: [
      sampleCtrl([22, 23, 24, 25], [null, null, null, null], {
        key: "c1",
        stallNo: "1",
      }),
      sampleCtrl([21, 22, 23, 24], [null, null, null, null], {
        key: "c2",
        stallNo: "1",
      }),
    ].map((item, i) => {
      item.eqpmnNo = i === 0 ? "1" : "2";
      item.humidity = [null, null, null, null];
      return item;
    }),
    categories,
    thresholds,
    layout: layoutFull,
    layers: DEFAULT_UNIFIED_LAYERS,
  });
  assert.ok(overlayTempOnly.series.some((s) => s.name.endsWith("온도")));
  assert.equal(
    overlayTempOnly.series.some((s) => s.name.endsWith("습도")),
    false,
  );
  const withHum = replaceAverageMetricSeries(
    [
      { name: "온도", data: [1], color: "t", axis: "left" },
      { name: "습도", data: [2], color: "h", axis: "left" },
    ],
    overlayTempOnly.series,
  );
  assert.equal(withHum.some((s) => s.name === "습도"), true);
  assert.equal(withHum.some((s) => s.name === "온도"), false);
}

{
  const rec = { ...DEFAULT_ALARM_THRESHOLDS, tempLow: 15, tempHigh: 20 };
  const fit = fitOverflowValueDomain(24.6, 25.4);
  const zones = tempBrokenAxisPlotZones(layoutFull);
  assert.ok(zones);
  const yLo = mapTempCToSplitY(
    24.6,
    15,
    20,
    layoutFull,
    [13, fit[1]],
    undefined,
    fit,
  );
  const yHi = mapTempCToSplitY(
    25.4,
    15,
    20,
    layoutFull,
    [13, fit[1]],
    undefined,
    fit,
  );
  assert.ok(yLo != null && yHi != null);
  const fitSpan = yHi - yLo;
  const zoneSpan = zones.overflow.hi - zones.overflow.lo;
  assert.ok(fitSpan / zoneSpan > 0.6, "이탈 자체 스케일이 위칸을 채움");
  const yLoExt = mapTempCToSplitY(24.6, 15, 20, layoutFull, [13, 27]);
  const yHiExt = mapTempCToSplitY(25.4, 15, 20, layoutFull, [13, 27]);
  assert.ok(yLoExt != null && yHiExt != null);
  assert.ok(fitSpan > yHiExt - yLoExt);
  const back = unmapTempCFromSplitY(
    yHi,
    15,
    20,
    layoutFull,
    [13, fit[1]],
    undefined,
    fit,
  );
  assert.ok(back != null && Math.abs(back - 25.4) < 0.05);

  const clustered = [
    sampleCtrl([24.6, 25.0, 24.8, 25.4], [55, 56, 57, 58], {
      key: "fit-cluster",
    }),
  ];
  const mapped = mapUnifiedBarnTrendRawToSplitY(
    aggregateUnifiedBarnTrendRaw(clustered, categories, rec)!,
    layoutFull,
  );
  assert.ok(mapped?.tempOverflowDomain);
  const ys = (mapped!.seriesByKey.temp?.data ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  assert.ok(ys.length >= 2);
  const mappedSpan = Math.max(...ys) - Math.min(...ys);
  assert.ok(mappedSpan / zoneSpan > 0.6);

  const overlayList = [
    sampleCtrl([24.6, 24.7, 24.8, 24.9], [55, 56, 57, 58], {
      key: "fit-c1",
      stallNo: "1",
    }),
    sampleCtrl([29.8, 30.0, 29.9, 30.1], [50, 51, 52, 53], {
      key: "fit-c2",
      stallNo: "1",
    }),
  ];
  overlayList[0]!.eqpmnNo = "1";
  overlayList[1]!.eqpmnNo = "2";
  const overlayPack = overlayControllerMetricSeries({
    seriesList: overlayList,
    categories,
    thresholds: rec,
    layout: layoutFull,
    layers: DEFAULT_UNIFIED_LAYERS,
  });
  const yA = overlayPack.series.find((s) => s.name === "01번 온도")?.data[3];
  const yB = overlayPack.series.find((s) => s.name === "02번 온도")?.data[3];
  assert.ok(yA != null && yB != null);
  assert.ok(
    Math.abs(yA - yB) > zoneSpan * 0.4,
    "오버레이는 위칸 ℃를 공유한다",
  );

  const overlayViewLayout = resolveSplitYLayout(
    {
      showTemp: true,
      showHum: true,
      showMotors: true,
      showCommand: true,
    },
    true,
  );
  const overlayViewZones = tempBrokenAxisPlotZones(overlayViewLayout);
  assert.ok(overlayViewZones);
  const overlayViewPack = overlayControllerMetricSeries({
    seriesList: overlayList,
    categories,
    thresholds: rec,
    layout: overlayViewLayout,
    overlayAlign: OVERLAY_ALIGN_ANCHOR,
    layers: DEFAULT_UNIFIED_LAYERS,
  });
  assert.ok(overlayViewPack.tempOverflowDomain);
  const yViewA = overlayViewPack.series.find((s) => s.name === "01번 온도")
    ?.data[3];
  const yViewB = overlayViewPack.series.find((s) => s.name === "02번 온도")
    ?.data[3];
  assert.ok(yViewA != null && yViewB != null);
  const overlayZoneSpan =
    overlayViewZones.overflow.hi - overlayViewZones.overflow.lo;
  assert.ok(
    Math.abs(yViewA - yViewB) > overlayZoneSpan * 0.4,
    "겹쳐보기에서도 위칸 ℃를 공유한다",
  );
  const overlayMapped = mapUnifiedBarnTrendRawToSplitY(
    aggregateUnifiedBarnTrendRaw(clustered, categories, rec)!,
    overlayViewLayout,
    undefined,
    OVERLAY_ALIGN_ANCHOR,
  );
  assert.ok(overlayMapped?.tempOverflowDomain);
  const overlayYs = (overlayMapped!.seriesByKey.temp?.data ?? []).filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  assert.ok(overlayYs.length >= 2);
  const overlayMappedSpan = Math.max(...overlayYs) - Math.min(...overlayYs);
  assert.ok(overlayMappedSpan / overlayZoneSpan > 0.6);
}

console.log("unified-barn-trend-series-m1.test.ts: ok");
