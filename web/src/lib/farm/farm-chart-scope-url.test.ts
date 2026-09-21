/**
 * 실행: npx tsx src/lib/farm/farm-chart-scope-url.test.ts
 */
import assert from "node:assert/strict";
import {
  applyFarmChartScopeParams,
  applyFarmChartWidgetSlotParams,
  applyFarmChartZoomParams,
  applyFarmChartCmdParam,
  chartScopeEntryToZoomHint,
  clampChartScopeToType,
  clearFarmChartScopeParams,
  clearFarmChartZoomParams,
  filterFarmChartTreeByType,
  applyFarmChartLabSelectionParams,
  parseChartWidgetDragPayload,
  parseChartWidgetSlot,
  EMPTY_FARM_CHART_LAB_SELECTION,
  farmChartLabSelectionFromWidgetSlots,
  farmChartWidgetSlotGrow,
  farmChartWidgetSlotsFromLabSelection,
  placeFarmChartWidget,
  placeFarmChartWidgetNext,
  widgetsAfterOpenControllerChart,
  resolveFarmChartCmdParam,
  resolveFarmChartLabSelection,
  resolveFarmChartScope,
  resolveFarmChartWidgetSlots,
  resolveFarmChartZoomHint,
  scopesEqual,
  type FarmChartScope,
} from "./farm-chart-scope";
import {
  applyListViewParams,
  applyMapGridParams,
  buildFarmMonitoringHomeParams,
  isFarmMonitoringSoftHome,
} from "./farm-view-url";

{
  const params = new URLSearchParams();
  applyFarmChartScopeParams(params, {
    level: "controller",
    stallTyCode: "SP03",
    stallNo: "1",
    controllerKey: "a/b",
  });
  assert.equal(params.get("chartSp"), "SP03");
  assert.equal(params.get("chartStall"), "1");
  assert.equal(params.get("chartCtrl"), "a/b");
  const scope = resolveFarmChartScope(params);
  assert.ok(
    scopesEqual(scope, {
      level: "controller",
      stallTyCode: "SP03",
      stallNo: "1",
      controllerKey: "a/b",
    }),
  );
}

{
  const params = new URLSearchParams("chartSp=SP02");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "sp",
      stallTyCode: "SP02",
    }),
  );
}

{
  const params = new URLSearchParams("chartSp=SP02&chartStall=3");
  assert.ok(
    scopesEqual(resolveFarmChartScope(params), {
      level: "stall",
      stallTyCode: "SP02",
      stallNo: "3",
    }),
  );
}

{
  const farm: FarmChartScope = { level: "farm" };
  const params = new URLSearchParams("chartSp=SP01&chartStall=1&chartCtrl=x");
  applyFarmChartScopeParams(params, farm);
  assert.equal(params.get("chartSp"), null);
  assert.equal(resolveFarmChartScope(params).level, "farm");
}

{
  const source = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&chartSp=SP03&trendPeriod=7d",
  );
  const home = buildFarmMonitoringHomeParams(source);
  assert.equal(home.get("chartSp"), null);
  assert.equal(isFarmMonitoringSoftHome(source), false);
  assert.equal(isFarmMonitoringSoftHome(home), true);
}

{
  const params = new URLSearchParams(
    "view=chart&chartSp=SP03&chartStall=1&listMode=graph",
  );
  applyListViewParams(params);
  assert.equal(params.get("view"), "list");
  assert.equal(params.get("chartSp"), null);
  clearFarmChartScopeParams(params);
}

/** P2 — Y밴드·X구간 줌 */
{
  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, {
    yBands: ["temp"],
    startRatio: 0,
    endRatio: 1,
  });
  assert.equal(params.get("chartYBand"), "temp");
  assert.equal(params.get("chartX0"), null);
  assert.equal(params.get("chartX1"), null);
  const zoom = resolveFarmChartZoomHint(params);
  assert.ok(zoom);
  assert.deepEqual(zoom!.yBands, ["temp"]);
  assert.equal(zoom!.startRatio, 0);
  assert.equal(zoom!.endRatio, 1);
}

{
  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, {
    yBands: ["temp", "hum"],
    startRatio: 0.2,
    endRatio: 0.65,
  });
  assert.equal(params.get("chartYBand"), "temp+hum");
  assert.equal(params.get("chartX0"), "0.200");
  assert.equal(params.get("chartX1"), "0.650");
  const zoom = resolveFarmChartZoomHint(params);
  assert.ok(zoom);
  assert.deepEqual(zoom!.yBands, ["temp", "hum"]);
  assert.ok(Math.abs(zoom!.startRatio - 0.2) < 0.001);
  assert.ok(Math.abs(zoom!.endRatio - 0.65) < 0.001);
}

{
  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, {
    yBands: ["temp", "command"],
    startRatio: 0.1,
    endRatio: 0.9,
  });
  assert.equal(params.get("chartYBand"), "temp");
  assert.equal(params.get("chartCmd"), "1");
  const zoom = resolveFarmChartZoomHint(params);
  assert.ok(zoom);
  assert.deepEqual(zoom!.yBands, ["temp"]);
  assert.equal(resolveFarmChartCmdParam(params), true);
}

{
  const params = new URLSearchParams("chartYBand=command");
  assert.equal(resolveFarmChartCmdParam(params), true);
  const zoom = resolveFarmChartZoomHint(params);
  assert.equal(zoom, null);
}

{
  const params = new URLSearchParams("chartCmd=1");
  assert.equal(resolveFarmChartCmdParam(params), true);
  applyFarmChartCmdParam(params, false);
  assert.equal(params.get("chartCmd"), null);
  assert.equal(resolveFarmChartCmdParam(params), false);
}

{
  const params = new URLSearchParams(
    "view=chart&chartYBand=temp&chartX0=0.1&chartX1=0.4",
  );
  assert.equal(isFarmMonitoringSoftHome(params), false);
  applyListViewParams(params);
  assert.equal(params.get("chartYBand"), null);
  clearFarmChartZoomParams(params);
  assert.equal(params.get("chartX0"), null);
}

{
  const hint = chartScopeEntryToZoomHint(
    { start: 0, end: 99, yBands: ["hum"] },
    100,
  );
  assert.ok(hint);
  assert.deepEqual(hint!.yBands, ["hum"]);
  assert.equal(hint!.startRatio, 0);
  assert.equal(hint!.endRatio, 1);
  assert.equal(hint!.startIndex, 0);
  assert.equal(hint!.endIndex, 99);

  const params = new URLSearchParams();
  applyFarmChartZoomParams(params, hint);
  assert.equal(params.get("chartYBand"), "hum");
  assert.equal(params.get("chartX0"), null);

  assert.equal(
    chartScopeEntryToZoomHint({ start: 0, end: 10, yBands: null }, 100),
    null,
  );
}

{
  assert.deepEqual(
    clampChartScopeToType({ level: "farm" }, "SP02"),
    { level: "sp", stallTyCode: "SP02" },
  );
  assert.deepEqual(
    clampChartScopeToType(
      { level: "sp", stallTyCode: "SP03" },
      "SP02",
    ),
    { level: "sp", stallTyCode: "SP02" },
  );
  assert.deepEqual(
    clampChartScopeToType(
      { level: "stall", stallTyCode: "SP02", stallNo: "01" },
      "SP02",
    ),
    { level: "stall", stallTyCode: "SP02", stallNo: "01" },
  );
  const tree = filterFarmChartTreeByType(
    [
      { stallTyCode: "SP02", label: "분만사", stalls: [], controllerCount: 1 },
      { stallTyCode: "SP03", label: "자돈사", stalls: [], controllerCount: 1 },
    ],
    "SP02",
  );
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.stallTyCode, "SP02");
}

{
  const ctrl = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "a/b",
  };
  const params = new URLSearchParams();
  applyFarmChartWidgetSlotParams(params, { w1: ctrl, w2: null });
  assert.equal(params.get("chartW1"), "SP07|1|a/b");
  assert.equal(params.get("chartW2"), "-");
  const slots = resolveFarmChartWidgetSlots(params);
  assert.ok(slots.w1 && scopesEqual(slots.w1, ctrl));
  assert.equal(slots.w2, null);
  assert.ok(
    parseChartWidgetSlot(params.get("chartW1")) &&
      scopesEqual(parseChartWidgetSlot(params.get("chartW1"))!, ctrl),
  );
}

{
  const params = new URLSearchParams(
    "chartSp=SP07&chartStall=1&chartCtrl=" + encodeURIComponent("a/b"),
  );
  const seeded = resolveFarmChartWidgetSlots(params);
  assert.equal(seeded.w1?.controllerKey, "a/b");
  assert.equal(seeded.w2, null);
  applyFarmChartWidgetSlotParams(params, { w1: null, w2: null });
  const cleared = resolveFarmChartWidgetSlots(params);
  assert.equal(cleared.w1, null);
  assert.equal(cleared.w2, null);
}

{
  const a = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "01",
  };
  const b = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "02",
  };
  const placed = placeFarmChartWidget({ w1: a, w2: b }, "w2", a);
  assert.ok(placed.w2 && scopesEqual(placed.w2, a));
  assert.equal(placed.w1, null);
  const drag = parseChartWidgetDragPayload(JSON.stringify(b));
  assert.ok(drag && scopesEqual(drag, b));
}

{
  const a = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "01",
  };
  const b = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "02",
  };
  const c = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "03",
  };
  const first = placeFarmChartWidgetNext({ w1: null, w2: null }, a);
  assert.ok(first.w1 && scopesEqual(first.w1, a));
  assert.equal(first.w2, null);
  const second = placeFarmChartWidgetNext(first, b);
  assert.ok(second.w1 && scopesEqual(second.w1, a));
  assert.ok(second.w2 && scopesEqual(second.w2, b));
  const again = placeFarmChartWidgetNext(second, a);
  assert.ok(again.w1 && scopesEqual(again.w1, a));
  assert.ok(again.w2 && scopesEqual(again.w2, b));
  const replaceBottom = placeFarmChartWidgetNext(second, c);
  assert.ok(replaceBottom.w1 && scopesEqual(replaceBottom.w1, a));
  assert.ok(replaceBottom.w2 && scopesEqual(replaceBottom.w2, c));
  const replace = widgetsAfterOpenControllerChart(c);
  assert.ok(replace.w1 && scopesEqual(replace.w1, c));
  assert.equal(replace.w2, null);
}

{
  const a = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "01",
  };
  const b = {
    level: "controller" as const,
    stallTyCode: "SP07",
    stallNo: "1",
    controllerKey: "02",
  };
  assert.deepEqual(
    farmChartLabSelectionFromWidgetSlots({ w1: null, w2: null }),
    { mode: "batch", primary: null, partner: null },
  );
  const single = farmChartLabSelectionFromWidgetSlots({ w1: a, w2: null });
  assert.equal(single.mode, "single");
  assert.ok(single.primary && scopesEqual(single.primary, a));
  assert.equal(single.partner, null);
  const compare = farmChartLabSelectionFromWidgetSlots({ w1: a, w2: b });
  assert.equal(compare.mode, "compare");
  assert.ok(compare.primary && scopesEqual(compare.primary, a));
  assert.ok(compare.partner && scopesEqual(compare.partner, b));
  const w2Only = farmChartLabSelectionFromWidgetSlots({ w1: null, w2: b });
  assert.equal(w2Only.mode, "single");
  assert.ok(w2Only.primary && scopesEqual(w2Only.primary, b));
  const normalized = farmChartWidgetSlotsFromLabSelection(w2Only);
  assert.ok(normalized.w1 && scopesEqual(normalized.w1, b));
  assert.equal(normalized.w2, null);
  assert.deepEqual(
    farmChartWidgetSlotsFromLabSelection({
      mode: "batch",
      primary: a,
      partner: null,
    }),
    { w1: null, w2: null },
  );
  const params = new URLSearchParams();
  applyFarmChartLabSelectionParams(params, {
    mode: "compare",
    primary: a,
    partner: b,
  });
  const fromUrl = resolveFarmChartLabSelection(params);
  assert.equal(fromUrl.mode, "compare");
  assert.ok(fromUrl.primary && scopesEqual(fromUrl.primary, a));
  assert.ok(fromUrl.partner && scopesEqual(fromUrl.partner, b));
  applyFarmChartLabSelectionParams(params, EMPTY_FARM_CHART_LAB_SELECTION);
  assert.equal(resolveFarmChartLabSelection(params).mode, "batch");
  const seeded = new URLSearchParams(
    "chartSp=SP07&chartStall=1&chartCtrl=" + encodeURIComponent("a/b"),
  );
  const fromCtrl = resolveFarmChartLabSelection(seeded);
  assert.equal(fromCtrl.mode, "single");
  assert.equal(fromCtrl.primary?.controllerKey, "a/b");
}

{
  assert.equal(farmChartWidgetSlotGrow(false, true, false), "equal");
  assert.equal(farmChartWidgetSlotGrow(false, false, false), "equal");
  assert.equal(farmChartWidgetSlotGrow(true, true, false), "rest");
  assert.equal(farmChartWidgetSlotGrow(true, false, true), "compact");
  assert.equal(farmChartWidgetSlotGrow(true, true, true), "equal");
  assert.equal(farmChartWidgetSlotGrow(true, false, false), "equal");
}

{
  const params = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&chartW1=SP07%7C1%7Ca%2Fb",
  );
  applyListViewParams(params);
  assert.equal(params.get("chartW1"), null);
  assert.equal(params.get("chartW2"), null);
}

{
  const params = new URLSearchParams(
    "lsind=FARM01&item=P00&view=chart&chartSp=SP07&chartW1=SP07%7C1%7Ca%2Fb&chartW2=-",
  );
  applyMapGridParams(params);
  assert.equal(params.get("chartSp"), null);
  assert.equal(params.get("chartW1"), "SP07|1|a/b");
  assert.equal(params.get("chartW2"), "-");
}

{
  const slot = parseChartWidgetSlot("SP07|01|SP07:01:01|SP07:01:01");
  assert.ok(slot);
  assert.equal(slot!.stallTyCode, "SP07");
  assert.equal(slot!.stallNo, "01");
  assert.equal(slot!.controllerKey, "SP07:01:01");
  const lab = resolveFarmChartLabSelection(
    new URLSearchParams(
      "chartW1=SP07%7C01%7CSP07%3A01%3A01%7CSP07%3A01%3A01&chartW2=-",
    ),
  );
  assert.equal(lab.mode, "single");
  assert.equal(lab.primary?.controllerKey, "SP07:01:01");
}

{
  const params = new URLSearchParams(
    "chartSp=SP07&chartStall=01&chartCtrl=SP07%253A01%253A01",
  );
  const scope = resolveFarmChartScope(params);
  assert.equal(scope.level, "controller");
  if (scope.level === "controller") {
    assert.equal(scope.controllerKey, "SP07:01:01");
  }
  applyFarmChartScopeParams(params, scope);
  assert.equal(params.get("chartCtrl"), "SP07:01:01");
}

console.log("farm-chart-scope-url.test.ts: ok");
